/**
 * Service centralisé pour la gestion des événements Socket.IO
 * Synchronisation temps réel des dossiers, fichiers, et statuts
 */

let io = null;

/**
 * Initialise Socket.IO avec le serveur HTTP
 * @param {object} httpServer - Serveur HTTP Express
 * @param {object} corsOptions - Options CORS pour Socket.IO
 */
const initSocketIO = (httpServer, corsOptions) => {
  const socketIO = require('socket.io');
  
  io = socketIO(httpServer, {
    cors: corsOptions || {
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // 🔒 Middleware d'authentification Socket.IO (optionnel mais recommandé)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    // Si aucun token, accepter quand même la connexion (pour compatibilité)
    if (!token || token === 'undefined' || token === 'null') {
      console.warn(`⚠️  Socket ${socket.id} connecté sans token (mode anonyme)`);
      socket.authenticated = false;
      return next();
    }
    
    // Valider le token JWT
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'imprimerie_jwt_secret_key_2024_super_secure';
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      socket.authenticated = true;
      next();
    } catch (error) {
      console.error(`❌ Erreur authentification Socket.IO: ${error.message}`);
      // Ne pas bloquer la connexion, juste marquer comme non authentifié
      socket.authenticated = false;
      next();
    }
  });
  
  // Gestion des connexions
  io.on('connection', socket => {
    const authStatus = socket.authenticated ? '🔒 Authentifié' : '🔓 Anonyme';
    console.log(`✅ Client Socket.IO connecté: ${socket.id} (${authStatus})`);

    // Si l'utilisateur est authentifié, le faire rejoindre sa room personnelle pour les notifications
    if (socket.authenticated && socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
      console.log(`👤 Socket ${socket.id} a rejoint user:${socket.user.id}`);
      
      if (socket.user.role) {
        socket.join(`role:${socket.user.role}`);
        console.log(`🎭 Socket ${socket.id} a rejoint le rôle role:${socket.user.role}`);
      }
    }

    // Rejoindre une room pour un dossier spécifique
    socket.on('join:dossier', folderId => {
      socket.join(`dossier:${folderId}`);
      console.log(`📂 Socket ${socket.id} a rejoint le dossier ${folderId}`);
    });

    // Quitter une room de dossier
    socket.on('leave:dossier', folderId => {
      socket.leave(`dossier:${folderId}`);
      console.log(`📂 Socket ${socket.id} a quitté le dossier ${folderId}`);
    });

    // Rejoindre une room pour tous les dossiers (dashboard admin/operateur)
    socket.on('join:all_dossiers', () => {
      socket.join('all_dossiers');
      console.log(`📊 Socket ${socket.id} a rejoint all_dossiers`);
    });

    // Quitter la room de tous les dossiers
    socket.on('leave:all_dossiers', () => {
      socket.leave('all_dossiers');
      console.log(`📊 Socket ${socket.id} a quitté all_dossiers`);
    });

    // Ping/pong pour maintenir la connexion
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Déconnexion
    socket.on('disconnect', reason => {
      console.log(`❌ Client Socket.IO déconnecté: ${socket.id} (${reason})`);
    });
  });

  console.log('🚀 Socket.IO initialisé avec succès');
  return io;
};

/**
 * Obtient l'instance Socket.IO
 * @returns {object|null} - Instance Socket.IO ou null
 */
const getIO = () => {
  if (!io) {
    console.warn('⚠️ Socket.IO non initialisé. Appelez initSocketIO() d\'abord.');
  }
  return io;
};

/**
 * Événements de dossiers
 */

/**
 * Émet un événement de création de dossier
 * @param {object} dossier - Dossier créé
 */
const emitDossierCreated = dossier => {
  if (!io) return;
  
  // Émettre à tous ceux qui suivent tous les dossiers
  io.to('all_dossiers').emit('dossier:created', {
    dossier,
    timestamp: new Date().toISOString(),
  });

  console.log(`📢 Événement dossier:created émis pour ${dossier.folder_id}`);
};

/**
 * Émet un événement de mise à jour de dossier
 * @param {object} dossier - Dossier mis à jour
 * @param {object} changes - Changements effectués
 */
const emitDossierUpdated = (dossier, changes = {}) => {
  if (!io) return;

  const payload = {
    dossier,
    changes,
    timestamp: new Date().toISOString(),
  };

  // Émettre à la room du dossier spécifique
  io.to(`dossier:${dossier.folder_id}`).emit('dossier:updated', payload);
  
  // Émettre aussi à tous les dossiers
  io.to('all_dossiers').emit('dossier:updated', payload);

  console.log(`📢 Événement dossier:updated émis pour ${dossier.folder_id}`);
};

/**
 * Émet un événement de suppression de dossier
 * @param {string} folderId - UUID du dossier supprimé
 * @param {object} metadata - Métadonnées du dossier supprimé
 */
const emitDossierDeleted = (folderId, metadata = {}) => {
  if (!io) return;

  const payload = {
    folderId,
    metadata,
    timestamp: new Date().toISOString(),
  };

  // Émettre à la room du dossier
  io.to(`dossier:${folderId}`).emit('dossier:deleted', payload);
  
  // Émettre aussi à tous les dossiers
  io.to('all_dossiers').emit('dossier:deleted', payload);

  console.log(`📢 Événement dossier:deleted émis pour ${folderId}`);
};

