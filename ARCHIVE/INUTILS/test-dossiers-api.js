#!/usr/bin/env node

/**
 * Test simple de l'endpoint dossiers pour déboguer
 */

const express = require('express');
const { query } = require('./config/database');

const app = express();
app.use(express.json());

// Route de test simple
app.get('/test-dossiers', (req, res) => {
  res.status(501).json({ error: 'Route not implemented yet' });
}) => {
  try {
    console.log('🧪 Test requête dossiers...');

    const result = await query(`
            SELECT 
                id, numero_commande, client_nom, type, status,
                created_at, updated_at
            FROM dossiers 
            ORDER BY created_at DESC
        `);

    console.log(`✅ Trouvé ${result.rows.length} dossiers`);

    res.json({
      success: true,
      count: result.rows.length,
      dossiers: result.rows,
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({
      error: error.message,
      details: error,
    });
  }
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`🧪 Serveur de test démarré sur port ${PORT}`);
});
