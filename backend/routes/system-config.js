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

module.exports = router;
