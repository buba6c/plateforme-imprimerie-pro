import React from 'react';
import { CurrencyDollarIcon, SparklesIcon } from '@heroicons/react/24/outline';

/**
 * Panneau latéral d'estimation de prix en temps réel
 * Affiche le breakdown détaillé du devis en cours de création
 */
const PriceEstimationPanel = ({ estimation, loading, machineType }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 sticky top-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <CurrencyDollarIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Estimation
          </h3>
        </div>
        
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const { items, subtotal, tva, total, hasData } = estimation;

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 sticky top-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <CurrencyDollarIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Estimation
          </h3>
        </div>
        
        <div className="text-center py-8">
          <SparklesIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Remplissez les champs pour voir l'estimation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 sticky top-6">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <CurrencyDollarIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Estimation
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
          {machineType === 'roland' ? '🖨️ Roland' : '📄 Xerox'}
        </p>
      </div>

      {/* Détail des lignes */}
      <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={index}
            className="pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white flex-1 pr-2">
                {item.label}
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                {item.total.toLocaleString('fr-FR')} F
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {item.unit_price.toLocaleString('fr-FR')} F × {item.quantity.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Totaux */}
      <div className="p-6 bg-gray-50 dark:bg-gray-900/50 space-y-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Sous-total HT</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {subtotal.toLocaleString('fr-FR')} F
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">TVA (18%)</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {tva.toLocaleString('fr-FR')} F
          </span>
        </div>
        
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-gray-900 dark:text-white">
              Total TTC
            </span>
            <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {total.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="px-6 pb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            💡 <strong>Estimation indicative</strong> - Le prix final peut varier selon les spécifications et conditions du marché
          </p>
        </div>
      </div>
    </div>
  );
};

export default PriceEstimationPanel;
