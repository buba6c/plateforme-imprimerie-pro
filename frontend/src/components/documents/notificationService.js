import io from 'socket.io-client';

class NotificationService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.notifications = [];
    this.listeners = new Map(); // event -> [callbacks]
    this.heartbeatInterval = null;

    // Configuration
    this.config = {
      serverUrl: (() => {
        const sock = process.env.REACT_APP_SOCKET_URL;
        if (sock && sock.trim()) {
          if (sock.startsWith('/'))
            return typeof window !== 'undefined' ? window.location.origin + sock : sock;
          return sock; // absolute
        }
        const api = process.env.REACT_APP_API_URL;
        if (api && api.trim()) {
          if (api.startsWith('/'))
            return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001';
          return api.replace(/\/api\/?$/, '');
        }
        return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001';
      })(),
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      heartbeatInterval: 30000, // 30 secondes
    };
  }

  // ================================
  // CONNEXION ET AUTHENTIFICATION
  // ================================

  connect(user, token) {
    if (this.socket && this.connected) {
      console.log('🔌 Socket déjà connecté');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connexion Socket.IO...', this.config.serverUrl);

        // Créer la connexion Socket.IO
        this.socket = io(this.config.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: this.config.timeout,
          reconnectionAttempts: this.config.reconnectionAttempts,
          reconnectionDelay: this.config.reconnectionDelay,
          auth: { token },
          autoConnect: false,
        });

        // Événements de connexion
        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connecté:', this.socket.id);
          this.connected = true;

          // Authentifier immédiatement après connexion
          this.authenticate(user, token)
            .then(() => resolve())
            .catch(reject);
        });

        this.socket.on('connect_error', error => {
          console.error('❌ Erreur connexion Socket.IO:', error);
          this.connected = false;
          reject(error);
        });

        this.socket.on('disconnect', reason => {
          console.log('🔌 Socket.IO déconnecté:', reason);
          this.connected = false;
          this.authenticated = false;
          this.stopHeartbeat();

          // Notifier les listeners de la déconnexion
          this.emit('disconnected', { reason });
        });

        this.socket.on('reconnect', attemptNumber => {
          console.log('🔄 Socket.IO reconnecté après', attemptNumber, 'tentatives');
          this.connected = true;

          // Ré-authentifier après reconnexion
          if (user && token) {
            this.authenticate(user, token);
          }
        });

        // Événements d'authentification
        this.socket.on('authenticated', data => {
          console.log('✅ Socket.IO authentifié:', data);
          this.authenticated = true;
          this.startHeartbeat();
          this.emit('authenticated', data);
        });

        this.socket.on('auth_error', error => {
          console.error('❌ Erreur authentification Socket.IO:', error);
          this.authenticated = false;
          this.emit('auth_error', error);
        });

        // Événements de notifications
        this.setupNotificationListeners();

        // Démarrer la connexion
        this.socket.connect();
      } catch (error) {
        console.error('❌ Erreur initialisation Socket.IO:', error);
        reject(error);
      }
    });
  }

  authenticate(user, token) {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error('Socket non connecté'));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout authentification'));
      }, 10000);

      const onAuthenticated = data => {
        clearTimeout(timeout);
        this.socket.off('authenticated', onAuthenticated);
        this.socket.off('auth_error', onAuthError);
        resolve(data);
      };

      const onAuthError = error => {
        clearTimeout(timeout);
        this.socket.off('authenticated', onAuthenticated);
        this.socket.off('auth_error', onAuthError);
        reject(error);
      };

      this.socket.on('authenticated', onAuthenticated);
      this.socket.on('auth_error', onAuthError);

      // Envoyer les données d'authentification
      this.socket.emit('authenticate', {
        token,
        userId: user.id,
        userRole: user.role,
        userInfo: {
          prenom: user.prenom,
          nom: user.nom,
          email: user.email,
        },
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.authenticated = false;
      console.log('🔌 Socket.IO déconnecté manuellement');
    }
  }

  // ================================
  // HEARTBEAT ET MAINTIEN CONNEXION
  // ================================

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('heartbeat');
      }
    }, this.config.heartbeatInterval);

    // Écouter la réponse heartbeat
    this.socket.on('heartbeat_ack', () => {
      // Heartbeat acknowledgé, connexion active
    });
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ================================
  // GESTION DES NOTIFICATIONS
  // ================================

  setupNotificationListeners() {
    if (!this.socket) return;

    // Notification générale
    this.socket.on('notification', notification => {
      console.log('🔔 Nouvelle notification:', notification);
      this.addNotification(notification);
      this.emit('notification', notification);
    });

    // Notifications en attente (à la connexion)
    this.socket.on('pending_notifications', notifications => {
      console.log('📬 Notifications en attente:', notifications.length);
      notifications.forEach(notification => {
        this.addNotification(notification, false); // Pas de son pour les anciennes
      });
      this.emit('pending_notifications', notifications);
    });

    // Événements spécifiques métier
    this.socket.on('dossier_updated', data => {
      console.log('📝 Dossier mis à jour:', data);
      this.emit('dossier_updated', data);
    });

    this.socket.on('new_dossier_notification', data => {
      console.log('📄 Nouveau dossier:', data);
      this.emit('new_dossier', data);
    });

    this.socket.on('file_uploaded', data => {
      console.log('📁 Fichiers uploadés:', data);
      this.emit('file_uploaded', data);
    });

    // Événements système
    this.socket.on('user_connected', data => {
      this.emit('user_connected', data);
    });

    this.socket.on('user_disconnected', data => {
      this.emit('user_disconnected', data);
    });
  }

  addNotification(notification, playSound = true) {
    // Éviter les doublons
    const exists = this.notifications.find(n => n.id === notification.id);
    if (exists) return;

    // Ajouter en début de liste (plus récent en premier)
    this.notifications.unshift({
      ...notification,
      read: false,
      receivedAt: new Date(),
    });

    // Limiter le nombre de notifications stockées
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }

    // Jouer un son pour les nouvelles notifications
    if (playSound && this.shouldPlaySound(notification)) {
      this.playNotificationSound(notification);
    }
  }

  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;

      // Informer le serveur
      if (this.socket && this.authenticated) {
        this.socket.emit('mark_notification_read', { notificationId });
      }

      this.emit('notification_read', notificationId);
    }
  }

  markAllAsRead() {
    const unreadIds = this.notifications.filter(n => !n.read).map(n => n.id);

    this.notifications.forEach(n => (n.read = true));

    // Informer le serveur pour chaque notification
    if (this.socket && this.authenticated) {
      unreadIds.forEach(id => {
        this.socket.emit('mark_notification_read', { notificationId: id });
      });
    }

    this.emit('all_notifications_read', unreadIds);
  }

  clearNotifications() {
    this.notifications = [];
    this.emit('notifications_cleared');
  }

  // ================================
  // GESTION DES SONS
  // ================================

  shouldPlaySound(notification) {
    // Ne pas jouer de son si l'onglet n'est pas visible
    if (document.hidden) return false;

    // Ne pas jouer de son pour les notifications anciennes
    const notificationAge = new Date() - new Date(notification.timestamp);
    if (notificationAge > 60000) return false; // Plus de 1 minute

    return true;
  }

  playNotificationSound(notification) {
    // Sons désactivés pour éviter les erreurs 404
    // Le navigateur émettra son propre son de notification si activé
    return;
  }

  // ================================
  // ROOMS ET ÉVÉNEMENTS SPÉCIAUX
  // ================================

  joinRoom(roomName) {
    if (this.socket && this.authenticated) {
      this.socket.emit('join_room', { room: roomName });
      console.log(`🏠 Rejoindre room: ${roomName}`);
    }
  }

  leaveRoom(roomName) {
    if (this.socket && this.authenticated) {
      this.socket.emit('leave_room', { room: roomName });
      console.log(`🚪 Quitter room: ${roomName}`);
    }
  }

  // ================================
  // SYSTÈME D'ÉVÉNEMENTS
  // ================================

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Retourner une fonction de nettoyage
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Erreur callback événement ${event}:`, error);
      }
    });
  }

  // ================================
  // MÉTHODES DE NOTIFICATION RAPIDES
  // ================================

  success(message, options = {}) {
    this.showNotification({
      type: 'success',
      title: options.title || 'Succès',
      message,
      duration: options.duration || 4000,
      ...options
    });
  }

  error(message, options = {}) {
    this.showNotification({
      type: 'error',
      title: options.title || 'Erreur',
      message,
      duration: options.duration || 6000,
      ...options
    });
  }

  warning(message, options = {}) {
    this.showNotification({
      type: 'warning',
      title: options.title || 'Attention',
      message,
      duration: options.duration || 5000,
      ...options
    });
  }

  info(message, options = {}) {
    this.showNotification({
      type: 'info',
      title: options.title || 'Information',
      message,
      duration: options.duration || 4000,
      ...options
    });
  }

  showNotification({ type, title, message, duration = 4000, ...options }) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      duration,
      urgent: type === 'error',
      ...options
    };

    // Ajouter à la liste interne
    this.addNotification(notification);

    // Émettre pour les composants UI
    this.emit('toast_notification', notification);

    // Afficher nativement si disponible
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      this.showBrowserNotification(notification);
    }

    return notification;
  }

  showBrowserNotification(notification) {
    try {
      // Ajout de l'emoji au titre pour avoir une indication visuelle
      const emojiIcon = this.getNotificationIcon(notification.type);
      const nativeNotification = new Notification(`${emojiIcon} ${notification.title}`, {
        body: notification.message,
        // Pas d'icône pour éviter les erreurs 404
        tag: notification.id,
      });

      // Auto-fermer après la durée spécifiée
      if (notification.duration > 0) {
        setTimeout(() => {
          nativeNotification.close();
        }, notification.duration);
      }
    } catch (error) {
      console.warn('Impossible d\'afficher la notification native:', error);
    }
  }

  getNotificationIcon(type) {
    // Utiliser des emojis au lieu de fichiers PNG pour éviter les 404
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return icons[type] || icons.info;
  }

  // Demander la permission pour les notifications natives
  async requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  // ================================
  // UTILITAIRES
  // ================================

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  getNotifications(limit = 20) {
    return this.notifications.slice(0, limit);
  }

  getUrgentNotifications() {
    return this.notifications.filter(n => n.urgent && !n.read);
  }

  isConnected() {
    return this.connected && this.authenticated;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: this.authenticated,
      socketId: this.socket?.id,
      notificationCount: this.notifications.length,
      unreadCount: this.getUnreadCount(),
    };
  }
}

// Instance singleton
const notificationService = new NotificationService();

export default notificationService;
