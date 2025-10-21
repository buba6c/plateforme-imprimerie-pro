import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

/**
 * Composant d'affichage de l'estimation en temps réel
 * Affiche le prix estimé, les détails du calcul et les suggestions
 */
const RealtimeEstimation = ({ estimation, loading, error }) => {
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-700 dark:text-red-200">
          ❌ Erreur lors du calcul: {error}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin">
            <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-200">
            Calcul de l'estimation en cours...
          </p>
        </div>
      </div>
    );
  }

  if (!estimation) {
    return null;
  }

  const { prix_estime, details, calculation_time_ms, from_cache } = estimation;

  return (
    <div className="space-y-4">
      {/* Prix principal */}
      <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              💰 Prix Estimé
            </p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {prix_estime?.toLocaleString('fr-FR')} FCFA
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ⚡ {from_cache ? 'Depuis cache' : 'Calcul direct'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {calculation_time_ms}ms
            </p>
          </div>
        </div>
      </div>

      {/* Détails du calcul */}
      {details && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            📊 Détails du Calcul
          </h4>

          <div className="space-y-2">
            {/* Base */}
            {details.base && (
              <div className="flex justify-between items-start">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium">Base</p>
                  {details.base.support && (
                    <p className="text-xs text-gray-500">
                      {details.base.support.type} •{' '}
                      {details.base.support.prix_unitaire?.toLocaleString()} FCFA
                    </p>
                  )}
                  {details.base.dimensions && (
                    <p className="text-xs text-gray-500">
                      {details.base.dimensions.surface_m2} m²
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {details.base.support?.prix_total?.toLocaleString() || '0'} FCFA
                </p>
              </div>
            )}

            {/* Finitions */}
            {details.finitions && details.finitions.length > 0 && (
              <div className="flex justify-between items-start border-t border-gray-200 dark:border-gray-700 pt-2">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Finitions ({details.finitions.length})
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1 mt-1">
                    {details.finitions.map((f, idx) => (
                      <li key={idx}>
                        • {f.type}: {f.prix?.toLocaleString()} FCFA
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {details.finitions
                    .reduce((sum, f) => sum + (f.prix || 0), 0)
                    .toLocaleString()}{' '}
                  FCFA
                </p>
              </div>
            )}

            {/* Options */}
            {details.options && details.options.length > 0 && (
              <div className="flex justify-between items-start border-t border-gray-200 dark:border-gray-700 pt-2">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Options ({details.options.length})
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1 mt-1">
                    {details.options.map((o, idx) => (
                      <li key={idx}>
                        • {o.type}: {o.prix?.toLocaleString()} FCFA
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {details.options
                    .reduce((sum, o) => sum + (o.prix || 0), 0)
                    .toLocaleString()}{' '}
                  FCFA
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note de cache */}
      {from_cache && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-200">
          ⚡ Cette estimation est en cache - pour un calcul frais, modifiez les données
        </div>
      )}
    </div>
  );
};

export default RealtimeEstimation;
