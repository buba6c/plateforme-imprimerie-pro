const express = require('express');
const cors = require('cors');
const http = require('http');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const server = http.createServer(app);

// Variables d'environnement
const PORT = process.env.PORT || 5001;
const publicApiUrl = process.env.PUBLIC_API_URL || `http://localhost:${PORT}`;

// ================================
// CONFIGURATION SWAGGER
// ================================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Plateforme Imprimerie',
      version: '1.0.0',
      description: 'Documentation de l\'API de la plateforme d\'imprimerie numérique',
    },
    servers: [{ url: publicApiUrl }],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ================================
// SERVICES
// ================================
const socketService = require('./services/socketService');
socketService.configureSocketServer(server);

// ================================
// MIDDLEWARE GLOBAL
// ================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de logs
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ================================
// ROUTES
// ================================

// Route de santé
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    database: 'connected',
    memory: process.memoryUsage(),
  };
  
  res.status(200).json(healthCheck);
});

// Import et utilisation des routes
try {
  const authRoutes = require('./routes/auth');
  const dossiersRoutes = require('./routes/dossiers');
  const filesRoutes = require('./routes/files');
  const usersRoutes = require('./routes/users');
  const statistiquesRoutes = require('./routes/statistiques');
  const activitesRecentesRoutes = require('./routes/activites-recentes');
  const systemConfigRoutes = require('./routes/system-config');

  // Montage des routes
  if (authRoutes) app.use('/api/auth', authRoutes);
  if (dossiersRoutes) app.use('/api/dossiers', dossiersRoutes);
  if (filesRoutes) app.use('/api/files', filesRoutes);
  if (usersRoutes) app.use('/api/users', usersRoutes);
  if (statistiquesRoutes) app.use('/api/statistiques', statistiquesRoutes);
  if (activitesRecentesRoutes) app.use('/api/activites-recentes', activitesRecentesRoutes);
  if (systemConfigRoutes) app.use('/api/system-config', systemConfigRoutes);
  
} catch (error) {
  console.error('Erreur chargement des routes:', error.message);
}

// Route de base API
app.get('/api', (req, res) => {
  res.json({
    message: 'API Plateforme Imprimerie Numérique',
    version: require('./package.json').version,
    documentation: '/api-docs pour la documentation complète',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      dossiers: '/api/dossiers',
      files: '/api/files',
      users: '/api/users',
      statistiques: '/api/statistiques',
      'activites-recentes': '/api/activites-recentes',
    },
  });
});

// Workflow metadata endpoint
const workflowConstants = require('./constants/workflow');
app.get('/api/workflow/meta', (req, res) => {
  const statusCodes = workflowConstants.STATUTS;
  const statusLabels = {
    en_cours: 'En cours',
    a_revoir: 'À revoir', 
    en_impression: 'En impression',
    termine: 'Terminé',
    en_livraison: 'En livraison',
    livre: 'Livré',
  };

  res.json({
    statuses: statusCodes,
    statuts: statusCodes, // Alias français
    status_labels: statusLabels,
    comment_required_for: Array.from(workflowConstants.COMMENT_REQUIRED_FOR),
    version: 2,
    generated_at: new Date().toISOString(),
  });
});

// ================================
// MIDDLEWARE DE COMPATIBILITÉ
// ================================
app.use((req, res, next) => {
  // Redirection des anciennes routes vers /api/*
  if (!req.url.startsWith('/api/') && !req.url.startsWith('/static/') && req.url !== '/') {
    const newUrl = '/api' + req.url;
    console.log(`Redirection: ${req.url} -> ${newUrl}`);
    return res.redirect(308, newUrl);
  }
  next();
});

// ================================
// GESTION DES ERREURS
// ================================
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  // Erreur JWT
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Token d\'authentification invalide',
      message: err.message
    });
  }
  
  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Erreur de validation',
      details: err.message
    });
  }
  
  // Erreur générique
  res.status(err.status || 500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue',
    timestamp: new Date().toISOString()
  });
});

// ================================
// ROUTE 404
// ================================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'GET /api',
      'GET /api/health', 
      'GET /api-docs',
      'POST /api/auth/login',
      'GET /api/dossiers',
      'GET /api/workflow/meta'
    ]
  });
});

// ================================
// DÉMARRAGE DU SERVEUR
// ================================
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📖 Documentation API: http://localhost:${PORT}/api-docs`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt gracieux du serveur...');
  server.close(() => {
    console.log('Serveur fermé');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu, arrêt gracieux du serveur...');
  server.close(() => {
    console.log('Serveur fermé');
    process.exit(0);
  });
});

module.exports = { app, server };