/**
 * 🎯 LivreurHeader - En-tête principal moderne
 * Header avec contrôles, informations utilisateur et outils
 */

import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TruckIcon,
  ArrowPathIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  MapIcon,
  BellIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  MoonIcon,
  SunIcon
} from '@heroicons/react/24/outline';
import { formatDate } from '../utils/livreurUtils';

const LivreurHeader = memo(({
  user = {},
  refreshing = false,
  onRefresh,
  lastUpdate = null,
  viewMode = 'cards',
  onViewModeChange,
  onToggleFilters,
  showFilters = false
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Modes d'affichage
  const viewModes = [
    { 
      id: 'cards', 
      label: 'Cartes', 
      icon: Squares2X2Icon, 
      description: 'Affichage en grille'
    },
    { 
      id: 'list', 
      label: 'Liste', 
      icon: ListBulletIcon, 
      description: 'Affichage en liste'
    },
    { 
      id: 'map', 
      label: 'Carte', 
      icon: MapIcon, 
      description: 'Vue géographique'
    }
  ];

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
    // TODO: Implémenter la logique du mode sombre
    document.documentElement.classList.toggle('dark');
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-b border-gray-200 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Ligne principale */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo et titre */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-4"
          >
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
              <TruckIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Centre de Livraison
              </h1>
              <p className="text-gray-600 text-sm font-medium mt-0.5">
                Bonjour {user.prenom || user.nom || 'Livreur'} ! 👋
              </p>
            </div>
          </motion.div>

          {/* Actions principales */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2"
          >
            {/* Bouton de rafraîchissement */}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all duration-200 disabled:opacity-50 group"
              title="Actualiser les données"
            >
              <ArrowPathIcon 
                className={`h-5 w-5 transition-transform duration-300 ${
                  refreshing ? 'animate-spin' : 'group-hover:rotate-90'
                }`} 
              />
            </button>

            {/* Toggle filtres */}
            <button
              onClick={onToggleFilters}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                showFilters 
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Filtres avancés"
            >
              <FunnelIcon className="h-5 w-5" />
            </button>

            {/* Mode sombre */}
            <button
              onClick={handleThemeToggle}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all duration-200"
              title={darkMode ? "Mode clair" : "Mode sombre"}
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>

            {/* Menu utilisateur */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all duration-200"
              >
                <UserCircleIcon className="h-5 w-5" />
                <span className="hidden md:block text-sm font-medium">
                  {user.nom || 'Utilisateur'}
                </span>
              </button>

              {/* Menu déroulant utilisateur */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                    onBlur={() => setShowUserMenu(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-semibold text-gray-900">{user.nom || 'Utilisateur'}</p>
                      <p className="text-sm text-gray-500">{user.email || 'livreur@example.com'}</p>
                    </div>
                    <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <Cog6ToothIcon className="h-4 w-4" />
                      <span>Paramètres</span>
                    </button>
                    <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                      <BellIcon className="h-4 w-4" />
                      <span>Notifications</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Ligne secondaire avec contrôles d'affichage et infos */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between"
        >
          {/* Modes d'affichage */}
          <div className="flex items-center space-x-3">
            <span className="text-gray-600 text-sm font-medium">Affichage :</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onViewModeChange(mode.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all duration-200 ${
                    viewMode === mode.id
                      ? 'bg-white text-blue-600 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                  title={mode.description}
                >
                  <mode.icon className="h-4 w-4" />
                  <span className="text-xs font-medium hidden sm:block">
                    {mode.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Informations de statut */}
          <div className="flex items-center space-x-4 text-gray-600">
            {/* Dernière mise à jour */}
            {lastUpdate && (
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium">
                  Mis à jour {formatDate(lastUpdate, { format: 'time' })}
                </span>
              </div>
            )}

            {/* Indicateur de connexion */}
            <div className="flex items-center space-x-2 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="font-medium">En ligne</span>
            </div>

            {/* Mode de travail */}
            <div className="hidden md:flex items-center space-x-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5">
              <TruckIcon className="h-4 w-4" />
              <span className="text-xs font-semibold">Mode Livraison</span>
            </div>
          </div>
        </motion.div>

        {/* Barre de progression de chargement (si en cours de rafraîchissement) */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 origin-left"
            >
              <div className="h-full bg-white/30 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </motion.header>
  );
});

LivreurHeader.displayName = 'LivreurHeader';

export default LivreurHeader;
