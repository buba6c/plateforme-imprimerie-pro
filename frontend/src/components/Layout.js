import React, { useState } from 'react';
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
} from '@heroicons/react/24/outline';
import NotificationCenter from './notifications/NotificationCenter';
import { getRoleTheme } from '../constants/roleTheme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import PropTypes from 'prop-types';

const Layout = ({ children, activeSection, onNavigate }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resolvedTheme, toggleDarkLight } = useTheme();

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

    const adminItems = [
      { id: 'users', name: 'Utilisateurs', icon: UsersIcon, roles: ['admin'] },
      { id: 'permissions', name: 'Permissions', icon: ShieldCheckIcon, roles: ['admin'] },
      { id: 'statistics', name: 'Statistiques', icon: ChartBarIcon, roles: ['admin'] },
      { id: 'settings', name: 'Paramètres', icon: CogIcon, roles: ['admin'] },
    ];

    const workflowItems = [
      {
        id: 'dossiers',
        name: 'Dossiers',
        icon: FolderIcon,
        roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'],
      },
      { id: 'files', name: 'Fichiers', icon: DocumentIcon, roles: ['admin'] },
    ];

    // Sections spécialisées pour les livreurs
    const livreurItems = [
      { id: 'planning', name: 'Planning', icon: CalendarDaysIcon, roles: ['livreur'] },
      { id: 'historique', name: 'Historique', icon: ClockIcon, roles: ['livreur'] },
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

  const theme = getRoleTheme(user?.role);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-neutral-600 opacity-75"></div>
        </div>
      )}

      {/* Layout principal avec Flexbox */}
      <div className="lg:flex lg:h-screen">
        {/* Sidebar */}
        <div
          className={`sidebar fixed inset-y-0 left-0 z-50 w-64 shadow-lg border-r relative transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* En-tête de la sidebar */}
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
            <button
              onClick={() => setSidebarOpen(false)}
              className="sidebar-toggle lg:hidden flex-shrink-0"
              aria-label="Fermer le menu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Section utilisateur compacte */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-lg flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                <span className="text-white font-bold text-sm">
                  {user && user.prenom && user.prenom.charAt(0).toUpperCase()}
                  {user && user.nom && user.nom.charAt(0).toUpperCase()}
                </span>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2" style={{ borderColor: 'var(--sidebar-bg)' }}></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user && user.prenom} {user && user.nom}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {user && getRoleDisplayName(user.role)}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation modernisee avec groupes */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            {/* Groupe Principal */}
            <div className="mb-8">
              <h3 className="px-3 sidebar-section-title mb-4">Principal</h3>
              <div className="space-y-1">
                {navigationItems.filter(item => ['dashboard', 'dossiers'].includes(item.id)).map(item => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`sidebar-item w-full flex items-center text-sm transition-all duration-200 group ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="mr-3 h-5 w-5 text-white" />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Groupe Gestion (pour admin et autres roles specifiques) */}
            {navigationItems.filter(item => ['users', 'permissions', 'files', 'statistics', 'settings'].includes(item.id)).length > 0 && (
              <div className="mb-8">
                <h3 className="px-3 sidebar-section-title mb-4">Gestion</h3>
                <div className="space-y-1">
                  {navigationItems.filter(item => ['users', 'permissions', 'files', 'statistics', 'settings'].includes(item.id)).map(item => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`sidebar-item w-full flex items-center text-sm transition-all duration-200 group ${isActive ? 'active' : ''}`}
                      >
                        <Icon className="mr-3 h-5 w-5 text-white" />
                        <span className="font-medium">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Groupe Outils (planning, historique pour livreurs) */}
            {navigationItems.filter(item => ['planning', 'historique'].includes(item.id)).length > 0 && (
              <div className="mb-8">
                <h3 className="px-3 sidebar-section-title mb-4">Outils</h3>
                <div className="space-y-1">
                  {navigationItems.filter(item => ['planning', 'historique'].includes(item.id)).map(item => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`sidebar-item w-full flex items-center text-sm transition-all duration-200 group ${isActive ? 'active' : ''}`}
                      >
                        <Icon className="mr-3 h-5 w-5 text-white" />
                        <span className="font-medium">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* Section actions */}
          <div className="p-3 border-t mt-auto" style={{ borderColor: 'var(--sidebar-border)' }}>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Main content container */}
        <div className="flex-1 flex flex-col lg:min-w-0">
          {/* Top header */}
          <header className="bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden -ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>

                <div className="ml-4 lg:ml-0">
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-white capitalize">
                    {activeSection === 'dashboard'
                      ? 'Tableau de bord'
                      : activeSection === 'users'
                        ? 'Gestion des utilisateurs'
                        : activeSection === 'permissions'
                          ? 'Rôles et Permissions'
                          : activeSection === 'dossiers'
                            ? 'Gestion des dossiers'
                            : activeSection === 'files'
                              ? 'Gestion des fichiers'
                              : activeSection === 'statistics'
                                ? 'Statistiques'
                                : activeSection === 'settings'
                                  ? 'Paramètres'
                                  : activeSection}
                  </h1>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Toggle dark mode */}
                <button
                  onClick={toggleDarkLight}
                  className="p-2 rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  title={resolvedTheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                >
                  {resolvedTheme === 'dark' ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                </button>

                {/* Centre de notifications */}
                <NotificationCenter />

                {/* Status indicator */}
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-success-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">En ligne</span>
                </div>

                {/* Badge rôle */}
                {user && (
                  <span
                    className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${theme.badge}`}
                  >
                    {theme.name}
                  </span>
                )}

                {/* CTA rôle: accès direct */}
                {user && (
                  <button
                    onClick={() => {
                      const preset = {};
                      switch (user.role) {
                        case 'preparateur':
                          // Pas de statut par défaut pour préparateur afin d'afficher
                          // toutes les catégories (En cours et À revoir)
                          break;
                        case 'imprimeur_roland':
                          preset.type = 'roland';
                          preset.status = 'en_cours';
                          break;
                        case 'imprimeur_xerox':
                          preset.type = 'xerox';
                          preset.status = 'en_cours';
                          break;
                        case 'livreur':
                          // Pas de statut par défaut pour livreur afin d'afficher
                          // toutes les sections (À livrer, En livraison, Terminé)
                          break;
                        default:
                          break;
                      }
                      try {
                        localStorage.setItem('dossiersInitFilters', JSON.stringify(preset));
                      } catch (e) {
                        // Ignore potential storage errors (e.g., private browsing)
                      }
                      onNavigate('dossiers');
                    }}
                    className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white hover:opacity-95 bg-gradient-to-r ${theme.gradient}`}
                    title="Aller aux dossiers pertinents"
                  >
                    Accès rapide dossiers
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Main content area - scrollable */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  activeSection: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

export default Layout;
