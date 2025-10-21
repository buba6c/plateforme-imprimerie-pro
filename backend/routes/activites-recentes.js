const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

router.use(authenticateToken);

// GET /api/activites-recentes - 10 dernières actions dossiers/fichiers
router.get('/', async (req, res) => {
  try {
    // Récupérer les 10 dernières créations de dossiers
    const dossiers = await db.query(
      `SELECT id, numero_commande, client_nom, type, created_at, 'dossier' as action_type
       FROM dossiers
       ORDER BY created_at DESC
       LIMIT 10`
    );
    // Récupérer les 10 derniers fichiers uploadés
    const fichiers = await db.query(
      `SELECT id, nom_original, dossier_id, uploaded_by, created_at, 'fichier' as action_type
       FROM fichiers
       ORDER BY created_at DESC
       LIMIT 10`
    );
    // Fusionner et trier par date
    const all = [
      ...dossiers.rows.map(d => ({
        id: d.id,
        type: d.action_type,
        title: `Dossier ${d.numero_commande}`,
        description: `Client: ${d.client_nom} - ${d.type}`,
        date: d.created_at,
      })),
      ...fichiers.rows.map(f => ({
        id: f.id,
        type: f.action_type,
        title: `Fichier: ${f.nom_original}`,
        description: `Dossier #${f.dossier_id}`,
        date: f.created_at,
      })),
    ];
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, activites: all.slice(0, 10) });
  } catch (error) {
    console.error('Erreur récupération activités récentes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
