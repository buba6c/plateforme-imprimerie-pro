/**
 * 💰 LivreurPaiements - Gestion des paiements de livraison
 */

import React from 'react';

const LivreurPaiements = ({ user }) => {
  return (
    <div className="p-6">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
          💰 Paiements et Encaissements
        </h2>
        <p className="text-neutral-600 dark:text-neutral-300 mb-4">
          Fonctionnalité en cours de développement.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Cette interface permettra de consulter l'historique des paiements.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LivreurPaiements;
