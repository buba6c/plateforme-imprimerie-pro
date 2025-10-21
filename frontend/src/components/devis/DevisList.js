import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  EyeIcon, 
  PencilIcon, 
  TrashIcon, 
  ArrowDownTrayIcon, 
  ArrowPathIcon,
  DocumentDuplicateIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import DevisDetailsModal from './DevisDetailsModal';
import intelligentComponentService from '../../services/intelligentComponentService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const DevisList = ({ user }) => {
  const [devis, setDevis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevis, setSelectedDevis] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [converting, setConverting] = useState({});
  const [complianceScores, setComplianceScores] = useState({});

  useEffect(() => {
    fetchDevis();
  }, [filter]);

  const fetchDevis = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const params = filter !== 'tous' ? { statut: filter } : {};
      
      const response = await axios.get(`${API_URL}/devis`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      const devisList = response.data.devis || [];
      setDevis(devisList);
      setLoading(false); // ← Afficher la liste immédiatement!

      // Charger les scores de conformité IA EN PARALLÈLE (non-bloquant)
      const scores = {};
      const compliancePromises = devisList.map(async (d) => {
        try {
          const result = await intelligentComponentService.analyzeCompliance(d);
          scores[d.id] = result;
        } catch (err) {
          // Silent fail - si conformité échoue, continuer
          scores[d.id] = { isCompliant: true, message: 'Non vérifié' };
        }
      });
      
      // Attendre tous les appels, mais sans bloquer le rendu
      Promise.all(compliancePromises).then(() => {
        setComplianceScores(scores);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erreur chargement devis:', error);
      setLoading(false);
    }
  };

  const downloadPDF = async (id, numero) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/devis/${id}/pdf`, {
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

  const deleteDevis = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(`${API_URL}/devis/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchDevis();
      alert('Devis supprimé avec succès');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const openDevisDetails = async (devisId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/devis/${devisId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedDevis(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Erreur chargement détails devis:', error);
      alert('Erreur lors du chargement des détails');
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedDevis(null);
    fetchDevis(); // Rafraîchir la liste
  };

  // Conversion devis → dossier
  const convertToDossier = async (devisId, devisData) => {
    if (!window.confirm('Voulez-vous convertir ce devis en dossier ?')) return;
    
    try {
      setConverting(prev => ({ ...prev, [devisId]: 'dossier' }));
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(`${API_URL}/devis/${devisId}/convert-to-dossier`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`✅ Devis converti en dossier : ${response.data.dossier.numero_commande || response.data.dossier.folder_id}`);
      fetchDevis();
    } catch (error) {
      console.error('Erreur conversion dossier:', error);
      alert(`❌ ${error.response?.data?.error || 'Erreur lors de la conversion'}`);
    } finally {
      setConverting(prev => ({ ...prev, [devisId]: null }));
    }
  };

  // Conversion devis → facture
  const convertToFacture = async (devisId, devisData) => {
    if (!window.confirm('Voulez-vous générer une facture à partir de ce devis ?')) return;
    
    try {
      setConverting(prev => ({ ...prev, [devisId]: 'facture' }));
      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post(`${API_URL}/devis/${devisId}/convert-to-facture`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`✅ Facture générée : ${response.data.facture.numero}`);
      fetchDevis();
    } catch (error) {
      console.error('Erreur génération facture:', error);
      alert(`❌ ${error.response?.data?.error || 'Erreur lors de la génération'}`);
    } finally {
      setConverting(prev => ({ ...prev, [devisId]: null }));
    }
  };

  const getStatutBadge = (statut) => {
    const badges = {
      brouillon: 'bg-gray-100 text-gray-800',
      en_attente: 'bg-yellow-100 text-yellow-800',
      valide: 'bg-green-100 text-green-800',
      refuse: 'bg-red-100 text-red-800',
      converti: 'bg-blue-100 text-blue-800'
    };
    
    const labels = {
      brouillon: 'Brouillon',
      en_attente: 'En attente',
      valide: 'Validé',
      refuse: 'Refusé',
      converti: 'Converti'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[statut]}`}>
        {labels[statut]}
      </span>
    );
  };

  const getComplianceBadge = (devisId) => {
    const score = complianceScores[devisId];
    if (!score) return null;
    
    const isCompliant = score.isCompliant;
    const className = isCompliant 
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
    
    return (
      <span title={score.message} className={`px-2 py-1 text-xs font-medium rounded-full ${className} flex items-center gap-1 cursor-help`}>
        {isCompliant ? '✓' : '⚠️'}
        {isCompliant ? 'Conforme' : 'À vérifier'}
      </span>
    );
  };

  const filteredDevis = devis.filter(d => 
    searchTerm === '' || 
    d.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.client_nom && d.client_nom.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Stats rapides
  const stats = {
    total: filteredDevis.length,
    brouillon: filteredDevis.filter(d => d.statut === 'brouillon').length,
    enAttente: filteredDevis.filter(d => d.statut === 'en_attente').length,
    valides: filteredDevis.filter(d => d.statut === 'valide').length,
    convertis: filteredDevis.filter(d => d.statut === 'converti').length,
    montantTotal: filteredDevis.reduce((sum, d) => sum + parseFloat(d.prix_final || d.prix_estime || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-blue-600" />
            {user.role === 'admin' ? 'Tous les devis' : 'Mes devis'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Gérez vos devis et convertissez-les facilement
          </p>
        </div>
        <button
          onClick={fetchDevis}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg font-medium"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Actualiser
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Total</p>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Brouillons</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.brouillon}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">En attente</p>
          <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">{stats.enAttente}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-3 border border-green-200 dark:border-green-700">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">Validés</p>
          <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">{stats.valides}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Convertis</p>
          <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1">{stats.convertis}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Rechercher par numéro ou client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="tous">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="en_attente">En attente</option>
          <option value="valide">Validé</option>
          <option value="refuse">Refusé</option>
          <option value="converti">Converti</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredDevis.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Aucun devis trouvé</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDevis.map((d) => (
            <div
              key={d.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {d.numero}
                    </h3>
                    {getStatutBadge(d.statut)}
                    {getComplianceBadge(d.id)}
                    <span className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded uppercase">
                      {d.machine_type}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Client</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {d.client_nom || 'Non renseigné'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Prix estimé</span>
                      <span className="text-gray-900 dark:text-white font-bold text-lg">
                        {(d.prix_final || d.prix_estime || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} F
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Date création</span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(d.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {user.role === 'admin' && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Préparateur</span>
                        <span className="text-gray-900 dark:text-white">
                          {d.prenom} {d.nom}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Boutons de conversion */}
                  {d.statut !== 'converti' && (d.statut === 'valide' || user.role === 'admin') && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => convertToDossier(d.id, d)}
                        disabled={converting[d.id] === 'dossier'}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        {converting[d.id] === 'dossier' ? 'Conversion...' : 'Convertir en Dossier'}
                      </button>
                      
                      <button
                        onClick={() => convertToFacture(d.id, d)}
                        disabled={converting[d.id] === 'facture'}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        <BanknotesIcon className="w-4 h-4" />
                        {converting[d.id] === 'facture' ? 'Génération...' : 'Générer Facture'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => downloadPDF(d.id, d.numero)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium whitespace-nowrap"
                    title="Télécharger PDF"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    <span className="text-sm">PDF</span>
                  </button>
                  
                  {d.statut !== 'converti' && (
                    <>
                      <button
                        onClick={() => openDevisDetails(d.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium whitespace-nowrap"
                        title="Voir détails"
                      >
                        <EyeIcon className="w-4 h-4" />
                        <span className="text-sm">Voir</span>
                      </button>
                      
                      <button
                        className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors font-medium whitespace-nowrap"
                        title="Modifier"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span className="text-sm">Modifier</span>
                      </button>
                      
                      <button
                        onClick={() => deleteDevis(d.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium whitespace-nowrap"
                        title="Supprimer"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span className="text-sm">Suppr.</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal détails devis */}
      <DevisDetailsModal 
        devis={selectedDevis}
        isOpen={showDetailsModal}
        onClose={closeDetailsModal}
      />
    </div>
  );
};

export default DevisList;
