const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const statistiquesService = require('../services/statistiques');

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

/**
 * GET /api/statistiques/dashboard
 * Obtenir le dashboard complet avec toutes les statistiques
 */
router.get('/dashboard', authorizeRoles(['admin', 'preparateur']), async (req, res) => {
  try {
    const { periode = 'month' } = req.query;

    console.log(
      `📊 Génération dashboard complet - Période: ${periode} - Utilisateur: ${req.user.nom}`
    );

    const dashboard = await statistiquesService.getDashboardComplet(periode);

    res.json({
      success: true,
      data: dashboard,
      message: 'Dashboard généré avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur génération dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/generales
 * Obtenir les statistiques générales
 */
router.get('/generales', authorizeRoles(['admin', 'preparateur']), async (req, res) => {
  try {
    const { periode = 'month' } = req.query;

    const stats = await statistiquesService.getStatistiquesGenerales(periode);

    res.json({
      success: true,
      data: stats,
      message: 'Statistiques générales récupérées',
    });
  } catch (error) {
    console.error('❌ Erreur statistiques générales:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques générales',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/performances
 * Obtenir les performances des utilisateurs
 */
router.get('/performances', authorizeRoles(['admin', 'preparateur']), async (req, res) => {
  try {
    const { periode = 'month' } = req.query;

    const performances = await statistiquesService.getPerformancesUtilisateurs(periode);

    res.json({
      success: true,
      data: performances,
      message: 'Performances utilisateurs récupérées',
    });
  } catch (error) {
    console.error('❌ Erreur performances utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des performances',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/evolution
 * Obtenir l'évolution des dossiers dans le temps
 */
router.get('/evolution', authorizeRoles(['admin', 'preparateur']), async (req, res) => {
  try {
    const { periode = 'month' } = req.query;

    const evolution = await statistiquesService.getEvolutionDossiers(periode);

    res.json({
      success: true,
      data: evolution,
      message: 'Évolution des dossiers récupérée',
    });
  } catch (error) {
    console.error('❌ Erreur évolution dossiers:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de l'évolution",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/machines
 * Obtenir la répartition par type de machine/imprimante
 */
router.get('/machines', authorizeRoles(['admin', 'preparateur']), async (req, res) => {
  try {
    const { periode = 'month' } = req.query;

    const repartition = await statistiquesService.getRepartitionMachines(periode);

    res.json({
      success: true,
      data: repartition,
      message: 'Répartition machines récupérée',
    });
  } catch (error) {
    console.error('❌ Erreur répartition machines:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la répartition machines',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/alertes
 * Obtenir les alertes et indicateurs critiques
 */
router.get('/alertes', async (req, res) => {
  try {
    const alertes = await statistiquesService.getAlertes();

    res.json({
      success: true,
      data: alertes,
      message: 'Alertes récupérées',
    });
  } catch (error) {
    console.error('❌ Erreur alertes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des alertes',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/summary
 * Obtenir un résumé rapide pour le header/navigation
 */
router.get('/summary', async (req, res) => {
  try {
    const [alertes, statsGenerales] = await Promise.all([
      statistiquesService.getAlertes(),
      statistiquesService.getStatistiquesGenerales('today'),
    ]);

    const summary = {
      dossiers_actifs: statsGenerales.total_actifs,
      nouveaux_aujourd_hui: statsGenerales.nouveaux_aujourd_hui,
      dossiers_urgents: alertes.dossiers_urgents_en_retard,
      dossiers_a_revoir: alertes.dossiers_a_revoir,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: summary,
      message: 'Résumé récupéré',
    });
  } catch (error) {
    console.error('❌ Erreur résumé:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du résumé',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * POST /api/statistiques/cache/clear
 * Vider le cache des statistiques (admin uniquement)
 */
router.post('/cache/clear', authorizeRoles(['admin']), async (req, res) => {
  try {
    statistiquesService.clearCache();

    console.log(`🗑️  Cache statistiques vidé par: ${req.user.nom}`);

    res.json({
      success: true,
      message: 'Cache des statistiques vidé avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur vidage cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du vidage du cache',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * GET /api/statistiques/export
 * Exporter les statistiques en CSV (admin/preparateur uniquement)
 */
router.get('/export', authorizeRoles(['admin', 'preparateur']), async (req, res) => {
  try {
    const { periode = 'month', type = 'dashboard' } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'performances':
        data = await statistiquesService.getPerformancesUtilisateurs(periode);
        filename = `performances_utilisateurs_${periode}_${Date.now()}.csv`;
        break;
      case 'evolution':
        data = await statistiquesService.getEvolutionDossiers(periode);
        filename = `evolution_dossiers_${periode}_${Date.now()}.csv`;
        break;
      case 'machines':
        data = await statistiquesService.getRepartitionMachines(periode);
        filename = `repartition_machines_${periode}_${Date.now()}.csv`;
        break;
      default:
        data = await statistiquesService.getDashboardComplet(periode);
        filename = `dashboard_complet_${periode}_${Date.now()}.csv`;
    }

    // Conversion simple en CSV (pour une vraie app, utiliser une lib comme csv-writer)
    const csvContent = convertToCSV(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

    console.log(
      `📊 Export statistiques - Type: ${type} - Période: ${periode} - Utilisateur: ${req.user.nom}`
    );
  } catch (error) {
    console.error('❌ Erreur export statistiques:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'export des statistiques",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
    });
  }
});

/**
 * Utilitaire pour convertir des données en CSV simple
 */
function convertToCSV(data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return 'Aucune donnée disponible';
  }

  if (!Array.isArray(data)) {
    // Si c'est un objet (dashboard complet), on flatten
    const flattened = [];
    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key])) {
        flattened.push(...data[key]);
      } else if (typeof data[key] === 'object') {
        flattened.push(data[key]);
      }
    });
    data = flattened;
  }

  if (data.length === 0) return 'Aucune donnée disponible';

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // En-têtes
    ...data.map(row =>
      headers
        .map(header => {
          const value = row[header];
          // Échapper les guillemets et virgules
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(',')
    ),
  ];

  return csvRows.join('\n');
}

module.exports = router;
