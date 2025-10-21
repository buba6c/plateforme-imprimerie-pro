import React, { useState, useEffect } from 'react';
import { 
  BanknotesIcon, 
  ArrowDownTrayIcon, 
  ArrowPathIcon, 
  EyeIcon, 
  MagnifyingGlassIcon,
  FunnelIcon 
} from '@heroicons/react/24/outline';
import axios from 'axios';
import FacturePreviewModal from './FacturePreviewModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const FacturesList = ({ user }) => {
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchFactures();
  }, [filter]);

  const fetchFactures = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const params = filter !== 'tous' ? { statut_paiement: filter } : {};
      
      const response = await axios.get(`${API_URL}/factures`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setFactures(response.data.factures || []);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (id, numero) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/factures/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${numero}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      alert('Erreur lors du téléchargement du PDF');
    }
  };

  const getStatutBadge = (statut) => {
    const badges = {
      non_paye: 'bg-red-100 text-red-800',
      paye: 'bg-green-100 text-green-800',
      partiellement_paye: 'bg-yellow-100 text-yellow-800',
      annule: 'bg-gray-100 text-gray-800'
    };
    
    const labels = {
      non_paye: 'Non payé',
      paye: 'Payé',
      partiellement_paye: 'Partiellement payé',
      annule: 'Annulé'
    };
    
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badges[statut]}`}>
        {labels[statut]}
      </span>
    );
  };

  const getModePaiementIcon = (mode) => {
    const modes = {
      wave: '💙',
      orange_money: '🧡',
      virement: '🏦',
      cheque: '🧾',
      especes: '💵'
    };
    return modes[mode] || '💳';
  };

  const openPreview = (facture) => {
    setSelectedFacture(facture);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setSelectedFacture(null);
  };

  // Filtrage avancé
  const filteredFactures = factures.filter(f => {
    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        f.numero?.toLowerCase().includes(term) ||
        f.client_nom?.toLowerCase().includes(term) ||
        f.dossier_numero?.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Filtre par date
    if (dateFrom) {
      const factureDate = new Date(f.created_at);
      const filterDate = new Date(dateFrom);
      if (factureDate < filterDate) return false;
    }
    if (dateTo) {
      const factureDate = new Date(f.created_at);
      const filterDate = new Date(dateTo);
      filterDate.setHours(23, 59, 59, 999);
      if (factureDate > filterDate) return false;
    }

    return true;
  });

  // Stats rapides
  const stats = {
    total: filteredFactures.length,
    montantTotal: filteredFactures.reduce((sum, f) => sum + parseFloat(f.montant_ttc || 0), 0),
    payees: filteredFactures.filter(f => f.statut_paiement === 'paye').length,
    nonPayees: filteredFactures.filter(f => f.statut_paiement === 'non_paye').length,
    enAttente: filteredFactures.filter(f => f.statut_paiement === 'partiellement_paye').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-green-600" />
            {user.role === 'admin' ? 'Toutes les factures' : 'Mes factures'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Gérez et consultez toutes vos factures en un coup d'œil
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
              showFilters 
                ? 'bg-green-600 text-white' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            Filtres
          </button>
          <button
            onClick={fetchFactures}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg font-medium"
          >
            <ArrowPathIcon className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total factures</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-blue-700 dark:text-blue-300" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Payées</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{stats.payees}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl p-4 border border-red-200 dark:border-red-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Non payées</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">{stats.nonPayees}</p>
            </div>
            <div className="text-3xl">❌</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Montant total</p>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                {stats.montantTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} F
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
      </div>

      {/* Filtres avancés */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Recherche */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔍 Rechercher
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Numéro, client, dossier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Filtre statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📊 Statut
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="tous">Tous les statuts</option>
                <option value="non_paye">Non payé</option>
                <option value="paye">Payé</option>
                <option value="partiellement_paye">Partiellement payé</option>
                <option value="annule">Annulé</option>
              </select>
            </div>

            {/* Date de début */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📅 Du
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Date de fin - nouvelle ligne si nécessaire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📅 Au
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Bouton reset */}
            <div className="md:col-span-3 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateFrom('');
                  setDateTo('');
                  setFilter('tous');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      ) : filteredFactures.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <BanknotesIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
            Aucune facture trouvée
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {searchTerm || dateFrom || dateTo ? 'Essayez de modifier vos filtres' : 'Les factures apparaîtront ici'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredFactures.map((f) => (
            <div
              key={f.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {f.numero}
                    </h3>
                    {getStatutBadge(f.statut_paiement)}
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Client</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {f.client_nom}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Montant TTC</span>
                      <span className="text-gray-900 dark:text-white font-bold text-lg">
                        {f.montant_ttc} FCFA
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Mode de paiement</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {getModePaiementIcon(f.mode_paiement)} {f.mode_paiement?.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Date création</span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(f.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    
                    {f.dossier_numero && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Dossier lié</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {f.dossier_numero}
                        </span>
                      </div>
                    )}
                    
                    {user.role === 'admin' && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Préparateur</span>
                        <span className="text-gray-900 dark:text-white">
                          {f.prenom} {f.nom}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-2">
                  <button
                    onClick={() => openPreview(f)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    title="Prévisualiser"
                  >
                    <EyeIcon className="w-5 h-5" />
                    <span className="hidden sm:inline font-medium">Voir</span>
                  </button>
                  
                  <button
                    onClick={() => downloadPDF(f.id, f.numero)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
                    title="Télécharger PDF"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span className="hidden sm:inline font-medium">PDF</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de prévisualisation */}
      <FacturePreviewModal
        facture={selectedFacture}
        isOpen={showPreview}
        onClose={closePreview}
        onDownload={downloadPDF}
      />
    </div>
  );
};

export default FacturesList;
