const express = require('express');
const router = express.Router();
const dbHelper = require('../utils/dbHelper');
const { authenticateToken: auth } = require('../middleware/auth');

// ==========================================
// LISTE DES PAIEMENTS
// ==========================================
router.get('/', auth, async (req, res) => {
  try {
    const { statut, type, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        p.*,
        d.numero_commande as dossier_numero,
        d.client_nom as dossier_client,
        f.numero as facture_numero,
        u.prenom, u.nom
      FROM paiements p
      LEFT JOIN dossiers d ON p.dossier_id = d.folder_id
      LEFT JOIN factures f ON p.facture_id = f.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Filtres
    if (req.user.role === 'preparateur') {
      query += ` AND p.user_id = $${paramIndex++}`;
      params.push(req.user.id);
    }
    
    if (statut) {
      query += ` AND p.statut = $${paramIndex++}`;
      params.push(statut);
    }
    
    if (type) {
      query += ` AND p.type = $${paramIndex++}`;
      params.push(type);
    }
    
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const [paiements] = await dbHelper.query(query, params);
    
    // Stats
    const [statsResult] = await dbHelper.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'approuve' THEN montant ELSE 0 END) as total_approuve,
        SUM(CASE WHEN statut = 'en_attente' THEN montant ELSE 0 END) as total_en_attente,
        SUM(CASE WHEN statut = 'refuse' THEN montant ELSE 0 END) as total_refuse
      FROM paiements
      ${req.user.role === 'preparateur' ? 'WHERE user_id = $1' : ''}
    `, req.user.role === 'preparateur' ? [req.user.id] : []);
    
    res.json({ 
      paiements,
      stats: statsResult[0] || {}
    });
  } catch (error) {
    console.error('Erreur GET /paiements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==========================================
// APPROUVER UN PAIEMENT (admin seulement)
// ==========================================
router.post('/:id/approuver', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const { commentaire } = req.body;
    const paiementId = req.params.id;
    
    // Récupérer le paiement
    const [paiement] = await dbHelper.query(
      'SELECT * FROM paiements WHERE id = $1',
      [paiementId]
    );
    
    if (paiement.length === 0) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    
    // Approuver
    await dbHelper.query(
      `UPDATE paiements 
       SET statut = 'approuve', 
           date_approbation = NOW(), 
           approuve_par = $1,
           commentaire_admin = $2
       WHERE id = $3`,
      [req.user.id, commentaire || null, paiementId]
    );
    
    // Mettre à jour le statut du dossier/facture si nécessaire
    if (paiement[0].dossier_id) {
      await dbHelper.query(
        `UPDATE dossiers 
         SET statut_paiement = 'paye' 
         WHERE folder_id = $1`,
        [paiement[0].dossier_id]
      );
    }
    
    if (paiement[0].facture_id) {
      await dbHelper.query(
        `UPDATE factures 
         SET statut_paiement = 'paye' 
         WHERE id = $1`,
        [paiement[0].facture_id]
      );
    }
    
    res.json({ 
      message: 'Paiement approuvé avec succès',
      paiement_id: paiementId
    });
  } catch (error) {
    console.error('Erreur approbation paiement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==========================================
// REFUSER UN PAIEMENT (admin seulement)
// ==========================================
router.post('/:id/refuser', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const { raison } = req.body;
    const paiementId = req.params.id;
    
    if (!raison) {
      return res.status(400).json({ error: 'Raison du refus requise' });
    }
    
    await dbHelper.query(
      `UPDATE paiements 
       SET statut = 'refuse', 
           date_refus = NOW(), 
           refuse_par = $1,
           raison_refus = $2
       WHERE id = $3`,
      [req.user.id, raison, paiementId]
    );
    
    res.json({ 
      message: 'Paiement refusé',
      paiement_id: paiementId
    });
  } catch (error) {
    console.error('Erreur refus paiement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==========================================
// ENREGISTRER UN NOUVEAU PAIEMENT
// ==========================================
router.post('/', auth, async (req, res) => {
  try {
    const {
      dossier_id,
      facture_id,
      montant,
      mode_paiement,
      reference_transaction,
      commentaire
    } = req.body;
    
    if (!montant || montant <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }
    
    if (!dossier_id && !facture_id) {
      return res.status(400).json({ error: 'Dossier ou facture requis' });
    }
    
    const [result] = await dbHelper.query(
      `INSERT INTO paiements 
       (dossier_id, facture_id, user_id, montant, mode_paiement, reference_transaction, commentaire, statut, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'en_attente', $8)
       RETURNING id`,
      [
        dossier_id || null,
        facture_id || null,
        req.user.id,
        montant,
        mode_paiement || 'especes',
        reference_transaction || null,
        commentaire || null,
        dossier_id ? 'dossier' : 'facture'
      ]
    );
    
    const insertId = dbHelper.getInsertId(result);
    
    res.status(201).json({ 
      message: 'Paiement enregistré',
      paiement_id: insertId
    });
  } catch (error) {
    console.error('Erreur création paiement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==========================================
// RAPPELS AUTOMATIQUES POUR PAIEMENTS EN ATTENTE
// ==========================================
router.get('/rappels/dossiers-non-payes', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'livreur') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const { jours = 3 } = req.query;
    
    const [dossiers] = await dbHelper.query(
      `SELECT 
        d.folder_id, 
        d.numero_commande,
        d.client_nom,
        d.prix_final,
        d.created_at,
        d.status,
        u.prenom, u.nom, u.email, u.telephone
      FROM dossiers d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.statut_paiement != 'paye'
        AND d.status IN ('pret_livraison', 'en_livraison', 'livre')
        AND d.created_at < NOW() - INTERVAL '${parseInt(jours)} days'
      ORDER BY d.created_at DESC`,
      []
    );
    
    res.json({ 
      dossiers_non_payes: dossiers,
      count: dossiers.length
    });
  } catch (error) {
    console.error('Erreur rappels:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
