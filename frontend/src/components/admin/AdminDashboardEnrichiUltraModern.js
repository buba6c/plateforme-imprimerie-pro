import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  FolderIcon,
  UsersIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import useRealtimeUpdates from '../../hooks/useRealtimeUpdates';

// Importation des onglets
import OverviewTab from './tabs/OverviewTab';
import DossiersTab from './tabs/DossiersTab';
import UsersTab from './tabs/UsersTab';
import StatisticsTab from './tabs/StatisticsTab';
import PaiementsTab from './tabs/PaiementsTab';
import DevisFacturesTab from './tabs/DevisFacturesTab';
import ConfigurationTab from './tabs/ConfigurationTab';

const AdminDashboardEnrichiUltraModern = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    users: { total: 0, active: 0 },
    dossiers: { total: 0, actifs: 0 },
    paiements: { total: 0, enAttente: 0 },
    devis: { total: 0, valides: 0 },
  });

  // Système d'onglets
  const tabs = [
    {
      id: 'overview',
      label: 'Vue d\'ensemble',
      icon: HomeIcon,
      description: 'Dashboard principal avec KPIs',
    },
    {
      id: 'dossiers',
      label: 'Dossiers',
      icon: FolderIcon,
      badge: stats.dossiers.actifs || null,
      description: 'Gestion de tous les dossiers',
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: UsersIcon,
      badge: stats.users.active || null,
      description: 'Gestion des utilisateurs',
    },
    {
      id: 'statistics',
      label: 'Statistiques',
      icon: ChartBarIcon,
      description: 'Métriques et rapports avancés',
    },
    {
      id: 'paiements',
      label: 'Paiements',
      icon: CurrencyDollarIcon,
      badge: stats.paiements.enAttente || null,
      description: 'Suivi des paiements',
    },
    {
      id: 'devis-factures',
      label: 'Devis & Factures',
      icon: DocumentTextIcon,
      badge: stats.devis.total || null,
      description: 'Gestion commerciale',
    },
    {
      id: 'configuration',
      label: 'Configuration',
      icon: CogIcon,
      description: 'Paramètres et tarification',
    },
  ];

  // Mise à jour temps réel des stats
  useRealtimeUpdates({
    onDossierCreated: () => {
      setStats(prev => ({
        ...prev,
        dossiers: { ...prev.dossiers, total: prev.dossiers.total + 1, actifs: prev.dossiers.actifs + 1 },
      }));
    },
    onDossierStatusChanged: (data) => {
      if (data.newStatus === 'livre' || data.newStatus === 'termine') {
        setStats(prev => ({
          ...prev,
          dossiers: { ...prev.dossiers, actifs: Math.max(0, prev.dossiers.actifs - 1) },
        }));
      }
    },
  });

  // Sauvegarder l'onglet actif
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  // Restaurer l'onglet actif au chargement
  useEffect(() => {
    const savedTab = localStorage.getItem('adminActiveTab');
    const tabIds = ['overview', 'dossiers', 'users', 'statistics', 'paiements', 'devis-factures', 'configuration'];
    if (savedTab && tabIds.includes(savedTab)) {
      setActiveTab(savedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animation des onglets
  const tabVariants = {
    inactive: {
      opacity: 0.6,
      scale: 0.95,
    },
    active: {
      opacity: 1,
      scale: 1,
    },
  };

  const contentVariants = {
    enter: {
      opacity: 0,
      x: 20,
    },
    center: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: 0.2,
      },
    },
  };

  // Rendu du contenu selon l'onglet actif
  const renderTabContent = () => {
    const commonProps = { user, onNavigate, setStats };

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...commonProps} />;
      case 'dossiers':
        return <DossiersTab {...commonProps} />;
      case 'users':
        return <UsersTab {...commonProps} />;
      case 'statistics':
        return <StatisticsTab {...commonProps} />;
      case 'paiements':
        return <PaiementsTab {...commonProps} />;
      case 'devis-factures':
        return <DevisFacturesTab {...commonProps} />;
      case 'configuration':
        return <ConfigurationTab {...commonProps} />;
      default:
        return <OverviewTab {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard Administrateur
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {tabs.find(t => t.id === activeTab)?.description}
              </p>
            </div>
            
            {/* Info utilisateur */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.name || user.nom || 'Administrateur'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {(user.name || user.nom || 'A')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs horizontaux */}
        <div className="px-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  variants={tabVariants}
                  initial="inactive"
                  animate={isActive ? 'active' : 'inactive'}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                    whitespace-nowrap flex-shrink-0
                    ${isActive
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                  
                  {/* Badge */}
                  {tab.badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`
                        absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold
                        flex items-center justify-center
                        ${isActive
                          ? 'bg-yellow-400 text-blue-900'
                          : 'bg-red-500 text-white'
                        }
                      `}
                    >
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </motion.span>
                  )}

                  {/* Indicateur actif */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -bottom-2 left-0 right-0 h-1 bg-blue-500 rounded-t-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenu dynamique */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminDashboardEnrichiUltraModern;
