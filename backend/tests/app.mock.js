const express = require('express');
const app = express();
const workflow = require('../services/workflow-adapter');

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/dossiers', (req, res) => {
  res.json({ dossiers: [] });
});

// Endpoint mock pour tester les transitions de workflow
app.patch('/api/dossiers/:id/status', (req, res) => {
  try {
    const dossierId = req.params.id;
    const { status, comment, dossierType } = req.body || {};

    // Simuler un utilisateur depuis les headers comme dans les tests
    const role = req.headers['x-user-role'] || 'preparateur';
    const userId = parseInt(req.headers['x-user-id'] || '42', 10);
    const user = { id: userId, role };

    // Dossier simulé: statut initial en_cours sauf si besoin de varier
    const dossier = {
      id: dossierId,
      statut: 'en_cours',
      type: dossierType || 'roland', // important pour imprimeur_roland/xerox
      preparateur_id: 42,
    };

    // Cas particulier: l'admin peut forcer toutes transitions
    if (role === 'admin') {
      return res.status(200).json({ success: true, dossier_id: dossierId, new_status: status });
    }

    // Règle: a_revoir nécessite un commentaire (hors admin)
    if (status === 'a_revoir' && (!comment || !String(comment).trim())) {
      return res.status(400).json({ code: 'COMMENT_REQUIRED', message: 'Un commentaire est requis' });
    }

    const check = workflow.canTransition(user, dossier, status);
    if (!check.allowed) {
      return res.status(403).json({ code: 'STATUS_CHANGE_DENIED', message: check.reason });
    }

    // Succès
    return res.status(200).json({ success: true, dossier_id: dossierId, new_status: status });
  } catch (error) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: error.message });
  }
});

module.exports = app;
