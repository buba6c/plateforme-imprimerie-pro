import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// Context pour gérer les toasts globalement
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Provider pour les toasts
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const toast = {
    success: (message, title = 'Succès') => addToast({ type: 'success', message, title }),
    error: (message, title = 'Erreur') => addToast({ type: 'error', message, title }),
    warning: (message, title = 'Attention') => addToast({ type: 'warning', message, title }),
    info: (message, title = 'Information') => addToast({ type: 'info', message, title }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Composant Toast individuel
const Toast = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration || 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      icon: CheckCircleIcon,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-800 dark:text-green-200',
      iconColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800',
      progressColor: 'bg-green-600',
    },
    error: {
      icon: ExclamationCircleIcon,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-800 dark:text-red-200',
      iconColor: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800',
      progressColor: 'bg-red-600',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      progressColor: 'bg-yellow-600',
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-800 dark:text-blue-200',
      iconColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800',
      progressColor: 'bg-blue-600',
    },
  };

  const style = config[toast.type] || config.info;
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{
        opacity: isExiting ? 0 : 1,
        y: isExiting ? -20 : 0,
        scale: isExiting ? 0.95 : 1,
      }}
      className={`${style.bgColor} ${style.borderColor} border-l-4 rounded-lg p-4 shadow-lg max-w-md w-full`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-6 w-6 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`font-semibold ${style.textColor} mb-1`}>{toast.title}</p>
          )}
          <p className={`text-sm ${style.textColor}`}>{toast.message}</p>
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className={`${style.textColor} hover:opacity-70 transition-opacity flex-shrink-0`}
          aria-label="Fermer"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Barre de progression */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`h-1 ${style.progressColor} mt-3 rounded-full`}
      />
    </motion.div>
  );
};

// Conteneur de toasts
const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div
      className="fixed top-4 right-4 z-[1030] space-y-3 max-w-md pointer-events-none"
      style={{ maxHeight: '90vh', overflowY: 'auto' }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
