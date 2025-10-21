import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';

const SidebarImproved = memo(({
  user,
  navigationItems,
  activeSection,
  onNavigate,
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  onLogout,
  theme
}) => {
  const getRoleIcon = () => {
    const icons = {
      admin: '👤',
      preparateur: '📋',
      imprimeur_roland: '🖨️',
      imprimeur_xerox: '🖨️',
      livreur: '🚚'
    };
    return icons[user?.role] || '👤';
  };

  const getRoleColor = () => {
    const colors = {
      admin: 'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800',
      preparateur: 'bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700',
      imprimeur_roland: 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
      imprimeur_xerox: 'bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700',
      livreur: 'bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700'
    };
    return colors[user?.role] || 'bg-gradient-to-r from-gray-500 to-gray-600';
  };

  const getItemColor = (itemId) => {
    if (itemId === activeSection) {
      return 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-600/30 dark:to-purple-600/30 border-l-4 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300';
    }
    return 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 border-l-4 border-transparent';
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        </motion.div>
      )}

      {/* Sidebar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
        className={`
          fixed inset-y-0 left-0 z-50 h-screen
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          shadow-lg dark:shadow-2xl dark:shadow-black/50
          flex flex-col
          lg:sticky lg:z-30 lg:translate-x-0
          ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-64 transition-all duration-300
        `}
      >
        {/* Header avec logo */}
        <div className={`
          ${getRoleColor()}
          text-white shadow-lg
          border-b border-white/20
          p-4
          flex items-center justify-between
          lg:flex-col lg:gap-4
        `}>
          <div className="flex items-center gap-3 flex-1">
            <div className={`
              text-3xl
              ${sidebarCollapsed && 'lg:text-center lg:w-full'}
            `}>
              {getRoleIcon()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-white font-bold text-sm truncate">Plateforme</h1>
                <p className="text-white/70 text-xs truncate">{user?.role}</p>
              </div>
            )}
          </div>

          {/* Boutons de contrôle */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Toggle"
          >
            {sidebarCollapsed ? (
              <ChevronRightIcon className="h-5 w-5" />
            ) : (
              <ChevronLeftIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* User info */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Connecté en tant que
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate mt-1">
              {user?.email || user?.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {user?.role === 'admin' && 'Administrateur'}
              {user?.role === 'preparateur' && 'Préparateur'}
              {user?.role === 'imprimeur_roland' && 'Imprimeur Roland'}
              {user?.role === 'imprimeur_xerox' && 'Imprimeur Xerox'}
              {user?.role === 'livreur' && 'Livreur'}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          <ul className="space-y-1 px-2">
            {navigationItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = item.id === activeSection;

              return (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${getItemColor(item.id)}
                      ${!sidebarCollapsed && 'justify-start'}
                      ${sidebarCollapsed && 'lg:justify-center'}
                    `}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="text-sm font-medium whitespace-nowrap">
                        {item.name}
                      </span>
                    )}
                    {isActive && !sidebarCollapsed && (
                      <ChevronRightIcon className="h-4 w-4 ml-auto flex-shrink-0" />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className={`
          border-t border-gray-200 dark:border-gray-800
          bg-gray-50 dark:bg-gray-800/50
          p-3 space-y-2
        `}>
          {!sidebarCollapsed && (
            <button
              onClick={onLogout}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-red-600 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/20
                transition-colors duration-200
                text-sm font-medium
              `}
            >
              <svg
                className="h-5 w-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Déconnexion</span>
            </button>
          )}

          {sidebarCollapsed && (
            <button
              onClick={onLogout}
              className={`
                w-full flex items-center justify-center p-2 rounded-lg
                text-red-600 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/20
                transition-colors duration-200
              `}
              title="Déconnexion"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          )}
        </div>
      </motion.div>

      {/* Spacer for desktop */}
      <div className={`hidden lg:block ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} transition-all duration-300`} />
    </>
  );
});

SidebarImproved.displayName = 'SidebarImproved';

export default SidebarImproved;
