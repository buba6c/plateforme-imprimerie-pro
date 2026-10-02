import React from 'react';

/**
 * Composant pour afficher/éditer le montant (amount)
 * Visible uniquement pour Admin et Livreur, masqué pour Imprimeurs
 */
const AmountField = ({ amount, onChange, userRole, readOnly = false }) => {
  // Vérifier si l'utilisateur peut voir le montant
  const canViewAmount = ['admin', 'preparateur', 'livreur'].includes(userRole?.toLowerCase());

  if (!canViewAmount) {
    return null; // Masqué pour les imprimeurs
  }

  return (
    <div className="mb-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        💰 Montant manuel (facultatif)
        <span className="text-xs text-gray-500 ml-2">
          Visible uniquement par Admin/Préparateur/Livreur
        </span>
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || null)}
          placeholder="Montant en FCFA (optionnel)"
          readOnly={readOnly}
          className={`flex-1 px-4 py-2 border border-yellow-400 rounded-md focus:ring-2 focus:ring-yellow-500 ${
            readOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
          }`}
        />
        <span className="text-gray-600 font-medium">FCFA</span>
      </div>
      {amount && amount > 0 && (
        <p className="text-sm text-green-700 mt-2">
          ✓ Montant défini: {amount.toLocaleString('fr-FR')} FCFA
        </p>
      )}
      <p className="text-xs text-gray-500 mt-2">
        Si renseigné, ce montant sera utilisé au lieu du calcul automatique.
      </p>
    </div>
  );
};

export default AmountField;
