import React, { useState } from 'react';
import { 
  HomeIcon, 
  UsersIcon, 
  FolderIcon, 
  DocumentIcon,
  CogIcon,
  ChartBarIcon,
  BellIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const Layout = ({ children, user, onLogout, activeSection, onNavigate }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Navigation selon les rôles
  const getNavigationItems = () => {
    const baseItems = [
      { id: 'dashboard', name: 'Tableau de bord', icon: HomeIcon, roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'] }
    ];

    const adminItems = [
      { id: 'users', name: 'Utilisateurs', icon: UsersIcon, roles: ['admin'] },
      { id: 'permissions', name: 'Permissions', icon: ShieldCheckIcon, roles: ['admin'] },
      { id: 'statistics', name: 'Statistiques', icon: ChartBarIcon, roles: ['admin'] },
      { id: 'settings', name: 'Paramètres', icon: CogIcon, roles: ['admin'] }
    ];

    const workflowItems = [
      { id: 'dossiers', name: 'Dossiers', icon: FolderIcon, roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'] },
      { id: 'files', name: 'Fichiers', icon: DocumentIcon, roles: ['admin', 'preparateur'] }
    ];

    const allItems = [...baseItems, ...workflowItems, ...adminItems];
    
    return allItems.filter(item => item.roles.includes(user.role));
  };

  const navigationItems = getNavigationItems();

  const getRoleDisplayName = (role) => {
    const roleNames = {
      admin: 'Administrateur',
      preparateur: 'Préparateur',
      imprimeur_roland: 'Imprimeur Roland',
      imprimeur_xerox: 'Imprimeur Xerox',
      livreur: 'Livreur'
    };
    return roleNames[role] || role;
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-neutral-600 opacity-75"></div>
        </div>
      )}

      {/* Layout container */}
      <div className="lg:flex">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-800 shadow-lg dark:shadow-secondary-900/25 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 bg-blue-600">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center mr-3">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">EvocomPrint</h1>
            </div>
          </div>
          
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-neutral-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-blue-600 font-semibold text-sm">
                {user.prenom.charAt(0).toUpperCase()}{user.nom.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {user.prenom} {user.nom}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                {getRoleDisplayName(user.role)}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                    : 'text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 hover:text-neutral-900 dark:text-white'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Logout button */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 hover:text-neutral-900 dark:text-white rounded-md transition-colors duration-200"
          >
            <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
            Déconnexion
          </button>
        </div>

        {/* Main content */}
        <div className="lg:flex-1 lg:min-w-0">
        {/* Top header */}
        <header className="bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700">
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
                  {activeSection === 'dashboard' ? 'Tableau de bord' : 
                   activeSection === 'users' ? 'Gestion des utilisateurs' :
                   activeSection === 'permissions' ? 'Rôles et Permissions' :
                   activeSection === 'dossiers' ? 'Gestion des dossiers' :
                   activeSection === 'files' ? 'Gestion des fichiers' :
                   activeSection === 'statistics' ? 'Statistiques' :
                   activeSection === 'settings' ? 'Paramètres' :
                   activeSection}
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 relative">
                <BellIcon className="h-6 w-6" />
                <span className="absolute top-0 right-0 block h-2 w-2 bg-danger-500 rounded-full"></span>
              </button>

              {/* Status indicator */}
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-success-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-neutral-600 dark:text-neutral-300">En ligne</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;