import { useState, useCallback } from 'react';

let notificationIdCounter = 0;

const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, options = {}) => {
    const id = ++notificationIdCounter;
    const notification = {
      id,
      message,
      type: options.type || 'info',
      title: options.title,
      duration: options.duration !== undefined ? options.duration : 5000,
      action: options.action,
      ...options
    };

    setNotifications(prev => [...prev, notification]);

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Méthodes de commodité
  const success = useCallback((message, options = {}) => {
    return addNotification(message, { ...options, type: 'success' });
  }, [addNotification]);

  const error = useCallback((message, options = {}) => {
    return addNotification(message, { ...options, type: 'error', duration: 8000 });
  }, [addNotification]);

  const warning = useCallback((message, options = {}) => {
    return addNotification(message, { ...options, type: 'warning' });
  }, [addNotification]);

  const info = useCallback((message, options = {}) => {
    return addNotification(message, { ...options, type: 'info' });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  };
};

export default useNotifications;