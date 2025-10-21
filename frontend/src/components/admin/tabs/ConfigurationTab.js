import React, { useState } from 'react';
import { CurrencyDollarIcon, CalculatorIcon, CogIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Settings from '../Settings';

const ConfigurationTab = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState('general');

  const subTabs = [
    { id: 'general', label: 'Paramètres généraux', icon: CogIcon },
    { id: 'tarifs', label: 'Tarification', icon: CalculatorIcon },
    { id: 'openai', label: 'OpenAI', icon: SparklesIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm border border-gray-200 dark:border-gray-700 flex gap-2 overflow-x-auto">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap
                ${isActive
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div>
        {activeSubTab === 'general' && <Settings user={user} />}
        
        {activeSubTab === 'tarifs' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalculatorIcon className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Configuration Tarification
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Gestion des grilles tarifaires Roland et Xerox
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
              <CurrencyDollarIcon className="h-5 w-5" />
              <span className="font-medium">En développement</span>
            </div>
          </div>
        )}

        {activeSubTab === 'openai' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Configuration OpenAI
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Intégration et paramétrage de l'IA pour la génération de devis
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg">
              <SparklesIcon className="h-5 w-5" />
              <span className="font-medium">Bientôt disponible</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigurationTab;
