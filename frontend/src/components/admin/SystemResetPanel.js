/**
 * 🧹 Panneau de Réinitialisation du Système
 * Interface pour réinitialiser complètement la plateforme
 */

import React, { useState, useEffect } from 'react';
import {
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  FolderIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { systemResetService } from '../../services/api';

const SystemResetPanel = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Charger les statistiques
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await systemResetService.getStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (err) {
      console.error('Erreur chargement stats:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (confirmation !== 'RESET') {
      setError('Veuillez taper "RESET" pour confirmer');
      return;
    }

    try {
      setResetting(true);
      setError(null);

      const response = await systemResetService.reset(confirmation);

      if (response.success) {
        setResult(response.data);
        setShowConfirm(false);
        setConfirmation('');
        // Recharger les stats
        setTimeout(() => {
          loadStats();
        }, 1000);
      }
    } catch (err) {
      console.error('Erreur réinitialisation:', err);
      setError(err.error || 'Erreur lors de la réinitialisation');
    } finally {
      setResetting(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 shadow-lg border border-white/10`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/80">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value || 0}</p>
        </div>
        <Icon className="h-10 w-10 text-white/30" />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <TrashIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Réinitialisation du Système
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Supprimer toutes les données et remettre la plateforme à zéro
            </p>
          </div>
        </div>
      </div>

      {/* Avertissement */}
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex gap-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">
              ⚠️ ATTENTION : Opération irréversible
            </h3>
            <p className="text-red-800 dark:text-red-300 mb-3">
              Cette action supprimera <strong>définitivement et sans possibilité de récupération</strong> :
            </p>
            <ul className="space-y-2 text-red-700 dark:text-red-300">
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>Tous les dossiers créés sur la plateforme</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>Tous les fichiers (PDF, images, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>Toutes les factures et devis</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>Tous les paiements et mouvements financiers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>Tout l'historique des statuts et notifications</span>
              </li>
            </ul>
            <p className="text-red-800 dark:text-red-300 mt-3 font-semibold">
              Les compteurs de numéros seront remis à 001.
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques actuelles */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      ) : stats && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📊 Données qui seront supprimées :
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={FolderIcon}
              label="Dossiers"
              value={stats.dossiers}
              color="from-blue-500 to-blue-600"
            />
            <StatCard
              icon={CurrencyDollarIcon}
              label="Paiements"
              value={stats.paiements}
              color="from-green-500 to-green-600"
            />
            <StatCard
              icon={DocumentTextIcon}
              label="Factures"
              value={stats.factures}
              color="from-purple-500 to-purple-600"
            />
            <StatCard
              icon={DocumentTextIcon}
              label="Devis"
              value={stats.devis}
              color="from-orange-500 to-orange-600"
            />
            <StatCard
              icon={ClockIcon}
              label="Historique"
              value={stats.historique}
              color="from-indigo-500 to-indigo-600"
            />
            <StatCard
              icon={ClockIcon}
              label="Notifications"
              value={stats.notifications}
              color="from-pink-500 to-pink-600"
            />
          </div>
        </div>
      )}

      {/* Éléments conservés */}
      <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6">
        <div className="flex gap-4">
          <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-2">
              🔒 Éléments conservés
            </h3>
            <ul className="space-y-2 text-green-700 dark:text-green-300">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Tous les comptes utilisateurs et leurs rôles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Les formulaires Roland et Xerox</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Les paramètres du site (couleurs, design, clés API)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>La structure des dossiers (uploads/)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Résultat de la réinitialisation */}
      {result && (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6">
          <div className="flex gap-4">
            <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-3">
                ✅ Réinitialisation terminée avec succès !
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-green-700 dark:text-green-300">
                <div>
                  <span className="font-semibold">{result.deleted.dossiers}</span> dossiers
                </div>
                <div>
                  <span className="font-semibold">{result.deleted.paiements}</span> paiements
                </div>
                <div>
                  <span className="font-semibold">{result.deleted.factures}</span> factures
                </div>
                <div>
                  <span className="font-semibold">{result.deleted.devis}</span> devis
                </div>
                <div>
                  <span className="font-semibold">{result.filesDeleted}</span> fichiers
                </div>
              </div>
              <p className="text-green-700 dark:text-green-300 mt-3">
                💡 Le prochain dossier créé aura le numéro <strong>001</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Bouton de réinitialisation */}
      {!showConfirm ? (
        <button
          onClick={() => {
            setShowConfirm(true);
            setError(null);
            setResult(null);
          }}
          className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-3"
        >
          <TrashIcon className="h-6 w-6" />
          Réinitialiser la plateforme
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-red-300 dark:border-red-700 space-y-4">
          <p className="text-gray-900 dark:text-white font-semibold">
            Tapez <code className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-red-600 dark:text-red-400 font-mono">RESET</code> pour confirmer :
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Tapez RESET"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
            disabled={resetting}
          />
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={resetting || confirmation !== 'RESET'}
              className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              {resetting ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Réinitialisation en cours...
                </>
              ) : (
                <>
                  <TrashIcon className="h-5 w-5" />
                  Confirmer la réinitialisation
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmation('');
                setError(null);
              }}
              disabled={resetting}
              className="px-6 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold rounded-lg transition-all duration-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemResetPanel;
