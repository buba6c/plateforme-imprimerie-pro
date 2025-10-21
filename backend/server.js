const express = require('express');
const cors = require('cors');
const http = require('http');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

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
socketService.initSocketIO(server, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});

// ================================
// MIDDLEWARE GLOBAL
// ================================
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives de connexion, réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const estimateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/devis/estimate-realtime', estimateLimiter);

// Configuration CORS pour production et développement
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://imprimerie-frontend.onrender.com',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    console.log('🚫 CORS bloqué pour:', origin);
    callback(new Error('Non autorisé par CORS'));
  },
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
  const systemConfigRoutes = require('./routes/system-config');
  
  // Montage des routes principales
  if (authRoutes) {
    app.use('/api/auth', authRoutes);
    console.log('✅ Route auth montée');
  }
  if (dossiersRoutes) {
    app.use('/api/dossiers', dossiersRoutes);
    console.log('✅ Route dossiers montée');
  }
  if (systemConfigRoutes) {
    app.use('/api/system-config', systemConfigRoutes);
      // Alias pour compatibilité : /dossiers → /api/dossiers
      app.use('/dossiers', dossiersRoutes);
      console.log('✅ Alias /dossiers monté');
    console.log('✅ Route system-config montée');
  }
  
  // Chargement des autres routes (si pas d'erreur)
  try {
    const filesRoutes = require('./routes/files');
    const usersRoutes = require('./routes/users');
    const statistiquesRoutes = require('./routes/statistiques');
    const activitesRecentesRoutes = require('./routes/activites-recentes');
    const themesRoutes = require('./routes/themes');
    
    // Routes Devis & Facturation & Paiements
    const devisRoutes = require('./routes/devis');
    const facturesRoutes = require('./routes/factures');
    const paiementsRoutes = require('./routes/paiements');
    const tarifsRoutes = require('./routes/tarifs');
    const openaiConfigRoutes = require('./routes/openai-config');
    
    if (filesRoutes) {
      app.use('/api/files', filesRoutes);
      console.log('✅ Route files montée');
    }
    if (usersRoutes) {
      app.use('/api/users', usersRoutes);
      console.log('✅ Route users montée');
    }
    if (statistiquesRoutes) {
      app.use('/api/statistiques', statistiquesRoutes);
      console.log('✅ Route statistiques montée');
    }
    if (activitesRecentesRoutes) {
      app.use('/api/activites-recentes', activitesRecentesRoutes);
      console.log('✅ Route activites-recentes montée');
    }
    if (themesRoutes) {
      app.use('/api/themes', themesRoutes);
      console.log('✅ Route themes montée');
    }
    
    // Montage des routes Devis & Facturation
    if (devisRoutes) {
      app.use('/api/devis', devisRoutes);
      console.log('✅ Route devis montée');
    }
    if (facturesRoutes) {
      app.use('/api/factures', facturesRoutes);
      console.log('✅ Route factures montée');
    }
    if (paiementsRoutes) {
      app.use('/api/paiements', paiementsRoutes);
      console.log('✅ Route paiements montée');
    }
    if (tarifsRoutes) {
      app.use('/api/tarifs', tarifsRoutes);
      console.log('✅ Route tarifs montée');
    }
    if (openaiConfigRoutes) {
      app.use('/api/settings/openai', openaiConfigRoutes);
      console.log('✅ Route openai-config montée');
    }
    
    // Route IA Intelligente
    const aiAgentRoutes = require('./routes/aiAgent');
    if (aiAgentRoutes) {
      app.use('/api/ai-agent', aiAgentRoutes);
      console.log('✅ Route ai-agent montée');
    }
    
  } catch (routeError) {
    console.warn('⚠️  Certaines routes secondaires ont des erreurs:', routeError.message);
  }
  
} catch (error) {
  console.error('Erreur chargement des routes principales:', error.message);
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
      themes: '/api/themes',
      devis: '/api/devis',
      factures: '/api/factures',
      paiements: '/api/paiements',
      tarifs: '/api/tarifs',
      'openai-config': '/api/settings/openai',
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