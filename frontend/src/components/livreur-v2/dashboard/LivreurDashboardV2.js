import React, { useState, useEffect } from 'react';
import { dossiersService } from '../../../services/apiAdapter';

/**
 * Dashboard Livreur V2 - Version temporaire simplifiée
 * À restaurer depuis une version stable
 */
const LivreurDashboardV2 = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDossiers();
  }, []);

  const loadDossiers = async () => {
    try {
      setLoading(true);
      const response = await dossiersService.getDossiers();
      const livraison = response.filter(d => 
        ['pret_livraison', 'en_livraison', 'livre'].includes(d.status || d.statut)
      );
      setDossiers(livraison);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🚚 Dashboard Livreur
        </h1>
        <p className="text-gray-600">
          Interface temporaire - Version complète à restaurer
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="text-yellow-600 text-sm font-semibold mb-2">PRÊTS À LIVRER</div>
          <div className="text-3xl font-bold text-yellow-800">
            {dossiers.filter(d => d.status === 'pret_livraison').length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="text-blue-600 text-sm font-semibold mb-2">EN LIVRAISON</div>
          <div className="text-3xl font-bold text-blue-800">
            {dossiers.filter(d => d.status === 'en_livraison').length}
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="text-green-600 text-sm font-semibold mb-2">LIVRÉS</div>
          <div className="text-3xl font-bold text-green-800">
            {dossiers.filter(d => d.status === 'livre').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <h2 className="text-lg font-bold text-gray-900">Dossiers de livraison ({dossiers.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {dossiers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    Aucun dossier à livrer
                  </td>
                </tr>
              ) : (
                dossiers.map((dossier) => (
                  <tr key={dossier.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dossier.numero_commande || dossier.numero || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {dossier.client_nom || dossier.client || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        dossier.status === 'pret_livraison' ? 'bg-yellow-100 text-yellow-800' :
                        dossier.status === 'en_livraison' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {dossier.status === 'pret_livraison' ? 'Prêt' :
                         dossier.status === 'en_livraison' ? 'En cours' :
                         'Livré'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(dossier.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LivreurDashboardV2;
