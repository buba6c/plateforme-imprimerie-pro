import React from 'react';

/**
 * Composant badge pour afficher le montant avec visibilité par rôle
 */
const AmountBadge = ({ amount, userRole }) => {
  // Vérifier si l'utilisateur peut voir le montant
  const canViewAmount = ['admin', 'preparateur', 'livreur'].includes(userRole?.toLowerCase());

  if (!canViewAmount || !amount || amount <= 0) {
    return null;
  }

  return (
    <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-yellow-900 mb-1">
            💰 Montant manuel
          </h3>
          <p className="text-xs text-yellow-700">
            Visible uniquement par Admin/Préparateur/Livreur
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-yellow-900">
            {amount.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Montant défini manuellement
          </p>
        </div>
      </div>
    </div>
  );
};

export default AmountBadge;
