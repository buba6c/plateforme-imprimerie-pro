/**
 * 🧭 LivreurNavigation - Navigation entre les sections
 * Onglets de navigation avec compteurs et animations
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentCheckIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const LivreurNavigation = memo(({
  activeSection = 'a_livrer',
  onSectionChange,
  stats = {},
  groupedDossiers = {}
}) => {
  
  // Configuration des onglets de navigation
  const navigationTabs = [
    {
      id: 'a_livrer',
      label: 'À Livrer',
      icon: DocumentCheckIcon,
      count: groupedDossiers.aLivrer?.length || stats.aLivrer || 0,
      color: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-500',
        active: 'bg-blue-600',
        hover: 'hover:bg-blue-50'
      },
      description: 'Dossiers prêts pour livraison'
    },
    {
      id: 'programmees',
      label: 'Programmées',
      icon: TruckIcon,
      count: groupedDossiers.programmees?.length || stats.programmees || 0,
      color: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-500',
        active: 'bg-orange-600',
        hover: 'hover:bg-orange-50'
      },
      description: 'Livraisons en cours'
    },
    {
      id: 'terminees',
      label: 'Terminées',
      icon: CheckCircleIcon,
      count: groupedDossiers.livrees?.length || stats.livrees || 0,
      color: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-500',
        active: 'bg-green-600',
        hover: 'hover:bg-green-50'
      },
      description: 'Livraisons terminées'
    }
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200"
    >
      <div className="flex p-1">
        {navigationTabs.map((tab, index) => {
          const isActive = activeSection === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSectionChange(tab.id)}
              className={`flex-1 relative group transition-all duration-200 rounded-lg px-4 py-3 ${
                isActive 
                  ? `${tab.color.active} text-white shadow-sm` 
                  : `text-gray-600 hover:bg-gray-50`
              }`}
            >
              {/* Contenu de l'onglet */}
              <div className="flex items-center justify-center space-x-2">
                {/* Icône */}
                <tab.icon className={`h-5 w-5 transition-transform duration-200 ${
                  isActive ? 'scale-105' : ''
                }`} />
                
                {/* Label et compteur */}
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm">
                    {tab.label}
                  </span>
                  {tab.count > 0 && (
                    <motion.span
                      key={tab.count}
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className={`px-2 py-0.5 rounded-md text-xs font-bold min-w-[24px] text-center ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : `${tab.color.bg} ${tab.color.text}`
                      }`}
                    >
                      {tab.count}
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Description (visible au hover) */}
              <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 transition-all duration-300 ${
                isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
              }`}>
                <div className=\"bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg\">
                  {tab.description}
                  <div className=\"absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45\" />
                </div>
              </div>

              {/* Indicateur actif */}
              {isActive && (
                <motion.div
                  layoutId=\"activeTab\"
                  className=\"absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-xl\"
                  transition={{ type: \"spring\", duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Informations supplémentaires */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className=\"mt-4 flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg\"
      >
        <div className=\"flex items-center space-x-4 text-sm text-gray-600\">
          <div className=\"flex items-center space-x-2\">
            <ClockIcon className=\"h-4 w-4\" />
            <span>Mis à jour maintenant</span>
          </div>
        </div>
        
        <div className=\"text-sm text-gray-500\">
          Total: {navigationTabs.reduce((sum, tab) => sum + tab.count, 0)} dossiers
        </div>
      </motion.div>
    </motion.nav>
  );
});

LivreurNavigation.displayName = 'LivreurNavigation';

export default LivreurNavigation;