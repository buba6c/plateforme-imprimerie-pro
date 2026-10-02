/**
 * Service centralisé pour la gestion des événements Socket.IO
 * Synchronisation temps réel des dossiers, fichiers, et statuts
 */

const { verifyToken } = require('../config/security');

let io = null;

// Rôles autorisés à suivre TOUS les dossiers (room 'all_dossiers' / 'dossier:<id>')
const FULL_ACCESS_ROLES = ['admin', 'preparateur'];
// Statuts « phase livraison » (mêmes listes que le filtre SQL GET /api/dossiers pour le livreur)
const LIVREUR_STATUTS = ['imprime', 'pret_livraison', 'en_livraison', 'livre', 'termine'];

const normalizeStatut = s => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

/**
 * Machine d'un dossier ('roland' | 'xerox' | null) à partir de type_formulaire / machine.
 */
const machineOf = dossier => {
  if (!dossier || typeof dossier !== 'object') return null;
  const m = String(dossier.type_formulaire || dossier.machine || dossier.type || '').toLowerCase();
  if (m.startsWith('roland')) return 'roland';
  if (m.startsWith('xerox')) return 'xerox';
  return null;
};

/** Copie du dossier sans les champs masqués aux imprimeurs (même règle que filterSensitiveFields). */
const stripForPrinter = dossier => {
  if (!dossier || typeof dossier !== 'object') return dossier;
  const { telephone_client, amount, montant_cfa, ...rest } = dossier; // eslint-disable-line no-unused-vars
  return rest;
};

/**
 * Diffuse un événement « dossier » : intégralement aux admins/préparateurs (room all_dossiers),
 * et, de façon ciblée côté serveur, aux imprimeurs de la bonne machine (sans téléphone ni montants)
 * et aux livreurs pour les dossiers en phase de livraison.
 * @param {string} event
 * @param {object} payload - charge utile complète
 * @param {object|null} dossier - dossier concerné (pour le ciblage)
 * @param {string[]} statuts - statuts à considérer pour le ciblage livreur (ancien/nouveau)
 */