/**
 * Émet un événement de changement de statut
 * @param {string} folderId - UUID du dossier
 * @param {string} oldStatus - Ancien statut
 * @param {string} newStatus - Nouveau statut
 * @param {object} dossier - Dossier complet (optionnel)
 */
const emitStatusChanged = (folderId, oldStatus, newStatus, dossier = null) => {
  if (!io) return;

  const payload = {
    folderId,
    oldStatus,
    newStatus,
    dossier,
    timestamp: new Date().toISOString(),
  };

  // Émettre à la room du dossier
  io.to(`dossier:${folderId}`).emit('status:changed', payload);
  
  // Émettre aussi à tous les dossiers
  io.to('all_dossiers').emit('status:changed', payload);

  console.log(`📢 Événement status:changed émis pour ${folderId}: ${oldStatus} → ${newStatus}`);
};

/**
 * Événements de fichiers
 */

/**
 * Émet un événement d'upload de fichier
 * @param {string} folderId - UUID du dossier
 * @param {object} file - Fichier uploadé
 */
const emitFileUploaded = (folderId, file) => {
  if (!io) return;

  const payload = {
    folderId,
    file,
    timestamp: new Date().toISOString(),
  };

  // Émettre à la room du dossier
  io.to(`dossier:${folderId}`).emit('file:uploaded', payload);
  
  // Émettre aussi à tous les dossiers (pour stats)
  io.to('all_dossiers').emit('file:uploaded', payload);

  console.log(`📢 Événement file:uploaded émis pour dossier ${folderId}: ${file.nom_fichier}`);
};

/**
 * Émet un événement de suppression de fichier
 * @param {string} folderId - UUID du dossier
 * @param {string} fileId - ID du fichier supprimé
 * @param {string} fileName - Nom du fichier supprimé
 */
const emitFileDeleted = (folderId, fileId, fileName) => {
  if (!io) return;

  const payload = {
    folderId,
    fileId,
    fileName,
    timestamp: new Date().toISOString(),
  };

  // Émettre à la room du dossier
  io.to(`dossier:${folderId}`).emit('file:deleted', payload);
  
  // Émettre aussi à tous les dossiers
  io.to('all_dossiers').emit('file:deleted', payload);

  console.log(`📢 Événement file:deleted émis pour dossier ${folderId}: ${fileName}`);
};

/**
 * Émet un événement de mise à jour de fichier
 * @param {string} folderId - UUID du dossier
 * @param {object} file - Fichier mis à jour
 */
const emitFileUpdated = (folderId, file) => {
  if (!io) return;

  const payload = {
    folderId,
    file,
    timestamp: new Date().toISOString(),
  };

  // Émettre à la room du dossier
  io.to(`dossier:${folderId}`).emit('file:updated', payload);

  console.log(`📢 Événement file:updated émis pour dossier ${folderId}: ${file.nom_fichier}`);
};

/**
 * Événements d'assignation
 */

/**
 * Émet un événement d'assignation de machine
 * @param {string} folderId - UUID du dossier
 * @param {number} machineId - ID de la machine
 * @param {string} machineName - Nom de la machine
 */
const emitMachineAssigned = (folderId, machineId, machineName) => {
  if (!io) return;

  const payload = {
    folderId,
    machineId,
    machineName,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('machine:assigned', payload);
  io.to('all_dossiers').emit('machine:assigned', payload);

  console.log(`📢 Événement machine:assigned émis pour ${folderId}: ${machineName}`);
};

/**
 * Émet un événement de notification générique
 * @param {string} userId - ID de l'utilisateur cible (null = tous)
 * @param {string} type - Type de notification (info, success, warning, error)
 * @param {string} message - Message de notification
 * @param {object} data - Données supplémentaires
 */
const emitNotification = (userId, type, message, data = {}) => {
  if (!io) return;

  const payload = {
    type,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  if (userId) {
    // Notification pour un utilisateur spécifique
    io.to(`user:${userId}`).emit('notification', payload);
  } else {
    // Notification globale
    io.emit('notification', payload);
  }

  console.log(`📢 Notification émise: ${type} - ${message}`);
};

/**
 * Événements de statistiques/dashboard
 */

/**
 * Émet des statistiques mises à jour
 * @param {object} stats - Statistiques mises à jour
 */
const emitStatsUpdated = stats => {
  if (!io) return;

  io.to('all_dossiers').emit('stats:updated', {
    stats,
    timestamp: new Date().toISOString(),
  });

  console.log('📢 Événement stats:updated émis');
};

module.exports = {
  initSocketIO,
  getIO,
  
  // Événements dossiers
  emitDossierCreated,
  emitDossierUpdated,
  emitDossierDeleted,
  emitStatusChanged,
  
  // Événements fichiers
  emitFileUploaded,
  emitFileDeleted,
  emitFileUpdated,
  
  // Événements assignation
  emitMachineAssigned,
  
  emitNotification,
  
  /**
   * Émet une notification à tout un rôle
   * @param {string} role - Rôle cible (ex: imprimeur_roland)
   * @param {string} type - Type de notification
   * @param {string} message - Message
   * @param {object} data - Données supplémentaires
   */
  emitNotificationToRole: (role, type, message, data = {}) => {
    if (!io) return;
    const payload = {
      type,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    io.to(`role:${role}`).emit('notification', payload);
    console.log(`📢 Notification émise au rôle ${role}: ${type} - ${message}`);
  },
  
  // Statistiques
  emitStatsUpdated,
};
