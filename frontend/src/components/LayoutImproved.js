import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  ChevronLeftIcon,
  ChevronRightIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CalculatorIcon,
  BanknotesIcon,
  MapPinIcon,
  TruckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import NotificationCenter from './notifications/NotificationCenter';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import PropTypes from 'prop-types';

const LayoutImproved = ({ children, activeSection, onNavigate, onSearch }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Navigation selon les rôles
  const getNavigationItems = () => {
    const baseItems = [
      {
        id: 'dashboard',
        name: 'Tableau de bord',
        icon: HomeIcon,
        color: 'from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600',
        roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'],
      },
    ];

    const adminItems = [
      { id: 'users', name: 'Utilisateurs', icon: UsersIcon, color: 'from-purple-600 to-purple-700 dark:from-purple-500 dark:to-purple-600', roles: ['admin'] },
      { id: 'permissions', name: 'Permissions', icon: ShieldCheckIcon, color: 'from-cyan-600 to-cyan-700 dark:from-cyan-500 dark:to-cyan-600', roles: ['admin'] },
      { id: 'statistics', name: 'Statistiques', icon: ChartBarIcon, color: 'from-emerald-600 to-emerald-700 dark:from-emerald-500 dark:to-emerald-600', roles: ['admin'] },
      { id: 'settings', name: 'Paramètres', icon: CogIcon, color: 'from-gray-600 to-gray-700 dark:from-gray-500 dark:to-gray-600', roles: ['admin'] },
    ];

    const workflowItems = [
      {
        id: 'dossiers',
        name: 'Dossiers',
        icon: FolderIcon,
        color: 'from-orange-600 to-orange-700 dark:from-orange-500 dark:to-orange-600',
        roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox'],
      },
      { id: 'files', name: 'Fichiers', icon: DocumentIcon, color: 'from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-indigo-600', roles: ['admin'] },
    ];

    const livreurItems = [
      { id: 'a-livrer', name: 'À Livrer', icon: MapPinIcon, color: 'from-red-600 to-red-700 dark:from-red-500 dark:to-red-600', roles: ['livreur'] },
      { id: 'en-livraison', name: 'En Livraison', icon: TruckIcon, color: 'from-yellow-600 to-yellow-700 dark:from-yellow-500 dark:to-yellow-600', roles: ['livreur'] },
      { id: 'livres', name: 'Livrés', icon: CheckCircleIcon, color: 'from-green-600 to-green-700 dark:from-green-500 dark:to-green-600', roles: ['livreur'] },
    ];

    // Section Devis & Facturation
    const devisFacturationItems = [
      // Pour les préparateurs
      { id: 'devis-create', name: 'Créer un devis', icon: DocumentTextIcon, color: 'from-pink-600 to-pink-700 dark:from-pink-500 dark:to-pink-600', roles: ['preparateur'] },
      { id: 'mes-devis', name: 'Mes devis', icon: DocumentTextIcon, color: 'from-fuchsia-600 to-fuchsia-700 dark:from-fuchsia-500 dark:to-fuchsia-600', roles: ['preparateur'] },
      { id: 'mes-factures', name: 'Mes factures', icon: BanknotesIcon, color: 'from-rose-600 to-rose-700 dark:from-rose-500 dark:to-rose-600', roles: ['preparateur'] },
      // IA Intelligente (pour tous sauf livreur)
      { id: 'ia-devis', name: '🤖 IA Intelligente', icon: DocumentTextIcon, color: 'from-violet-600 to-purple-700 dark:from-violet-500 dark:to-purple-600', roles: ['preparateur', 'admin'] },
      // Pour les admins
      { id: 'tous-devis', name: 'Tous les devis', icon: DocumentTextIcon, color: 'from-violet-600 to-violet-700 dark:from-violet-500 dark:to-violet-600', roles: ['admin'] },
      { id: 'toutes-factures', name: 'Toutes les factures', icon: BanknotesIcon, color: 'from-sky-600 to-sky-700 dark:from-sky-500 dark:to-sky-600', roles: ['admin'] },
      { id: 'paiements', name: 'Paiements', icon: CurrencyDollarIcon, color: 'from-teal-600 to-teal-700 dark:from-teal-500 dark:to-teal-600', roles: ['admin'] },
      { id: 'tarifs-config', name: 'Tarification', icon: CalculatorIcon, color: 'from-lime-600 to-lime-700 dark:from-lime-500 dark:to-lime-600', roles: ['admin'] },
      { id: 'openai-config', name: 'OpenAI', icon: CurrencyDollarIcon, color: 'from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600', roles: ['admin'] },
    ];

    const allItems = [...baseItems, ...workflowItems, ...devisFacturationItems, ...livreurItems, ...adminItems];
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 transition-colors duration-300">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        </div>
      )}

      {/* Layout principal */}
      <div className="lg:flex lg:h-screen">
        {/* Sidebar amélioré */}
        <div
          className={`
            fixed inset-y-0 left-0 z-50
            bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800
            dark:from-gray-900 dark:via-gray-800 dark:to-gray-900
            border-r border-white/10 dark:border-gray-700/30
            shadow-2xl dark:shadow-2xl dark:shadow-black/50
            flex flex-col overflow-hidden
            lg:sticky lg:z-30 lg:translate-x-0 lg:shadow-lg
            transition-all duration-300
            ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}
            w-72
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Header avec logo */}
          <div className="flex-shrink-0 px-4 py-6 border-b border-white/10 dark:border-gray-700/30">
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-3 flex-1 min-w-0 hover:scale-105 transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md shadow-lg flex items-center justify-center flex-shrink-0 border border-white/20">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                  </svg>
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <h1 className="text-white font-bold text-sm truncate leading-tight">Plateforme</h1>
                    <p className="text-white/60 text-xs truncate leading-tight">Impression</p>
                  </div>
                )}
              </div>

              {/* Bouton collapse */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex p-2 rounded-lg hover:bg-white/10 dark:hover:bg-gray-700/30 transition-colors text-white"
                title={sidebarCollapsed ? 'Étendre' : 'Réduire'}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="h-5 w-5" />
                ) : (
                  <ChevronLeftIcon className="h-5 w-5" />
                )}
              </button>

              {/* Bouton fermer mobile */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Info utilisateur */}
          {!sidebarCollapsed && (
            <div className="px-4 py-3 border-b border-white/10 dark:border-gray-700/30 bg-white/5 dark:bg-gray-800/50 backdrop-blur-sm">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Connecté</p>
              <p className="text-sm font-medium text-white truncate mt-1">{user?.email}</p>
              <p className="text-xs text-white/60 mt-1">{getRoleDisplayName(user?.role)}</p>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-custom">
            <ul className="space-y-1">
              {navigationItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id || location.pathname === `/${item.id}`;
                const isRoute = ['a-livrer', 'en-livraison', 'livres', 'ia-devis'].includes(item.id);

                return (
                  <li
                    key={item.id}
                    style={{
                      animation: `fadeInLeft 0.3s ease-out ${index * 0.03}s both`
                    }}
                  >
                    <button
                      onClick={() => {
                        if (isRoute) {
                          navigate(`/${item.id}`);
                        } else {
                          navigate('/');
                          if (onNavigate) onNavigate(item.id);
                        }
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-3 rounded-xl
                        transition-all duration-200 group relative overflow-hidden
                        ${sidebarCollapsed ? 'justify-center' : 'justify-start'}
                        ${
                          isActive
                            ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                            : 'text-white/80 hover:bg-white/10 dark:hover:bg-gray-700/30 dark:text-gray-300 dark:hover:text-white border border-transparent'
                        }
                      `}
                      title={sidebarCollapsed ? item.name : ''}
                    >
                      {/* Gradient background on active */}
                      {isActive && (
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-100"
                        />
                      )}

                      <div className="relative z-10 flex items-center gap-3 w-full">
                        <div className={`
                          p-2 rounded-lg flex-shrink-0 transition-all
                          ${isActive
                            ? `bg-gradient-to-br ${item.color || 'from-white/20 to-white/10'} shadow-lg`
                            : 'bg-white/10 group-hover:bg-white/20'
                          }
                        `}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {!sidebarCollapsed && (
                          <>
                            <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">{item.name}</span>
                            {isActive && (
                              <div
                                className="text-white/60"
                              >
                                <ChevronRightIcon className="h-4 w-4" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer avec logout */}
          <div className="flex-shrink-0 px-3 py-4 border-t border-white/10 dark:border-gray-700/30 bg-white/5 dark:bg-gray-800/50">
            {sidebarCollapsed ? (
              <button
                onClick={logout}
                className="w-full flex justify-center p-2.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-all border border-red-400/30"
                title="Déconnexion"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all border border-red-400/30 text-sm font-medium group"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span>Déconnexion</span>
              </button>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col lg:min-w-0">
          {/* Header */}
          <header className="flex-shrink-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {/* Menu button mobile */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Bars3Icon className="h-6 w-6" />
                </button>

                {/* Page title */}
                <div
                  key={activeSection}
                >
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {activeSection === 'dashboard'
                      ? '📊 Tableau de bord'
                      : activeSection === 'users'
                        ? '👥 Utilisateurs'
                        : activeSection === 'permissions'
                          ? '🔐 Permissions'
                          : activeSection === 'dossiers'
                            ? '📁 Dossiers'
                            : activeSection === 'files'
                              ? '📄 Fichiers'
                              : activeSection === 'statistics'
                                ? '📈 Statistiques'
                                : activeSection === 'settings'
                                  ? '⚙️ Paramètres'
                                  : activeSection}
                  </h1>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-3 ml-auto">
                <ThemeToggle />
                <NotificationCenter />
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/50 dark:border-emerald-900/50">
                  <div
                    className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"
                  />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">En ligne</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto scrollbar-custom">
            <div className="px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

LayoutImproved.propTypes = {
  children: PropTypes.node.isRequired,
  activeSection: PropTypes.string.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onSearch: PropTypes.func,
};

export default LayoutImproved;
