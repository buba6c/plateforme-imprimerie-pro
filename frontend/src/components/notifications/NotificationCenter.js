import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  DocumentIcon,
  ClockIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import notificationService from '../../services/notificationService';

const NotificationCenter = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, right: 0 });

  const updateNotifications = useCallback(() => {
    setNotifications(notificationService.getNotifications(20));
    setUnreadCount(notificationService.getUnreadCount());
  }, []);

  const showBrowserNotification = useCallback(notification => {
    if (document.hidden) {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
    }
  }, []);

  const handleNewNotification = useCallback(
    notification => {
      updateNotifications();
      if (Notification.permission === 'granted') {
        showBrowserNotification(notification);
      }
    },
    [updateNotifications, showBrowserNotification]
  );

  const handleConnectionChange = useCallback(() => {
    setConnectionStatus(notificationService.getConnectionStatus());
  }, []);

  useEffect(() => {
    // Charger les notifications initiales
    updateNotifications();

    // Écouter les nouveaux événements
    const unsubscribeFunctions = [
      notificationService.on('notification', handleNewNotification),
      notificationService.on('pending_notifications', updateNotifications),
      notificationService.on('notification_read', updateNotifications),
      notificationService.on('all_notifications_read', updateNotifications),
      notificationService.on('notifications_cleared', updateNotifications),
      notificationService.on('authenticated', handleConnectionChange),
      notificationService.on('disconnected', handleConnectionChange),
    ];

    // Mettre à jour le statut de connexion
    setConnectionStatus(notificationService.getConnectionStatus());

    return () => {
      // Nettoyer les listeners
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [updateNotifications, handleNewNotification, handleConnectionChange]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const togglePanel = () => {
    if (!isOpen && buttonRef.current) {
      // Calculer la position du panel par rapport au bouton
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPosition({
        top: rect.bottom + 8, // 8px en dessous du bouton
        right: window.innerWidth - rect.right
      });
    }
    setIsOpen(!isOpen);
    if (!isOpen) {
      requestNotificationPermission();
    }
  };

  const markAsRead = notificationId => {
    notificationService.markAsRead(notificationId);
  };

  const markAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  const clearAll = () => {
    notificationService.clearNotifications();
  };

  const getNotificationIcon = type => {
    const iconClasses = 'h-5 w-5 flex-shrink-0';

    switch (type) {
      case 'new_dossier':
        return <DocumentIcon className={`${iconClasses} text-primary-500`} />;
      case 'status_change':
        return <CheckCircleIcon className={`${iconClasses} text-success-500`} />;
      case 'file_uploaded':
        return <DocumentIcon className={`${iconClasses} text-blue-500`} />;
      case 'urgent_dossier':
        return <ExclamationTriangleIcon className={`${iconClasses} text-danger-500`} />;
      case 'deadline_approaching':
        return <ClockIcon className={`${iconClasses} text-warning-500`} />;
      default:
        return <InformationCircleIcon className={`${iconClasses} text-neutral-500`} />;
    }
  };

  const getNotificationColor = notification => {
    if (notification.urgent) {
      return 'border-l-4 border-danger-400 bg-danger-50';
    }
    if (!notification.read) {
      return 'border-l-4 border-blue-400 bg-blue-50';
    }
    return 'border-l-4 border-neutral-200 bg-white dark:bg-neutral-800';
  };

  const formatTime = timestamp => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;

    if (diff < 60000) {
      // Moins d'1 minute
      return "À l'instant";
    } else if (diff < 3600000) {
      // Moins d'1 heure
      const minutes = Math.floor(diff / 60000);
      return `Il y a ${minutes} min`;
    } else if (diff < 86400000) {
      // Moins d'1 jour
      const hours = Math.floor(diff / 3600000);
      return `Il y a ${hours}h`;
    } else {
      return time.toLocaleDateString('fr-FR');
    }
  };

  const truncateMessage = (message, maxLength = 80) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  return (
    <>
      {/* Bouton de notification */}
      <button
        ref={buttonRef}
        onClick={togglePanel}
        className={`relative p-2 text-neutral-600 hover:text-neutral-900 dark:text-white transition-colors ${className}`}
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <BellIconSolid className="h-6 w-6 text-blue-600" />
        ) : (
          <BellIcon className="h-6 w-6" />
        )}

        {/* Badge de compteur */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Indicateur de connexion */}
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            connectionStatus?.authenticated ? 'bg-success-400' : 'bg-neutral-400'
          }`}
        />
      </button>

      {/* Panel de notifications - Rendu via Portal */}
      {isOpen && createPortal(
        <>
          {/* Backdrop pour fermer en cliquant à l'extérieur */}
          <div 
            className="fixed inset-0" 
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div 
            ref={panelRef}
            className="fixed w-96 bg-white dark:bg-neutral-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
            style={{ 
              zIndex: 9999,
              top: `${panelPosition.top}px`,
              right: `${panelPosition.right}px`,
              maxHeight: 'calc(100vh - 100px)'
            }}
          >
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Notifications</h3>

              <div className="flex items-center space-x-2">
                {/* Statut de connexion */}
                <div
                  className={`flex items-center text-xs ${
                    connectionStatus?.authenticated ? 'text-success-600' : 'text-neutral-500'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mr-1 ${
                      connectionStatus?.authenticated ? 'bg-success-400' : 'bg-neutral-400'
                    }`}
                  />
                  {connectionStatus?.authenticated ? 'Connecté' : 'Hors ligne'}
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Compteurs et actions */}
            {notifications.length > 0 && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  {unreadCount > 0 && `${unreadCount} non lue${unreadCount > 1 ? 's' : ''} • `}
                  {notifications.length} total
                </span>

                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Tout marquer comme lu
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-200 transition-colors"
                    >
                      Effacer tout
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Liste des notifications */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <BellIcon className="h-12 w-12 text-neutral-300 mx-auto mb-2" />
                <p className="text-neutral-500">Aucune notification</p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-100">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-neutral-50 dark:bg-neutral-900 transition-colors ${getNotificationColor(notification)}`}
                  >
                    <div className="flex items-start space-x-3">
                      {getNotificationIcon(notification.type)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4
                              className={`text-sm font-medium ${
                                notification.read ? 'text-neutral-700' : 'text-neutral-900 dark:text-white'
                              }`}
                            >
                              {notification.title}
                            </h4>

                            <p
                              className={`text-sm mt-1 ${
                                notification.read ? 'text-neutral-500' : 'text-neutral-700 dark:text-neutral-200'
                              }`}
                            >
                              {truncateMessage(notification.message)}
                            </p>

                            <p className="text-xs text-neutral-400 mt-2">
                              {formatTime(notification.timestamp)}
                            </p>
                          </div>

                          <div className="flex items-center ml-2">
                            {notification.urgent && (
                              <ExclamationTriangleIcon className="h-4 w-4 text-danger-500 mr-1" />
                            )}

                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 transition-colors"
                                title="Marquer comme lu"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer avec infos de débogage (développement) */}
          {process.env.NODE_ENV === 'development' && connectionStatus && (
            <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
              <details className="text-xs text-neutral-500">
                <summary className="cursor-pointer hover:text-neutral-700 dark:text-neutral-200">Debug Info</summary>
                <div className="mt-1 space-y-1">
                  <div>Socket ID: {connectionStatus.socketId || 'N/A'}</div>
                  <div>Connecté: {connectionStatus.connected ? 'Oui' : 'Non'}</div>
                  <div>Authentifié: {connectionStatus.authenticated ? 'Oui' : 'Non'}</div>
                </div>
              </details>
            </div>
          )}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default NotificationCenter;
