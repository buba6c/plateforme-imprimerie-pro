import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

// Composant externe pour les éléments de notification
const NotificationItem = ({ notification, onRemove }) => {
  const [timeLeft, setTimeLeft] = useState(notification.duration || 5000);

  const getIcon = (type) => {
    const iconProps = { className: "h-5 w-5" };
    
    switch (type) {
      case 'success':
        return <CheckCircleIcon {...iconProps} className="h-5 w-5 text-success-500" />;
      case 'error':
        return <XCircleIcon {...iconProps} className="h-5 w-5 text-error-500" />;
      case 'warning':
        return <ExclamationTriangleIcon {...iconProps} className="h-5 w-5 text-orange-500" />;
      case 'info':
      default:
        return <InformationCircleIcon {...iconProps} className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-success-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-800 dark:text-green-200'
        };
      case 'error':
        return {
          bg: 'bg-error-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  const styles = getStyles(notification.type);

  useEffect(() => {
    if (notification.duration === 0) return; // Persistent notification
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          onRemove(notification.id);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [notification.id, notification.duration, onRemove]);

  const progressPercentage = notification.duration ? ((timeLeft / notification.duration) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative max-w-sm w-full ${styles.bg} ${styles.border} border rounded-lg shadow-lg dark:shadow-secondary-900/25 p-4 mb-3`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon(notification.type)}
        </div>
        
        <div className="ml-3 flex-1">
          {notification.title && (
            <h4 className={`text-sm font-semibold ${styles.text} mb-1`}>
              {notification.title}
            </h4>
          )}
          <p className={`text-sm ${styles.text}`}>
            {notification.message}
          </p>
          
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`mt-2 text-xs font-medium ${styles.text} underline hover:no-underline`}
            >
              {notification.action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={() => onRemove(notification.id)}
          className={`ml-3 ${styles.text} hover:opacity-75 transition-opacity`}
          aria-label="Fermer la notification"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      
      {/* Progress bar pour les notifications temporaires */}
      {notification.duration && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-b-lg overflow-hidden">
          <motion.div
            className="h-full bg-current opacity-30"
            initial={{ width: '100%' }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
    message: PropTypes.string.isRequired,
    title: PropTypes.string,
    duration: PropTypes.number,
    action: PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
    }),
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};

const NotificationToast = ({ notifications = [], onRemove }) => {


  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationItem 
            key={notification.id} 
            notification={notification}
            onRemove={onRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

NotificationToast.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
      message: PropTypes.string.isRequired,
      title: PropTypes.string,
      duration: PropTypes.number,
    })
  ),
  onRemove: PropTypes.func.isRequired,
};

NotificationToast.defaultProps = {
  notifications: [],
};

export default NotificationToast;