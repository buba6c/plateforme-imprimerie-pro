const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Configuration des variables d'environnement
require('dotenv').config();

// Initialiser Express
const app = express();
const server = http.createServer(app);

// express-list-endpoints pour audit des routes (doit être importé après app)
const listEndpoints = require('express-list-endpoints');

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const publicApiUrl = process.env.BACKEND_PUBLIC_URL || 'http://localhost:5001/api';
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Plateforme Imprimerie API',
      version: '1.0.0',
      description: 'Documentation interactive des routes API de la plateforme.',
    },
    servers: [{ url: publicApiUrl }],
  },
  apis: ['./routes/*.js'], // Documentation auto des routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Importer le service Socket.IO centralisé
const socketService = require('./services/socketService');

// Configuration Socket.IO avec CORS via le service
const io = socketService.initSocketIO(server, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});

console.log('🔌 Socket.IO initialisé et prêt pour synchronisation temps réel');

// Configuration du stream de logs
const logStream = fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' });

// Configuration des middlewares de sécurité
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// Configuration CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Middlewares généraux
app.use(compression());
app.use(morgan('combined', { stream: logStream }));

// Middleware pour rendre Socket.IO disponible dans les routes
app.use((req, res, next) => {
  req.app.set('io', io);
  next();
});
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Configuration du rate limiting
// Désactivation du rate limiting en développement
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par windowMs
    message: {
      error: 'Trop de requêtes, veuillez réessayer plus tard.',
      retryAfter: Math.round((15 * 60 * 1000) / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
}

// Créer les dossiers nécessaires
const ensureDirectoryExists = dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Dossier créé: ${dirPath}`);
  }

ensureDirectoryExists('./uploads');
ensureDirectoryExists('./logs');

// Middleware pour les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import des modules de base de données et services
let db;
try {
  db = require('./config/database');
  console.log('📊 Connexion base de données PostgreSQL initialisée');
} catch (error) {
  console.error('❌ Erreur connexion base de données:', error.message);
}

// Import des routes
let authRoutes,
  dossiersRoutes,
  usersRoutes,
  filesRoutes,
  statistiquesRoutes,
  activitesRecentesRoutes,
  systemConfigRoutes;
// Import workflow constants (exposé plus tard)
const workflowConstants = require('./constants/workflow');

try {
  const authModule = require('./routes/auth');
  authRoutes = authModule.router || authModule;
  dossiersRoutes = require('./routes/dossiers');
  usersRoutes = require('./routes/users');
  filesRoutes = require('./routes/files');
  statistiquesRoutes = require('./routes/statistiques');
  activitesRecentesRoutes = require('./routes/activites-recentes');
  systemConfigRoutes = require('./routes/system-config');

  console.log('🛣️  Routes chargées avec succès');
} catch (error) {
  console.error('❌ Erreur chargement routes:', error.message);
  if (error?.stack) {
    console.error('🔍 Stack trace routes:', error.stack);
  }
}

// ================================
// API ROUTES
// ================================

// Route de santé (obligatoire)
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    database: db ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
  };
  
  res.status(200).json(healthCheck);
});

// Middleware de compatibilité: réécritures des anciennes routes sans préfixe /api
app.use((req, res, next) => {
  try {
    const p = req.path || '';
    const needsApiPrefix =
      p.startsWith('/auth') ||
      p.startsWith('/users') ||
      p.startsWith('/dossiers') ||
      p.startsWith('/files') ||
      p.startsWith('/statistiques') ||
      p.startsWith('/activites-recentes') ||
      p.startsWith('/system-config');
    if (!p.startsWith('/api') && needsApiPrefix) {
      // Réécrire l'URL pour pointer vers les routes /api/*
      req.url = `/api${req.url}`;
    }
  } catch (compatibilityError) {
    console.warn('⚠️ Erreur middleware compatibilité:', compatibilityError.message);
  }
  next();
});

// Routes API
if (authRoutes) app.use('/api/auth', authRoutes);
if (dossiersRoutes) app.use('/api/dossiers', dossiersRoutes);
if (usersRoutes) app.use('/api/users', usersRoutes);
if (filesRoutes) app.use('/api/files', filesRoutes);
if (statistiquesRoutes) app.use('/api/statistiques', statistiquesRoutes);
if (activitesRecentesRoutes) app.use('/api/activites-recentes', activitesRecentesRoutes);
if (systemConfigRoutes) app.use('/api/system-config', systemConfigRoutes);
// Endpoint meta workflow
app.get('/api/workflow/meta', (req, res) => {
  res.status(501).json({ error: 'Route not implemented yet' });
});
  // Fournir des métadonnées de workflow avec compatibilité FR/EN pour la clé des statuts
  // - statuses: tableau des codes (clé anglaise)
  // - statuts: alias français pour compat (clé historique)
  // - status_labels: mapping code -> libellé FR pour affichage côté clients
  const statusCodes = workflowConstants.STATUTS;
  const statusLabels = {
    en_cours: 'En cours',
    a_revoir: 'À revoir',
    en_impression: 'En impression',
    termine: 'Terminé',
    en_livraison: 'En livraison',
    livre: 'Livré',
  res.json({
    statuses: statusCodes,
    statuts: statusCodes, // alias de compatibilité
    status_labels: statusLabels,
    roles: workflowConstants.ROLES,
    transitions: workflowConstants.ROLE_TRANSITIONS,
    comment_required_for: Array.from(workflowConstants.COMMENT_REQUIRED_FOR),
    version: 2,
    generated_at: new Date().toISOString(),
  });
});

// Route de base
app.get('/api', (req, res) => {
  res.json({
    message: 'API Plateforme Imprimerie Numérique',
    version: require('./package.json').version,
    documentation: '/api/health pour vérifier le statut',
    endpoints: {
      auth: '/api/auth',
      dossiers: '/api/dossiers',
      users: '/api/users',
      files: '/api/files',
      statistiques: '/api/statistiques',
      activites_recentes: '/api/activites-recentes',
    },
  });
});

// Endpoint pour lister toutes les routes de la plateforme (audit)
app.get('/api/routes', (req, res) => {
  res.status(501).json({ error: 'Route not implemented yet' });
});
  const endpoints = listEndpoints(app);
  res.json({ success: true, routes: endpoints });
});

// ================================
// SOCKET.IO CONFIGURATION AVANCÉE
// ================================

const NotificationService = require('./services/notifications');

// Initialiser le service de notifications
const notificationService = new NotificationService(io);

// Rendre le service disponible globalement
global.notificationService = notificationService;

// Fonction de compatibilité pour l'ancien broadcastNotification
const broadcastNotification = (event, data) => {
  notificationService.sendToAll(event, data);

global.broadcastNotification = broadcastNotification;

// Nettoyage périodique des connexions inactives
setInterval(
  () => {
    notificationService.cleanInactiveConnections();
  },
  10 * 60 * 1000
); // Toutes les 10 minutes

// Route pour obtenir les statistiques de connexion (admin uniquement)
app.get('/api/notifications/stats', (req, res) => {
  res.status(501).json({ error: 'Route not implemented yet' });
});
  try {
    const stats = notificationService.getConnectionStats();
  res.json(stats);
  } catch (statsError) {
    console.error('❌ Erreur récupération statistiques:', statsError.message);
    res.status(500).json({
      error: 'Erreur récupération statistiques',
      details: process.env.NODE_ENV !== 'production' ? statsError.message : undefined,
    });
  }
});

// ================================
// ERROR HANDLING
// ================================

// Middleware de gestion d'erreurs 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Middleware de gestion d'erreurs globales
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  // next n'est pas utilisé car c'est le middleware final d'erreur
  console.error('❌ Erreur serveur:', error);

  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
});

// ================================
// DÉMARRAGE DU SERVEUR
// ================================

const PORT = process.env.PORT || 5001;

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 ===============================================');
  console.log('🚀 PLATEFORME IMPRIMERIE NUMÉRIQUE - BACKEND');
  console.log('🚀 ===============================================');
  console.log(`📡 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.IO: Actif sur le même port`);
  console.log(`🗄️  Base de données: ${db ? '✅ Connectée' : '❌ Déconnectée'}`);
  console.log(`📁 Dossier uploads: ./uploads`);
  console.log(`📋 Logs: ./logs`);
  console.log('===============================================');

  // Signaler à PM2 que l'application est prête
  if (process.send) {
    process.send('ready');
  }
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt en cours...');
  server.close(async () => {
    try {
      if (db && typeof db.safeClosePool === 'function') {
        await db.safeClosePool();
      } else if (db && typeof db.closePool === 'function') {
        await db.closePool();
      }
    } catch (e) {
      console.error('❌ Erreur fermeture pool:', e.message);
    }
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Signal SIGINT reçu, arrêt en cours...');
  server.close(async () => {
    try {
      if (db && typeof db.safeClosePool === 'function') {
        await db.safeClosePool();
      } else if (db && typeof db.closePool === 'function') {
        await db.closePool();
      }
    } catch (e) {
      console.error('❌ Erreur fermeture pool:', e.message);
    }
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});

module.exports = { app, server, io };
