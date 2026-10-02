import { useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

// Même origine que l'application par défaut (Nginx proxifie /socket.io vers le backend)
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);

// Le serveur refuse désormais toute connexion Socket.IO sans JWT valide :
// le token est lu (à chaque connexion/reconnexion) depuis le stockage de l'application.
const getAuthToken = () => {
  try {
    return localStorage.getItem('auth_token') || null;
  } catch (e) {
    return null;
  }
};

let socket = null;
let socketToken = null;

export const getSocket = () => {
  const token = getAuthToken();

  // Changement d'utilisateur (déconnexion / reconnexion) : recréer la connexion avec le nouveau token
  if (socket && token !== socketToken) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socketToken = token;
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      // Fonction : le token courant est relu à chaque (re)connexion
      auth: cb => cb({ token: getAuthToken() }),
    });
  }
  return socket;
};

export const useRealtimeUpdates = (callbacks = {}) => {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const socket = getSocket();

    // Connexion établie
    const handleConnect = () => {
      // Rejoindre automatiquement la room "all_dossiers" pour recevoir TOUS les événements
      socket.emit('join:all_dossiers');
      console.log('✅ [Socket] Connecté et rejoint all_dossiers');
    };

    // Déconnexion
    const handleDisconnect = () => {
      // Socket.IO déconnecté
    };

    // Erreur de connexion
    const handleError = () => {
      // Erreur Socket.IO
    };

    // Changement de statut de dossier (écoute TOUS les noms d'événements possibles)
    const handleStatusChanged = (data) => {
      console.log('🔄 [Socket] Status changed:', data);
      if (callbacksRef.current.onDossierStatusChanged) {
        // Normaliser la structure des données
        const normalizedData = {
          dossierId: data.folderId || data.dossierId,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          dossier: data.dossier,
          timestamp: data.timestamp
        };
        callbacksRef.current.onDossierStatusChanged(normalizedData);
      }
    };

    // Nouveau dossier créé
    const handleDossierCreated = (data) => {
      console.log('✨ [Socket] Dossier created:', data);
      if (callbacksRef.current.onDossierCreated) {
        callbacksRef.current.onDossierCreated(data);
      }
    };

    // Dossier mis à jour
    const handleDossierUpdated = (data) => {
      console.log('📝 [Socket] Dossier updated:', data);
      if (callbacksRef.current.onDossierUpdated) {
        callbacksRef.current.onDossierUpdated(data);
      }
    };

    // Dossier supprimé
    const handleDossierDeleted = (data) => {
      console.log('🗑️ [Socket] Dossier deleted:', data);
      if (callbacksRef.current.onDossierDeleted) {
        callbacksRef.current.onDossierDeleted(data);
      }
    };

    // Action utilisateur (pour sync multi-utilisateurs)
    const handleUserAction = (data) => {
      console.log('👤 [Socket] User action:', data);
      if (callbacksRef.current.onUserAction) {
        callbacksRef.current.onUserAction(data);
      }
    };

    // Enregistrer les listeners (TOUS les noms d'événements)
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    
    // Écouter TOUS les formats d'événements possibles
    socket.on('status:changed', handleStatusChanged); // ✅ Nom backend
    socket.on('dossier:status_changed', handleStatusChanged); // Ancien nom
    socket.on('dossier:statusChanged', handleStatusChanged); // Variante
    
    socket.on('dossier:created', handleDossierCreated);
    socket.on('dossier:updated', handleDossierUpdated);
    socket.on('dossier:deleted', handleDossierDeleted);
    socket.on('user:action', handleUserAction);

    // Cleanup - retirer TOUS les listeners
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      
      // Retirer tous les formats d'événements
      socket.off('status:changed', handleStatusChanged);
      socket.off('dossier:status_changed', handleStatusChanged);
      socket.off('dossier:statusChanged', handleStatusChanged);
      
      socket.off('dossier:created', handleDossierCreated);
      socket.off('dossier:updated', handleDossierUpdated);
      socket.off('dossier:deleted', handleDossierDeleted);
      socket.off('user:action', handleUserAction);
    };
  }, []);

  return {
    socket: getSocket(),
    emit: (event, data) => getSocket().emit(event, data),
  };
};

// Hook pour émettre une action et notifier les autres utilisateurs
export const useEmitAction = () => {
  const socket = getSocket();

  const emitStatusChange = useCallback((dossierId, oldStatus, newStatus, dossier) => {
    socket.emit('dossier:status_change', {
      dossierId,
      oldStatus,
      newStatus,
      dossier,
      timestamp: new Date().toISOString(),
    });
  }, [socket]);

  const emitDossierUpdate = useCallback((dossierId, updates) => {
    socket.emit('dossier:update', {
      dossierId,
      updates,
      timestamp: new Date().toISOString(),
    });
  }, [socket]);

  const emitDossierCreate = useCallback((dossier) => {
    socket.emit('dossier:create', {
      dossier,
      timestamp: new Date().toISOString(),
    });
  }, [socket]);

  return {
    emitStatusChange,
    emitDossierUpdate,
    emitDossierCreate,
  };
};

export default useRealtimeUpdates;
