/**
 * 🧹 Routes de Réinitialisation du Système
 * Endpoint sécurisé pour réinitialiser la plateforme
 */

const express = require('express');
const router = express.Router();
const { resetPlatform } = require('../scripts/resetPlatform');
const { authenticateToken: auth } = require('../middleware/auth');

/**
 * POST /api/system/reset
 * Réinitialise complètement la plateforme
 * ⚠️ Réservé aux administrateurs uniquement
 */
router.post('/reset', auth, async (req, res) => {
  // Garde-fou : la réinitialisation est désactivée sauf activation explicite côté serveur
  if (process.env.ALLOW_SYSTEM_RESET !== 'true') {
    console.warn(`⛔ Tentative de réinitialisation refusée (ALLOW_SYSTEM_RESET non activé) - utilisateur ${req.user?.id}`);
    return res.status(403).json({
      success: false,
      error: 'La réinitialisation de la plateforme est désactivée sur ce serveur. '
        + 'Pour l\'autoriser, un administrateur système doit définir ALLOW_SYSTEM_RESET=true '
        + 'puis redémarrer le serveur (faites une sauvegarde complète avant).'
    });
  }

  try {
    console.log('🧹 Demande de réinitialisation reçue');
    console.log('👤 Utilisateur:', req.user?.prenom, req.user?.nom, `(${req.user?.role})`);

    // Vérifier que l'utilisateur est administrateur
    if (!req.user || req.user.role !== 'admin') {
      console.log('❌ Accès refusé: utilisateur non admin');
      return res.status(403).json({
        success: false,
        error: 'Accès refusé. Seuls les administrateurs peuvent réinitialiser la plateforme.'
      });
    }

    // Vérifier le mot de confirmation
    const { confirmation } = req.body;
    if (confirmation !== 'RESET') {
      console.log('❌ Confirmation incorrecte:', confirmation);
      return res.status(400).json({
        success: false,
        error: 'Confirmation incorrecte. Veuillez taper "RESET" pour confirmer.'
      });
    }

    console.log('✅ Confirmation validée, démarrage de la réinitialisation...');

    // Exécuter la réinitialisation
    const result = await resetPlatform();

    console.log('✅ Réinitialisation terminée avec succès');

    res.json({
      success: true,
      message: 'Plateforme réinitialisée avec succès',
      data: result
    });

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation',
      details: error.message
    });
  }
});

/**
 * GET /api/system/reset/stats
 * Récupère les statistiques avant réinitialisation
 * Pour afficher un aperçu de ce qui sera supprimé
 */
router.get('/reset/stats', auth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est administrateur
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }

    const db = require('../config/database');

    // Compter les enregistrements
    const countRecords = async (tableName) => {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        return parseInt(result.rows[0].count);
      } catch (error) {
        return 0;
      }
    };

    const stats = {
      dossiers: await countRecords('dossiers'),
      paiements: await countRecords('paiements'),
      factures: await countRecords('factures'),
      devis: await countRecords('devis'),
      historique: await countRecords('historique_statuts'),
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router;
