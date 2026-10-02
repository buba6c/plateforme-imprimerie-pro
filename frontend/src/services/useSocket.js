import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook React pour gérer la connexion Socket.IO et la synchronisation temps réel
 * @param {object} options - Options de configuration
 * @param {function} onDossierCreated - Callback quand un dossier est créé
 * @param {function} onDossierUpdated - Callback quand un dossier est mis à jour
 * @param {function} onDossierDeleted - Callback quand un dossier est supprimé
 * @param {function} onStatusChanged - Callback quand un statut change
 * @param {function} onFileUploaded - Callback quand un fichier est uploadé
 * @param {function} onFileDeleted - Callback quand un fichier est supprimé
 * @param {function} onNotification - Callback pour les notifications
 * @param {function} onStatsUpdated - Callback quand les stats sont mises à jour
 * @param {boolean} enabled - Activer/désactiver la connexion Socket.IO
 * @returns {object} - { socket, isConnected, joinDossier, leaveDossier, joinAllDossiers, leaveAllDossiers }
 */
export const useSocket = ({
  onDossierCreated,
  onDossierUpdated,
  onDossierDeleted,
  onStatusChanged,
  onFileUploaded,
  onFileDeleted,
  onNotification,
  onStatsUpdated,
  enabled = true,
} = {}) => {
  const socketRef = useRef(null);
  const isConnectedRef = useRef(false);

  // Initialiser la connexion Socket.IO
  useEffect(() => {
    if (!enabled) return;

    // URL du backend Socket.IO
    const SOCKET_URL = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : (process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001');

    console.log('🔌 Connexion Socket.IO à:', SOCKET_URL);

    // Créer la connexion
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: true,
    });

    const socket = socketRef.current;

    // Événements de connexion
    socket.on('connect', () => {
      console.log('✅ Socket.IO connecté:', socket.id);
      isConnectedRef.current = true;
    });

    socket.on('disconnect', reason => {
      console.log('❌ Socket.IO déconnecté:', reason);
      isConnectedRef.current = false;
    });

    socket.on('connect_error', error => {
      console.error('❌ Erreur connexion Socket.IO:', error);
      isConnectedRef.current = false;
    });

    socket.on('reconnect', attemptNumber => {
      console.log(`🔄 Socket.IO reconnecté après ${attemptNumber} tentative(s)`);
      isConnectedRef.current = true;
    });

    // Cleanup à la destruction du composant
    return () => {
      if (socket) {
        console.log('🔌 Déconnexion Socket.IO');
        socket.disconnect();
      }
    };
  }, [enabled]);

  // Enregistrer les listeners pour les événements dossiers
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (onDossierCreated) {
      socket.on('dossier:created', data => {
        console.log('📢 Événement dossier:created reçu:', data);
        onDossierCreated(data);
      });
    }

    if (onDossierUpdated) {
      socket.on('dossier:updated', data => {
        console.log('📢 Événement dossier:updated reçu:', data);
        onDossierUpdated(data);
      });
    }

    if (onDossierDeleted) {
      socket.on('dossier:deleted', data => {
        console.log('📢 Événement dossier:deleted reçu:', data);
        onDossierDeleted(data);
      });
    }

    if (onStatusChanged) {
      socket.on('status:changed', data => {
        console.log('📢 Événement status:changed reçu:', data);
        onStatusChanged(data);
      });
    }

    // Cleanup des listeners
    return () => {
      if (onDossierCreated) socket.off('dossier:created');
      if (onDossierUpdated) socket.off('dossier:updated');
      if (onDossierDeleted) socket.off('dossier:deleted');
      if (onStatusChanged) socket.off('status:changed');
    };
  }, [onDossierCreated, onDossierUpdated, onDossierDeleted, onStatusChanged]);

  // Enregistrer les listeners pour les événements fichiers
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (onFileUploaded) {
      socket.on('file:uploaded', data => {
        console.log('📢 Événement file:uploaded reçu:', data);
        onFileUploaded(data);
      });
    }

    if (onFileDeleted) {
      socket.on('file:deleted', data => {
        console.log('📢 Événement file:deleted reçu:', data);
        onFileDeleted(data);
      });
    }

    // Cleanup
    return () => {
      if (onFileUploaded) socket.off('file:uploaded');
      if (onFileDeleted) socket.off('file:deleted');
    };
  }, [onFileUploaded, onFileDeleted]);

  // Enregistrer les listeners pour les notifications et stats
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (onNotification) {
      socket.on('notification', data => {
        console.log('📢 Notification reçue:', data);
        onNotification(data);
      });
    }

    if (onStatsUpdated) {
      socket.on('stats:updated', data => {
        console.log('📢 Stats mises à jour:', data);
        onStatsUpdated(data);
      });
    }

    // Cleanup
    return () => {
      if (onNotification) socket.off('notification');
      if (onStatsUpdated) socket.off('stats:updated');
    };
  }, [onNotification, onStatsUpdated]);

  // Fonction pour rejoindre la room d'un dossier spécifique
  const joinDossier = useCallback(folderId => {
    const socket = socketRef.current;
    if (socket && folderId) {
      console.log(`📂 Rejoindre dossier: ${folderId}`);
      socket.emit('join:dossier', folderId);
    }
  }, []);

  // Fonction pour quitter la room d'un dossier
  const leaveDossier = useCallback(folderId => {
    const socket = socketRef.current;
    if (socket && folderId) {
      console.log(`📂 Quitter dossier: ${folderId}`);
      socket.emit('leave:dossier', folderId);
    }
  }, []);

  // Fonction pour rejoindre la room de tous les dossiers (dashboard)
  const joinAllDossiers = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      console.log('📊 Rejoindre tous les dossiers');
      socket.emit('join:all_dossiers');
    }
  }, []);

  // Fonction pour quitter la room de tous les dossiers
  const leaveAllDossiers = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      console.log('📊 Quitter tous les dossiers');
      socket.emit('leave:all_dossiers');
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    joinDossier,
    leaveDossier,
    joinAllDossiers,
    leaveAllDossiers,
  };
};

export default useSocket;
