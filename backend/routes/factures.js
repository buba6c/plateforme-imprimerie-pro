const express = require('express');
const router = express.Router();
const dbHelper = require("../utils/dbHelper");
const { authenticateToken: auth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');

router.get('/', auth, async (req, res) => {
  try {
    const { statut_paiement, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM v_factures_complet WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (req.user.role === 'preparateur') {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(req.user.id);
    }
    if (statut_paiement) {
      query += ` AND statut_paiement = $${paramIndex++}`;
      params.push(statut_paiement);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const [factures] = await dbHelper.query(query, params);
    res.json({ factures });
  } catch (error) {
    console.error('Erreur GET /factures:', error);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

router.post('/generate', auth, async (req, res) => {
  try {
    const { dossier_id, mode_paiement, client_nom, client_contact, montant_ttc } = req.body;
    
    const [dossier] = await dbHelper.query('SELECT * FROM dossiers WHERE folder_id = $1', [dossier_id]);
    if (dossier.length === 0) return res.status(404).json({ error: 'Dossier non trouvé' });
    
    const [existing] = await dbHelper.query('SELECT * FROM factures WHERE dossier_id = $1', [dossier_id]);
    if (existing.length > 0) return res.status(400).json({ error: 'Facture existe déjà' });
    
    const montantTTC = parseFloat(montant_ttc);
    const montantHT = montantTTC / 1.18;
    const montantTVA = montantTTC - montantHT;
    
    // Assurer que user_id n'est pas null : utiliser l'utilisateur qui déclenche la requête en fallback
    const userIdForInvoice = dossier[0].user_id || req.user?.id || null;

    const [result] = await dbHelper.query(
      `INSERT INTO factures (dossier_id, user_id, montant_ht, montant_tva, montant_ttc, client_nom, client_contact, mode_paiement, statut_paiement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [dossier_id, userIdForInvoice, montantHT.toFixed(2), montantTVA.toFixed(2), montantTTC.toFixed(2),
       client_nom || 'Client', client_contact, mode_paiement || 'especes', 'non_paye']
    );

    // Récupérer l'ID inséré
    const insertId = result[0].id;
    const [factureCreated] = await dbHelper.query('SELECT * FROM v_factures_complet WHERE id = $1', [insertId]);
    
    // 🔥 CRÉER AUTOMATIQUEMENT UN PAIEMENT EN ATTENTE POUR CETTE FACTURE
    try {
      await dbHelper.query(
        `INSERT INTO paiements (facture_id, montant, mode_paiement, statut, reference_paiement, notes, user_id, date_paiement)
         VALUES ($1, $2, $3, 'en_attente', $4, $5, $6, CURRENT_DATE)`,
        [
          insertId,
          montantTTC.toFixed(2),
          mode_paiement || 'especes',
          `PAY-${factureCreated[0].numero}`,
          'Paiement en attente d\'approbation',
          userIdForInvoice
        ]
      );
      console.log(`✅ Paiement automatique créé pour facture #${insertId}`);
    } catch (paiementError) {
      console.error('⚠️ Erreur création paiement auto:', paiementError.message);
      // Ne pas bloquer la création de facture si le paiement échoue
    }
    
    try {
      const pdfPath = await pdfService.generateInvoicePDF(factureCreated[0]);
      await dbHelper.query('UPDATE factures SET pdf_path = $1, pdf_generated_at = NOW() WHERE id = $2', [pdfPath, insertId]);
    } catch (pdfError) {
      console.error('Erreur PDF:', pdfError);
    }
    
    res.status(201).json({ message: 'Facture générée', facture: factureCreated[0] });
  } catch (error) {
    console.error('Erreur POST /factures/generate:', error);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const [facture] = await dbHelper.query('SELECT * FROM v_factures_complet WHERE id = $1', [req.params.id]);
    if (facture.length === 0) return res.status(404).json({ error: 'Facture non trouvée' });
    
    if (!facture[0].pdf_path) {
      const pdfPath = await pdfService.generateInvoicePDF(facture[0]);
      await dbHelper.query('UPDATE factures SET pdf_path = $1, pdf_generated_at = NOW() WHERE id = $2', [pdfPath, req.params.id]);
      return res.download(pdfPath, `${facture[0].numero}.pdf`);
    }
    
    res.download(facture[0].pdf_path, `${facture[0].numero}.pdf`);
  } catch (error) {
    console.error('Erreur GET /factures/:id/pdf:', error);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

module.exports = router;
