const jwt = require('jsonwebtoken');

class NotificationService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> {socketId, userRole, connectedAt}
    this.userSockets = new Map(); // socketId -> {userId, userRole, connectedAt}
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', socket => {
      console.log(`🔌 Nouvelle connexion Socket.IO: ${socket.id}`);

      // Authentification automatique par token dans l'auth header
      const token = socket.handshake.auth.token;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const { id: userId, role: userRole } = decoded;

          // Stocker les informations utilisateur
          const userInfo = {
            socketId: socket.id,
            userId,
            userRole,
            connectedAt: new Date(),
            lastActivity: new Date(),
          };

          this.connectedUsers.set(userId, userInfo);
          this.userSockets.set(socket.id, userInfo);

          // Rejoindre les rooms appropriées
          socket.join(`role_${userRole}`);
          socket.join(`user_${userId}`);

          console.log(`👤 Utilisateur ${userId} (${userRole}) auto-authentifié via token`);

          // Confirmer l'authentification
          socket.emit('authenticated', { success: true, userId, userRole });

          // Envoyer les notifications en attente pour cet utilisateur
          this.sendPendingNotifications(userId, socket);

          // Notifier les admins d'une nouvelle connexion
          this.notifyAdmins('user_connected', {
            userId,
            userRole,
            connectedAt: new Date(),
            socketId: socket.id,
          });
        } catch (error) {
          console.error('❌ Erreur authentification auto Socket.IO:', error.message);
          socket.emit('auth_error', { error: 'Token invalide' });
        }
      }

      // Authentification du socket avec JWT (méthode manuelle)
      socket.on('authenticate', data => {
        try {
          const { token, userRole, userId } = data;

          // Vérifier le token JWT si fourni
          if (token) {
            jwt.verify(token, process.env.JWT_SECRET);
          }

          if (userId && userRole) {
            // Stocker les informations utilisateur
            const userInfo = {
              socketId: socket.id,
              userId,
              userRole,
              connectedAt: new Date(),
              lastActivity: new Date(),
            };

            this.connectedUsers.set(userId, userInfo);
            this.userSockets.set(socket.id, userInfo);

            // Rejoindre les rooms appropriées
            socket.join(`role_${userRole}`);
            socket.join(`user_${userId}`);

            console.log(`👤 Utilisateur ${userId} (${userRole}) authentifié`);

            // Confirmer l'authentification
            socket.emit('authenticated', { success: true, userId, userRole });

            // Envoyer les notifications en attente pour cet utilisateur
            this.sendPendingNotifications(userId, socket);

            // Notifier les admins d'une nouvelle connexion
            this.notifyAdmins('user_connected', {
              userId,
              userRole,
              connectedAt: new Date(),
              socketId: socket.id,
            });
          }
        } catch (error) {
          console.error('❌ Erreur authentification Socket.IO:', error.message);
          socket.emit('auth_error', { error: 'Token invalide' });
        }
      });

      // Heartbeat pour maintenir la connexion active
      socket.on('heartbeat', () => {
        const user = this.userSockets.get(socket.id);
        if (user) {
          user.lastActivity = new Date();
          this.connectedUsers.set(user.userId, user);
        }
        socket.emit('heartbeat_ack');
      });

      // Marquer une notification comme lue
      socket.on('mark_notification_read', data => {
        const { notificationId } = data;
        console.log(`📖 Notification ${notificationId} marquée comme lue`);
        // Ici on pourrait sauver en base que la notification est lue
      });

      // Rejoindre une room spécifique (ex: dossier)
      socket.on('join_room', data => {
        const { room } = data;
        socket.join(room);
        console.log(`🏠 Utilisateur rejoint la room: ${room}`);
      });

      // Quitter une room spécifique
      socket.on('leave_room', data => {
        const { room } = data;
        socket.leave(room);
        console.log(`🚪 Utilisateur quitte la room: ${room}`);
      });

      // Déconnexion
      socket.on('disconnect', reason => {
        const user = this.userSockets.get(socket.id);
        if (user) {
          console.log(
            `🔌 Déconnexion utilisateur ${user.userId} (${user.userRole}) - Raison: ${reason}`
          );

          // Notifier les admins de la déconnexion
          this.notifyAdmins('user_disconnected', {
            userId: user.userId,
            userRole: user.userRole,
            disconnectedAt: new Date(),
            reason,
            sessionDuration: new Date() - user.connectedAt,
          });

          this.connectedUsers.delete(user.userId);
          this.userSockets.delete(socket.id);
        }
      });
    });
  }

  // ================================
  // MÉTHODES DE NOTIFICATION MÉTIER
  // ================================

  // Nouveau dossier créé
  notifyNewDossier(dossier, createdBy) {
    const notification = {
      id: this.generateNotificationId(),
      type: 'new_dossier',
      title: 'Nouveau dossier créé',
      message: `Nouveau dossier ${dossier.numero_commande} créé par ${createdBy}`,
      data: { dossier, createdBy },
      timestamp: new Date(),
      urgent: false,
    };

    // Notifier selon la machine du dossier
    if (dossier.machine === 'Roland') {
      this.sendToRole('imprimeur_roland', 'notification', notification);
    } else if (dossier.machine === 'Xerox') {
      this.sendToRole('imprimeur_xerox', 'notification', notification);
    }

    // Toujours notifier les admins
    this.sendToRole('admin', 'notification', notification);

    console.log(
      `📄 Notification nouveau dossier envoyée: ${dossier.numero_commande} (${dossier.machine})`
    );
  }

  // Changement de statut dossier
  notifyStatusChange(dossier, oldStatus, newStatus, changedBy, comment = null) {
    const notification = {
      id: this.generateNotificationId(),
      type: 'statut_change',
      title: 'Statut dossier modifié',
      message: `Dossier ${dossier.numero_commande} : ${this.getStatutLabel(oldStatus)} → ${this.getStatutLabel(newStatus)}`,
      data: { dossier, oldStatut: oldStatus, newStatut: newStatus, changedBy, comment },
      timestamp: new Date(),
      urgent: newStatus === 'À revoir',
    };

    // Logique de notification selon le nouveau statut
    switch (newStatus) {
      case 'À revoir':
        // Notifier le préparateur qui a créé le dossier
        this.sendToUser(dossier.created_by, 'notification', notification);
        this.sendToRole('admin', 'notification', notification);
        // Événement métier pour le frontend
        this.io.emit('dossier_status_changed', {
          dossier,
          oldStatus,
          newStatus,
          changedBy,
          comment,
        });
        break;

      case 'En impression':
        // Notifier les imprimeurs concernés et admins
        if (dossier.machine === 'Roland') {
          this.sendToRole('imprimeur_roland', 'notification', notification);
        } else if (dossier.machine === 'Xerox') {
          this.sendToRole('imprimeur_xerox', 'notification', notification);
        }
        this.sendToRole('admin', 'notification', notification);
        this.io.emit('dossier_statut_changed', {
          dossier,
          oldStatut: oldStatus,
          newStatut: newStatus,
          changedBy,
          comment,
        });
        break;

      case 'Imprimé':
      case 'Prêt livraison':
        // Dès que l'impression est terminée ou prêt livraison, notifier les livreurs
        this.sendToRole('livreur', 'notification', notification);
        this.sendToRole('admin', 'notification', notification);
        this.io.emit('dossier_status_changed', {
          dossier,
          oldStatus,
          newStatus,
          changedBy,
          comment,
        });
        break;

      case 'Terminé':
        // Notifier les livreurs et admins
        this.sendToRole('livreur', 'notification', notification);
        this.sendToRole('admin', 'notification', notification);
        this.io.emit('dossier_status_changed', {
          dossier,
          oldStatus,
          newStatus,
          changedBy,
          comment,
        });
        break;

      case 'Livré':
        // Notifier tous les rôles et le créateur
        this.sendToUser(dossier.created_by, 'notification', notification);
        this.sendToRole('admin', 'notification', notification);
        this.io.emit('dossier_status_changed', {
          dossier,
          oldStatus,
          newStatus,
          changedBy,
          comment,
        });
        break;

      default:
        // Pour tous les autres statuts, notifier les admins
        this.sendToRole('admin', 'notification', notification);
        this.io.emit('dossier_status_changed', {
          dossier,
          oldStatus,
          newStatus,
          changedBy,
          comment,
        });
        break;
    }

    console.log(
      `📝 Notification changement statut envoyée: ${dossier.numero_commande} (${oldStatus} → ${newStatus})`
    );
  }

  // Nouveau fichier uploadé
  notifyFileUploaded(dossier, files, uploadedBy) {
    const notification = {
      id: this.generateNotificationId(),
      type: 'file_uploaded',
      title: 'Nouveaux fichiers ajoutés',
      message: `${files.length} fichier(s) ajouté(s) au dossier ${dossier.numero_commande}`,
      data: { dossier, files, uploadedBy },
      timestamp: new Date(),
      urgent: false,
    };

    // Notifier selon le rôle et le statut
    switch (dossier.status) {
      case 'en_cours':
      case 'a_revoir':
        // Notifier les imprimeurs concernés et admins
        if (dossier.type === 'roland') {
          this.sendToRole('imprimeur_roland', 'notification', notification);
        } else if (dossier.type === 'xerox') {
          this.sendToRole('imprimeur_xerox', 'notification', notification);
        }
        this.sendToRole('admin', 'notification', notification);
        break;

      case 'en_impression':
        // Notifier les préparateurs et admins (nouvelles preuves)
        this.sendToRole('preparateur', 'notification', notification);
        this.sendToRole('admin', 'notification', notification);
        break;
    }

    console.log(
      `📁 Notification fichiers uploadés envoyée: ${dossier.numero_commande} (${files.length} fichiers)`
    );
  }

  // Dossier urgent
  notifyUrgentDossier(dossier) {
    const notification = {
      id: this.generateNotificationId(),
      type: 'urgent_dossier',
      title: '🚨 DOSSIER URGENT',
      message: `Le dossier ${dossier.numero_commande} est marqué comme urgent !`,
      data: { dossier },
      timestamp: new Date(),
      urgent: true,
    };

    // Notifier tous les rôles concernés
    this.sendToAll('notification', notification);

    console.log(`🚨 Notification dossier urgent envoyée: ${dossier.numero_commande}`);
  }

  // Rappel de deadline
  notifyDeadlineApproaching(dossiers) {
    dossiers.forEach(dossier => {
      const notification = {
        id: this.generateNotificationId(),
        type: 'deadline_approaching',
        title: '⏰ Deadline approche',
        message: `Le dossier ${dossier.numero_commande} doit être livré bientôt`,
        data: { dossier },
        timestamp: new Date(),
        urgent: true,
      };

      // Notifier selon le statut actuel
      switch (dossier.status) {
        case 'en_cours':
        case 'a_revoir':
          this.sendToRole('preparateur', 'notification', notification);
          break;
        case 'en_impression':
          if (dossier.type === 'roland') {
            this.sendToRole('imprimeur_roland', 'notification', notification);
          } else {
            this.sendToRole('imprimeur_xerox', 'notification', notification);
          }
          break;
        case 'termine':
          this.sendToRole('livreur', 'notification', notification);
          break;
      }

      this.sendToRole('admin', 'notification', notification);
    });

    console.log(`⏰ Notifications deadline envoyées pour ${dossiers.length} dossiers`);
  }

  // ================================
  // MÉTHODES UTILITAIRES
  // ================================

  // Envoyer à un rôle spécifique
  sendToRole(role, event, data) {
    this.io.to(`role_${role}`).emit(event, data);
  }

  // Envoyer à un utilisateur spécifique
  sendToUser(userId, event, data) {
    const user = this.connectedUsers.get(userId);
    if (user && user.socketId) {
      this.io.to(user.socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Envoyer à tous les utilisateurs connectés
  sendToAll(event, data) {
    this.io.emit(event, data);
  }

  // Notifier les admins uniquement
  notifyAdmins(event, data) {
    this.sendToRole('admin', event, data);
  }

  // Envoyer les notifications en attente (quand un utilisateur se connecte)
  async sendPendingNotifications(userId, socket) {
    // Ici on pourrait récupérer les notifications non lues depuis la base de données
    // Pour l'instant, on simule
    const pendingNotifications = [];

    if (pendingNotifications.length > 0) {
      socket.emit('pending_notifications', pendingNotifications);
      console.log(
        `📬 ${pendingNotifications.length} notifications en attente envoyées à ${userId}`
      );
    }
  }

  // Générer un ID unique pour les notifications
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Obtenir le label d'un statut
  getStatusLabel(status) {
    const labels = {
      'En cours': 'En cours',
      'À revoir': 'À revoir',
      'En impression': 'En impression',
      Terminé: 'Terminé',
      Livré: 'Livré',
    };
    return labels[status] || status;
  }

  // Obtenir les statistiques de connexion
  getConnectionStats() {
    const stats = {
      totalConnected: this.connectedUsers.size,
      byRole: {},
      connections: Array.from(this.connectedUsers.values()),
    };

    // Compter par rôle
    this.connectedUsers.forEach(user => {
      if (!stats.byRole[user.userRole]) {
        stats.byRole[user.userRole] = 0;
      }
      stats.byRole[user.userRole]++;
    });

    return stats;
  }

  // Nettoyer les connexions inactives (à appeler périodiquement)
  cleanInactiveConnections() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    this.connectedUsers.forEach((user, userId) => {
      if (now - user.lastActivity > inactiveThreshold) {
        console.log(`🧹 Nettoyage connexion inactive: ${userId}`);
        this.connectedUsers.delete(userId);
        this.userSockets.delete(user.socketId);
      }
    });
  }
}

module.exports = NotificationService;
