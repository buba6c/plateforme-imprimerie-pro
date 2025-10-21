import React from 'react';
import { ChartBarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

const StatisticsTab = ({ user }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ChartBarIcon className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Statistiques Avancées
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Graphiques et métriques détaillées en cours de développement
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg">
          <ArrowTrendingUpIcon className="h-5 w-5" />
          <span className="font-medium">Bientôt disponible</span>
        </div>
      </div>

      {/* Métriques basiques en attendant */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Dossiers traités ce mois', value: '42', color: 'blue' },
          { label: 'Temps moyen traitement', value: '3.2j', color: 'purple' },
          { label: 'Taux satisfaction', value: '94%', color: 'green' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{stat.label}</p>
            <p className={`text-3xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatisticsTab;