const emitScoped = (event, payload, dossier, statuts = []) => {
  if (!io) return;
  io.to('all_dossiers').emit(event, payload);

  const machine = machineOf(dossier);
  if (machine) {
    io.to(`role_imprimeur_${machine}`).emit(event, {
      ...payload,
      ...(payload && payload.dossier ? { dossier: stripForPrinter(payload.dossier) } : {}),
    });
  }

  const allStatuts = [...statuts, dossier && dossier.statut].map(normalizeStatut);
  if (allStatuts.some(st => LIVREUR_STATUTS.includes(st))) {
    io.to('role_livreur').emit(event, payload);
  }
};

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

  // 🔒 Authentification Socket.IO OBLIGATOIRE : JWT valide + utilisateur actif en base.
  // L'identité (id, rôle) vient UNIQUEMENT du token vérifié et de la base, jamais du client.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || token === 'undefined' || token === 'null') {
      console.warn(`⚠️  Connexion Socket.IO refusée (${socket.id}) : token manquant`);
      return next(new Error('unauthorized'));
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.warn(`⚠️  Connexion Socket.IO refusée (${socket.id}) : token invalide (${error.name})`);
      return next(new Error('unauthorized'));
    }

    try {
      const db = require('../config/database');
      const result = await db.query(
        'SELECT id, nom, email, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      if (result.rows.length === 0) {
        console.warn(`⚠️  Connexion Socket.IO refusée (${socket.id}) : utilisateur inconnu ou inactif`);
        return next(new Error('unauthorized'));
      }
      socket.user = result.rows[0];
      socket.authenticated = true;
      return next();
    } catch (error) {
      console.error(`❌ Erreur vérification utilisateur Socket.IO: ${error.message}`);
      return next(new Error('server_error'));
    }
  });
  
  // Gestion des connexions
  io.on('connection', socket => {
    const { id: userId, role } = socket.user;
    console.log(`✅ Client Socket.IO connecté: ${socket.id} (utilisateur ${userId}, ${role})`);

    // Rooms calculées côté serveur à partir de l'identité vérifiée
    socket.join(`user_${userId}`);
    socket.join(`user:${userId}`); // utilisée par emitNotification()
    socket.join(`role_${role}`);

    const hasFullAccess = FULL_ACCESS_ROLES.includes(role);

    // Rejoindre une room pour un dossier spécifique (admin / préparateur uniquement)
    socket.on('join:dossier', folderId => {
      if (!hasFullAccess) {
        console.warn(`🚫 join:dossier refusé pour ${socket.id} (${role})`);
        return;
      }
      socket.join(`dossier:${folderId}`);
      console.log(`📂 Socket ${socket.id} a rejoint le dossier ${folderId}`);
    });

    // Quitter une room de dossier
    socket.on('leave:dossier', folderId => {
      socket.leave(`dossier:${folderId}`);
      console.log(`📂 Socket ${socket.id} a quitté le dossier ${folderId}`);
    });

    // Rejoindre la room de tous les dossiers : admin et préparateur uniquement.
    // Les imprimeurs/livreurs reçoivent les événements utiles via leur room de rôle (emitScoped).
    socket.on('join:all_dossiers', () => {
      if (!hasFullAccess) {
        console.log(`ℹ️  join:all_dossiers ignoré pour ${socket.id} (${role}) : diffusion ciblée par rôle`);
        return;
      }
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
  
  // Admin/préparateur (all_dossiers) + imprimeurs/livreurs concernés
  emitScoped('dossier:created', {
    dossier,
    timestamp: new Date().toISOString(),
  }, dossier);

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
  
  // Émettre aussi à tous les dossiers (+ imprimeurs/livreurs concernés)
  emitScoped('dossier:updated', payload, dossier);

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
  // Imprimeurs / livreurs : identifiant seulement (pas de métadonnées)
  io.to(['role_imprimeur_roland', 'role_imprimeur_xerox', 'role_livreur']).emit('dossier:deleted', {
    folderId,
    timestamp: payload.timestamp,
  });

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
  
  // Émettre aussi à tous les dossiers (+ imprimeurs de la machine / livreurs si phase livraison)
  emitScoped('status:changed', payload, dossier, [oldStatus, newStatus]);

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
 * Émet une notification à tous les utilisateurs connectés d'un rôle (room 'role_<role>',
 * rejointe côté serveur à la connexion).
 * @param {string} role - ex. 'imprimeur_roland', 'livreur'
 * @param {string} type - Type de notification (ex. 'sound_alert')
 * @param {string} message - Message
 * @param {object} data - Données supplémentaires
 */
const emitNotificationToRole = (role, type, message, data = {}) => {
  if (!io || !role) return;

  io.to(`role_${role}`).emit('notification', {
    type,
    message,
    data,
    timestamp: new Date().toISOString(),
  });

  console.log(`📢 Notification émise au rôle ${role}: ${type} - ${message}`);
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


/**
 * Émet un événement quand une section est ajoutée
 * @param {number} folderId - ID du dossier
 * @param {object} section - Nouvelle section ajoutée
 * @param {number} sectionIndex - Index de la section dans le tableau
 */
const emitSectionAdded = (folderId, section, sectionIndex) => {
  if (!io) return;

  const eventData = {
    folderId,
    section,
    sectionIndex,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('dossier:section:added', eventData);
  io.to('all_dossiers').emit('dossier:section:added', eventData);

  console.log(`📑 Section ajoutée au dossier ${folderId} (index: ${sectionIndex})`);
};

/**
 * Émet un événement quand une section est mise à jour
 * @param {number} folderId - ID du dossier
 * @param {object} section - Section mise à jour
 * @param {number} sectionIndex - Index de la section
 */
const emitSectionUpdated = (folderId, section, sectionIndex) => {
  if (!io) return;

  const eventData = {
    folderId,
    section,
    sectionIndex,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('dossier:section:updated', eventData);
  io.to('all_dossiers').emit('dossier:section:updated', eventData);

  console.log(`📝 Section ${sectionIndex} mise à jour dans le dossier ${folderId}`);
};

/**
 * Émet un événement quand une section est supprimée
 * @param {number} folderId - ID du dossier
 * @param {number} sectionIndex - Index de la section supprimée
 */
const emitSectionRemoved = (folderId, sectionIndex) => {
  if (!io) return;

  const eventData = {
    folderId,
    sectionIndex,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('dossier:section:removed', eventData);
  io.to('all_dossiers').emit('dossier:section:removed', eventData);

  console.log(`🗑️  Section ${sectionIndex} supprimée du dossier ${folderId}`);
};

/**
 * Émet un événement quand un support est ajouté (Roland)
 * @param {number} folderId - ID du dossier
 * @param {object} support - Nouveau support ajouté
 * @param {number} supportIndex - Index du support
 */
const emitSupportAdded = (folderId, support, supportIndex) => {
  if (!io) return;

  const eventData = {
    folderId,
    support,
    supportIndex,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('dossier:support:added', eventData);
  io.to('all_dossiers').emit('dossier:support:added', eventData);

  console.log(`🖨️  Support ajouté au dossier ${folderId} (index: ${supportIndex})`);
};

/**
 * Émet un événement quand un support est mis à jour
 * @param {number} folderId - ID du dossier
 * @param {object} support - Support mis à jour
 * @param {number} supportIndex - Index du support
 */
const emitSupportUpdated = (folderId, support, supportIndex) => {
  if (!io) return;

  const eventData = {
    folderId,
    support,
    supportIndex,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('dossier:support:updated', eventData);
  io.to('all_dossiers').emit('dossier:support:updated', eventData);

  console.log(`📝 Support ${supportIndex} mis à jour dans le dossier ${folderId}`);
};

/**
 * Émet un événement quand un support est supprimé
 * @param {number} folderId - ID du dossier
 * @param {number} supportIndex - Index du support supprimé
 */
const emitSupportRemoved = (folderId, supportIndex) => {
  if (!io) return;

  const eventData = {
    folderId,
    supportIndex,
    timestamp: new Date().toISOString(),
  };

  io.to(`dossier:${folderId}`).emit('dossier:support:removed', eventData);
  io.to('all_dossiers').emit('dossier:support:removed', eventData);

  console.log(`🗑️  Support ${supportIndex} supprimé du dossier ${folderId}`);
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
  
  // Notifications
  emitNotification,
  emitNotificationToRole,
  
  // Statistiques
  
  // Événements sections/supports
  emitSectionAdded,
  emitSectionUpdated,
  emitSectionRemoved,
  emitSupportAdded,
  emitSupportUpdated,
  emitSupportRemoved,
  emitStatsUpdated,
};
