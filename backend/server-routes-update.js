// INSTRUCTIONS : Ajouter ce code dans backend/server.js après les routes existantes

// ================================
// NOUVELLES ROUTES - DEVIS & FACTURATION
// ================================

try {
  const devisRoutes = require('./routes/devis');
  const facturesRoutes = require('./routes/factures');
  const tarifsRoutes = require('./routes/tarifs');
  const openaiConfigRoutes = require('./routes/openai-config');
  
  if (devisRoutes) {
    app.use('/api/devis', devisRoutes);
    console.log('✅ Route devis montée');
  }
  
  if (facturesRoutes) {
    app.use('/api/factures', facturesRoutes);
    console.log('✅ Route factures montée');
  }
  
  if (tarifsRoutes) {
    app.use('/api/tarifs', tarifsRoutes);
    console.log('✅ Route tarifs montée');
  }
  
  if (openaiConfigRoutes) {
    app.use('/api/settings/openai', openaiConfigRoutes);
    console.log('✅ Route openai-config montée');
  }
} catch (error) {
  console.warn('⚠️  Erreur chargement routes devis/facturation:', error.message);
}

// Mise à jour de la liste des endpoints dans app.get('/api')
// Ajouter dans l'objet endpoints :
/*
{
  ...
  devis: '/api/devis',
  factures: '/api/factures',
  tarifs: '/api/tarifs',
  'openai-config': '/api/settings/openai'
}
*/
