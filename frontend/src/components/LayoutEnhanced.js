import React, { useState, useEffect } from 'react';
import {
  HomeIcon,
  UsersIcon,
  FolderIcon,
  DocumentIcon,
  CogIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  MoonIcon,
  SunIcon,
  TruckIcon,
  ClockIcon,
  CalendarDaysIcon,
  BellIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import NotificationCenter from './notifications/NotificationCenter';
import { getRoleTheme } from '../constants/roleTheme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import PropTypes from 'prop-types';

const LayoutEnhanced = ({ children, activeSection, onNavigate }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { resolvedTheme, toggleDarkLight } = useTheme();

  // Gestion du mode plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Erreur toggle fullscreen:', error);
    }
  };

  // Navigation selon les rôles
  const getNavigationItems = () => {
    const baseItems = [
      {
        id: 'dashboard',
        name: 'Tableau de bord',
        icon: HomeIcon,
        roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'],
      },
    ];

    const workflowItems = [
      {
        id: 'dossiers',
        name: 'Dossiers',
        icon: FolderIcon,
        roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'],
      },
      { id: 'files', name: 'Fichiers', icon: DocumentIcon, roles: ['admin', 'preparateur'] },
    ];

    // Sections spécialisées pour les livreurs (3 sections principales)
    const livreurItems = [
      { id: 'a-livrer', name: '📦 À Livrer', icon: DocumentIcon, roles: ['livreur'] },
      { id: 'en-livraison', name: '🚚 En Livraison', icon: TruckIcon, roles: ['livreur'] },
      { id: 'livres', name: '✅ Livrés', icon: ClockIcon, roles: ['livreur'] },
    ];

    const adminItems = [
      { id: 'users', name: 'Utilisateurs', icon: UsersIcon, roles: ['admin'] },
      { id: 'statistics', name: 'Statistiques', icon: ChartBarIcon, roles: ['admin'] },
      { id: 'permissions', name: 'Permissions', icon: ShieldCheckIcon, roles: ['admin'] },
      { id: 'settings', name: 'Paramètres', icon: CogIcon, roles: ['admin'] },
    ];

    const allItems = [...baseItems, ...workflowItems, ...livreurItems, ...adminItems];

    return allItems.filter(item => item.roles.includes(user.role));
  };

  const navigationItems = user ? getNavigationItems() : [];

  const getRoleDisplayName = role => {
    const roleNames = {
      admin: 'Administrateur',
      preparateur: 'Préparateur',
      imprimeur_roland: 'Imprimeur Roland',
      imprimeur_xerox: 'Imprimeur Xerox',
      livreur: 'Livreur',
    };
    return roleNames[role] || role;
  };

  const handleLogout = () => {
    logout();
  };

  if (!user) {
    return null;
  }

  const roleTheme = getRoleTheme(user.role);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar Desktop */}
      <div className="sidebar fixed inset-y-0 left-0 z-50 w-64 relative shadow-xl border-r hidden lg:block flex flex-col">
        {/* Header Sidebar */}
        <div className="sidebar-header">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10V9z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-white font-bold text-sm tracking-tight leading-tight">Plateforme</h1>
              <p className="text-white/60 text-xs leading-tight">Impression</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`sidebar-item w-full flex items-center text-sm transition-all duration-200 group ${isActive ? 'active' : ''}`}
              >
                <Icon className="mr-3 h-5 w-5 text-white" />
                <span className="truncate font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3 mb-3">
              <div className="relative w-10 h-10 rounded-lg flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
              <span className="text-white font-bold text-sm">
                {user.prenom?.charAt(0) || user.nom?.charAt(0) || 'U'}
              </span>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2" style={{ borderColor: 'var(--sidebar-bg)' }}></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.prenom} {user.nom}
              </p>
              <p className="text-xs text-white/50 truncate">
                {getRoleDisplayName(user.role)}
              </p>
            </div>
          </div>

          {/* Toggle Dark Mode */}
          <button
            onClick={toggleDarkLight}
            className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            {resolvedTheme === 'dark' ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
            <span>{resolvedTheme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
          </button>

          {/* Plein écran */}
          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center gap-2 px-3 py-2.5 mb-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-5 w-5" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5" />
            )}
            <span>{isFullscreen ? 'Quitter plein écran' : 'Plein écran'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Sidebar Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full sidebar shadow-xl border-r">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            
            {/* Contenu mobile identique au desktop */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center mr-3 border border-white/30">
                  <span className="text-white text-sm font-bold">EP</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">EvocomPrint</h1>
                  <p className="text-xs text-white/80">{getRoleDisplayName(user.role)}</p>
                </div>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navigationItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`sidebar-item w-full flex items-center text-base transition-colors ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="mr-4 h-6 w-6" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-white/20 p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <span className="text-white text-sm font-semibold">
                    {user.prenom?.charAt(0) || user.nom?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="ml-3 text-white/90">
                  <p className="text-sm font-medium">
                    {user.prenom} {user.nom}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-white/80 hover:text-white"
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden p-2 rounded-lg text-neutral-400 hover:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              
              <div>
                <h1 className="text-xl font-semibold text-neutral-900 dark:text-white capitalize">
                  {activeSection.replace('_', ' ')}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <NotificationCenter />
              
              {/* User Menu Desktop */}
              <div className="hidden lg:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    {user.prenom} {user.nom}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {getRoleDisplayName(user.role)}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${roleTheme.gradient} flex items-center justify-center`}>
                  <span className="text-white text-sm font-semibold">
                    {user.prenom?.charAt(0) || user.nom?.charAt(0) || 'U'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

LayoutEnhanced.propTypes = {
  children: PropTypes.node.isRequired,
  activeSection: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default LayoutEnhanced;
