import React, { useState } from 'react';
import { motion } from 'framer-motion';

const LoadingButton = ({ 
  children, 
  onClick, 
  loading = false, 
  disabled = false, 
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  loadingText = 'Chargement...',
  ...props 
}) => {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    if (loading || disabled || !onClick) return;

    // Create ripple effect
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = {
      x,
      y,
      id: Date.now(),
    };

    setRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);

    onClick(e);
  };

  const baseClasses = 'relative overflow-hidden font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300 dark:disabled:bg-blue-800',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-800',
    success: 'bg-green-600 hover:bg-green-700 text-white disabled:bg-green-300 dark:disabled:bg-green-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 dark:disabled:bg-red-800',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:border-blue-300 disabled:text-blue-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: loading || disabled ? 1 : 1.02 }}
      whileTap={{ scale: loading || disabled ? 1 : 0.98 }}
      onClick={handleClick}
      disabled={loading || disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {/* Ripple effect */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white rounded-full opacity-30 pointer-events-none"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            animation: 'ripple 0.6s ease-out',
          }}
        />
      ))}

      {/* Content */}
      {loading ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {children}
        </>
      )}
    </motion.button>
  );
};

export default LoadingButton;
