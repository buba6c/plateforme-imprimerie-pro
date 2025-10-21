const express = require('express');
const router = express.Router();

// Route temporaire pour les dossiers - version simplifiée pour debug
router.get('/', async (req, res) => {
  try {
    // Simulation d'une réponse simple pour tester la connectivité
    res.json({
      message: 'Route dossiers temporaire - en cours de diagnostic',
      timestamp: new Date().toISOString(),
      status: 'ok'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur route dossiers temporaire',
      message: error.message
    });
  }
});

// Route pour lister les dossiers (version simplifiée)
router.get('/list', async (req, res) => {
  try {
    // Pour l'instant, retourner une liste vide pour éviter les erreurs de DB
    res.json({
      dossiers: [],
      total: 0,
      message: 'Route temporaire - base de données en cours de diagnostic'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur liste dossiers',
      message: error.message
    });
  }
});

module.exports = router;