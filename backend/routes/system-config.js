const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Protéger toutes les routes de configuration système
router.use(authenticateToken);

// GET /api/system-config - Liste tous les paramètres système (admin uniquement)
router.get('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT key, value, updated_at FROM system_config ORDER BY key ASC'
    );
    res.json({ success: true, params: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system-config/:key (admin uniquement)
router.get('/:key', authorizeRoles('admin'), async (req, res) => {
  const { key } = req.params;
  try {
    const result = await db.query('SELECT value FROM system_config WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Clé non trouvée' });
    }
    // Toujours retourner un objet { value: ... }
    res.json({ value: result.rows[0].value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/system-config/:key (admin uniquement)
router.put('/:key', authorizeRoles('admin'), async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  if (typeof value === 'undefined') {
    return res.status(400).json({ error: 'Corps invalide: { value } requis' });
  }
  try {
    await db.query(
      'INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      [key, value]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system-config/reset-dossier-counter (admin uniquement)
router.post('/reset-dossier-counter', authorizeRoles('admin'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Vérifier que la séquence existe
    const seqCheck = await client.query(`
      SELECT sequencename FROM pg_sequences 
      WHERE schemaname = 'public' AND sequencename LIKE '%dossiers%numero%'
    `);
    
    if (seqCheck.rows.length === 0) {
      throw new Error('Séquence de numérotation des dossiers introuvable');
    }
    
    const sequenceName = seqCheck.rows[0].sequencename;
    console.log(`🔄 Réinitialisation de la séquence: ${sequenceName}`);
    
    // Réinitialiser la séquence à 1 (le prochain numéro sera 1)
    // setval(sequence, value, is_called)
    // is_called = false signifie que la prochaine valeur sera `value`
    await client.query(`SELECT setval($1, 1, false)`, [sequenceName]);
    
    // Logger l'action
    console.log(`✅ Admin ${req.user.email} (ID: ${req.user.id}) a réinitialisé le compteur de dossiers à 0`);
    
    // Sauvegarder dans system_config pour historique
    await client.query(
      `INSERT INTO system_config (key, value, updated_at) 
       VALUES ('last_dossier_counter_reset', $1, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [new Date().toISOString()]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Le compteur de dossiers a été réinitialisé. Le prochain dossier aura le numéro 1.',
      sequence: sequenceName,
      resetBy: req.user.email,
      resetAt: new Date().toISOString()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur réinitialisation compteur:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
