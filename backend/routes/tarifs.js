const express = require('express');
const router = express.Router();
const dbHelper = require("../utils/dbHelper");
const { authenticateToken: auth } = require('../middleware/auth');
const openaiService = require('../services/openaiService');

router.get('/', auth, async (req, res) => {
  try {
    const { type_type_formulaire, categorie } = req.query;
    let query = 'SELECT * FROM tarifs_config WHERE actif = TRUE';
    const params = [];
    let paramIndex = 1;
    
    if (type_formulaire) {
      query += ` AND type_formulaire = $${paramIndex}`;
      params.push(type_formulaire);
      paramIndex++;
    }
    if (categorie) {
      query += ` AND categorie = $${paramIndex}`;
      params.push(categorie);
      paramIndex++;
    }
    
    query += ' ORDER BY type_type_formulaire, categorie, description';
    const tarifs = await dbHelper.query(query, params);
    
    res.json({ tarifs: tarifs[0] || tarifs });
  } catch (error) {
    console.error('❌ Erreur GET tarifs:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const { valeur, description, actif } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (valeur !== undefined) { 
      updates.push(`prix_unitaire = $${paramIndex}`); 
      params.push(valeur); 
      paramIndex++;
    }
    if (description !== undefined) { 
      updates.push(`description = $${paramIndex}`); 
      params.push(description); 
      paramIndex++;
    }
    if (actif !== undefined) { 
      updates.push(`actif = $${paramIndex}`); 
      params.push(actif); 
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }
    
    params.push(req.params.id);
    
    await dbHelper.query(
      `UPDATE tarifs_config SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`, 
      params
    );
    res.json({ message: 'Tarif mis à jour' });
  } catch (error) {
    console.error('❌ Erreur PUT tarif:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/optimize-ai', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const [tarifs] = await dbHelper.query('SELECT * FROM tarifs_config WHERE actif = TRUE');
    const [stats] = await dbHelper.query(`
      SELECT 
        COUNT(*) as total_dossiers,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as dossiers_termines,
        AVG(montant_cfa) as montant_moyen,
        type_formulaire,
        type_formulaire
      FROM dossiers 
      WHERE created_at >= NOW() - INTERVAL '3 months'
      GROUP BY type_formulaire, type_formulaire
    `);
    
    const result = await openaiService.optimizePricing(tarifs, stats);
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur optimisation IA:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

module.exports = router;
