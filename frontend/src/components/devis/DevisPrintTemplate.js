import React from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';

/**
 * Composant de prévisualisation et d'impression du devis au format A4
 * Format professionnel avec logo, coordonnées, etc.
 */
const DevisPrintTemplate = ({ devis, user }) => {
  const handlePrint = () => {
    window.print();
  };

  const calculateTotal = () => {
    return (devis.items || []).reduce((sum, item) => {
      return sum + ((item.quantity || 1) * (item.unit_price || 0));
    }, 0);
  };

  const calculateTVA = (total, tvaPercentage = 18) => {
    return (total * tvaPercentage) / 100;
  };

  const total = calculateTotal();
  const tva = calculateTVA(total);
  const totalTTC = total + tva;

  const today = new Date();
  const devisDate = new Date(devis.created_at || today);
  const expiryDate = new Date(devisDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const formatDate = (date) => {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white">
      {/* Bouton impression - Non visible à l'impression */}
      <div className="print:hidden flex justify-end gap-4 p-4 bg-gray-100 border-b">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PrinterIcon className="w-4 h-4" />
          Imprimer
        </button>
      </div>

      {/* Document A4 */}
      <div className="max-w-[210mm] h-[297mm] mx-auto bg-white p-12 shadow-lg print:shadow-none print:max-w-none print:h-auto print:p-0 print:mx-0">
        {/* Header avec logo et coordonnées */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-200">
          {/* Logo/Nom entreprise */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              PLATEFORME IMPRESSION
            </h1>
            <p className="text-sm text-gray-600 mt-1">Solutions d'impression numériques</p>
          </div>

          {/* Coordonnées */}
          <div className="text-right text-xs text-gray-600">
            <p className="font-semibold text-gray-900">Senegal</p>
            <p>Dakar</p>
            <p>Tél: +221 77 123 45 67</p>
            <p>Email: info@plateforme-impression.sn</p>
          </div>
        </div>

        {/* Titre et numéro */}
        <div className="mb-8">
          <div className="flex justify-between items-baseline">
            <h2 className="text-3xl font-bold text-gray-900">DEVIS</h2>
            <div className="text-right">
              <p className="text-sm text-gray-600">Numéro devis</p>
              <p className="text-xl font-bold text-blue-600">{devis.numero_devis || 'DV-' + new Date().getTime()}</p>
            </div>
          </div>
        </div>

        {/* Informations client et dates */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Client */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Client</p>
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{devis.client_nom}</p>
              {devis.client_contact && <p className="text-gray-600">{devis.client_contact}</p>}
            </div>
          </div>

          {/* Dates */}
          <div>
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date du devis</p>
              <p className="text-sm text-gray-900 font-medium">{formatDate(devisDate)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Valide jusqu'au</p>
              <p className="text-sm text-gray-900 font-medium">{formatDate(expiryDate)}</p>
            </div>
          </div>
        </div>

        {/* Description générale */}
        {devis.details && (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Objet</p>
            <p className="text-sm text-gray-900">{devis.details}</p>
          </div>
        )}

        {/* Tableau des articles */}
        <div className="mb-8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-t-2 border-b-2 border-gray-400">
                <th className="text-left py-3 px-4 font-bold text-gray-900">Description</th>
                <th className="text-center py-3 px-4 font-bold text-gray-900 w-20">Quantité</th>
                <th className="text-right py-3 px-4 font-bold text-gray-900 w-28">Prix unitaire</th>
                <th className="text-right py-3 px-4 font-bold text-gray-900 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {(devis.items || []).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{item.description}</td>
                  <td className="text-center py-3 px-4 text-gray-900">{item.quantity || 1}</td>
                  <td className="text-right py-3 px-4 text-gray-900">
                    {(item.unit_price || 0).toFixed(2)} XOF
                  </td>
                  <td className="text-right py-3 px-4 font-semibold text-gray-900">
                    {((item.quantity || 1) * (item.unit_price || 0)).toFixed(2)} XOF
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            {/* Sous-total */}
            <div className="flex justify-between py-2 border-b border-gray-300">
              <span className="text-gray-700">Sous-total HT:</span>
              <span className="font-semibold text-gray-900">{total.toFixed(2)} XOF</span>
            </div>

            {/* TVA */}
            <div className="flex justify-between py-2 border-b border-gray-300">
              <span className="text-gray-700">TVA (18%):</span>
              <span className="font-semibold text-gray-900">{tva.toFixed(2)} XOF</span>
            </div>

            {/* Total TTC */}
            <div className="flex justify-between py-3 bg-blue-50 px-4 rounded font-bold text-lg border-2 border-blue-400">
              <span className="text-gray-900">MONTANT TTC:</span>
              <span className="text-blue-600">{totalTTC.toFixed(2)} XOF</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {devis.notes && (
          <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <p className="text-xs font-bold text-gray-600 uppercase mb-1">Notes:</p>
            <p className="text-sm text-gray-700">{devis.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-8 border-t-2 border-gray-200 text-center text-xs text-gray-600">
          <p className="mb-1">
            Ce devis reste valide jusqu'au <strong>{formatDate(expiryDate)}</strong>
          </p>
          <p className="mb-2">
            Après cette date, un nouveau devis vous sera proposé selon les tarifs en vigueur
          </p>
          <p className="text-gray-400 mt-4">
            Plateforme Impression | Document généré le {formatDate(today)}
          </p>
        </div>
      </div>

      {/* CSS pour l'impression */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
          .print\\:h-auto {
            height: auto !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:mx-0 {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default DevisPrintTemplate;
