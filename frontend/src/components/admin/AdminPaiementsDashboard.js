import React, { useState, useEffect } from 'react';
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  BellAlertIcon,
  CheckIcon,
  XMarkIcon,
  ArrowDownIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import DossierDetails from '../dossiers/DossierDetails';
import DossierCard from '../DossierCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const LIMIT = 50;

const AdminPaiementsDashboard = () => {
  const [paiements, setPaiements] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('tous');
  const [dossiersNonPayes, setDossiersNonPayes] = useState([]);
  const [processing, setProcessing] = useState({});
  const [showApprouveCA, setShowApprouveCA] = useState(false);
  const [showEnAttenteCA, setShowEnAttenteCA] = useState(false);
  const [showRefuseCA, setShowRefuseCA] = useState(false);
  const [viewingOngletImpayes, setViewingOngletImpayes] = useState(false);
  const [selectedImpayesClient, setSelectedImpayesClient] = useState(null);

  // Nouveaux états pour les filtres
  const [periode, setPeriode] = useState('mois'); // semaine, mois, annee
  const [rechercheClient, setRechercheClient] = useState('');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Modals
  const [selectedDossierId, setSelectedDossierId] = useState(null);
  const [showDossierDetails, setShowDossierDetails] = useState(false);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'approving' | 'refusing'
    paiementId: null,
    textData: ''
  });

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchPaiements(true);
    fetchDossiersNonPayes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, periode, rechercheClient]);

  useEffect(() => {
    if (offset > 0) {
      fetchPaiements(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const fetchPaiements = async (isReset = false) => {
    try {
      if (isReset) setLoading(true);
      else setLoadingMore(true);

      const token = localStorage.getItem('auth_token');
      const currentOffset = isReset ? 0 : offset;

      const params = {
        ...(filter !== 'tous' && { statut: filter }),
        ...(periode && { periode }),
        ...(rechercheClient && { client: rechercheClient }),
        limit: LIMIT,
        offset: currentOffset
      };

      const response = await axios.get(`${API_URL}/paiements`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const newPaiements = response.data.paiements || [];
      if (isReset) {
        setPaiements(newPaiements);
      } else {
        setPaiements(prev => [...prev, ...newPaiements]);
      }

      setHasMore(newPaiements.length === LIMIT);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchDossiersNonPayes = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/paiements/rappels/dossiers-non-payes`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { jours: 3 }
      });
      setDossiersNonPayes(response.data.dossiers_non_payes || []);
    } catch (error) {
      console.error('Erreur chargement dossiers non payés:', error);
    }
  };

  const rappelsAgreges = React.useMemo(() => {
    const clients = {};
    dossiersNonPayes.forEach(d => {
      const nom = d.client_nom || d.client || 'Client Inconnu';
      if (!clients[nom]) clients[nom] = { nom, count: 0, montant: 0, dossiersIds: [] };
      clients[nom].count += 1;
      clients[nom].montant += parseInt(d.prix_final || d.montant_cfa || d.montant || 0);
      clients[nom].dossiersIds.push(d.dossier_id || d.folder_id || d.id);
    });
    return Object.values(clients).sort((a, b) => b.montant - a.montant);
  }, [dossiersNonPayes]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setOffset(prev => prev + LIMIT);
    }
  };

  const openDossierDetails = (dossierId) => {
    if (!dossierId) return;
    setSelectedDossierId(dossierId);
    setShowDossierDetails(true);
  };

  const closeDossierDetails = () => {
    setShowDossierDetails(false);
    setSelectedDossierId(null);
  };

  const ignorerRappel = async (dossierId) => {
    const token = localStorage.getItem("auth_token");
    try {
      await axios.post(`${API_URL}/paiements/rappels/ignorer/${dossierId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDossiersNonPayes(prev => prev.filter(d => d.folder_id !== dossierId));
    } catch (error) {
      console.error("Erreur ignorer rappel:", error);
    }
  };

  const handleActionSubmit = async () => {
    const { type, paiementId, textData } = actionModal;
    if (!paiementId) return;

    if (type === 'refusing' && !textData.trim()) {
      alert("La raison du refus est obligatoire.");
      return;
    }

    try {
      setProcessing(prev => ({ ...prev, [paiementId]: type }));
      const token = localStorage.getItem('auth_token');
      const endpoint = type === 'approving' ? 'approuver' : 'refuser';
      const payload = type === 'approving' ? { commentaire: textData } : { raison: textData };

      await axios.post(`${API_URL}/paiements/${paiementId}/${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActionModal({ isOpen: false, type: null, paiementId: null, textData: '' });
      fetchPaiements(true);
    } catch (error) {
      console.error(`Erreur ${type}:`, error);
      alert(`Erreur: ${error.response?.data?.error || "Une erreur est survenue"}`);
    } finally {
      setProcessing(prev => ({ ...prev, [paiementId]: null }));
    }
  };

  const getStatutBadge = (statut) => {
    const badges = {
      en_attente: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: '⏳ En attente' },
      encaisse_livreur: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: '⏳ En attente' },
      approuve: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: '✅ Approuvé' },
      refuse: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: '❌ Refusé' },
      a_creer: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', label: 'À Créer' },
    };

    const badge = badges[statut] || badges.en_attente;

    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getModePaiementIcon = (mode) => {
    const icons = {
      wave: '💙',
      orange_money: '🧡',
      virement: '🏦',
      cheque: '🧾',
      especes: '💵',
      carte: '💳'
    };
    return icons[mode] || '💰';
  };

  return (
    <div className="space-y-6">

      {viewingOngletImpayes && (
        <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-900 overflow-y-auto w-full h-full">
           <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button 
                       onClick={() => { setViewingOngletImpayes(false); setSelectedImpayesClient(null); }}
                       className="p-3 bg-white dark:bg-gray-800 hover:bg-gray-100 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm"
                    >
                       <XMarkIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                         <BellAlertIcon className="w-8 h-8 text-blue-600" />
                         Tableau des impayés
                      </h1>
                      <p className="text-gray-500 mt-1">Tous les dossiers livrés qui n'ont pas encore été réglés.</p>
                    </div>
                 </div>
                 {selectedImpayesClient && (
                    <button onClick={() => setSelectedImpayesClient(null)} className="px-4 py-2 bg-blue-100 text-blue-800 font-semibold rounded-lg text-sm">
                       Afficher tous les clients (Filtre actif: {selectedImpayesClient})
                    </button>
                 )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                 {dossiersNonPayes
                    .filter(d => !selectedImpayesClient || (d.client_nom || d.client) === selectedImpayesClient)
                    .map(d => {
                      // Adapter le dossier s'il manque des champs pour DossierCard
                      const adaptedDossier = {
                         ...d,
                         id: d.folder_id || d.id,
                         nom_client: d.client_nom || d.client,
                         numero_dossier: d.numero_commande || d.numero,
                         date_creation: d.created_at || d.date_creation,
                         statut: d.statut_commande || d.statut,
                         montant_cfa: d.prix_final || d.montant_cfa || d.amount || d.montant || 0 
                      };
                      return (
                       <DossierCard 
                         key={adaptedDossier.id}
                         dossier={adaptedDossier}
                         onView={() => openDossierDetails(adaptedDossier.id)}
                         showDetails={false} 
                       />
                     );
                 })}
              </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            Gestion des Paiements
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Approuvez ou refusez les paiements en attente et visualisez l'historique
          </p>
        </div>
        <button
          onClick={() => {
            fetchPaiements(true);
            fetchDossiersNonPayes();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg font-medium"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 rounded-xl p-5 border border-blue-200 dark:border-blue-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total paiements</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.total || 0}</p>
            </div>
            <BanknotesIcon className="w-10 h-10 text-blue-600 dark:text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/40 rounded-xl p-5 border border-green-200 dark:border-green-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Approuvés</p>
                <button onClick={() => setShowApprouveCA(!showApprouveCA)} className="text-green-600/60 hover:text-green-600 transition-colors" title={showApprouveCA ? "Masquer montant" : "Afficher montant"}>
                  {showApprouveCA ? <EyeSlashIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                {stats.count_approuve || 0}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {showApprouveCA ? `${parseInt(stats.total_approuve || 0).toLocaleString('fr-FR')} FCFA` : '••••• FCFA'}
              </p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-green-600 dark:text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/40 dark:to-yellow-800/40 rounded-xl p-5 border border-yellow-200 dark:border-yellow-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">En attente</p>
                <button onClick={() => setShowEnAttenteCA(!showEnAttenteCA)} className="text-yellow-600/60 hover:text-yellow-600 transition-colors" title={showEnAttenteCA ? "Masquer montant" : "Afficher montant"}>
                  {showEnAttenteCA ? <EyeSlashIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
              </div>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                {stats.count_en_attente || 0}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {showEnAttenteCA ? `${parseInt(stats.total_en_attente || 0).toLocaleString('fr-FR')} FCFA` : '••••• FCFA'}
              </p>
            </div>
            <ClockIcon className="w-10 h-10 text-yellow-600 dark:text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/40 rounded-xl p-5 border border-red-200 dark:border-red-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Refusés</p>
                <button onClick={() => setShowRefuseCA(!showRefuseCA)} className="text-red-600/60 hover:text-red-600 transition-colors" title={showRefuseCA ? "Masquer montant" : "Afficher montant"}>
                  {showRefuseCA ? <EyeSlashIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
              </div>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                {stats.count_refuse || 0}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {showRefuseCA ? `${parseInt(stats.total_refuse || 0).toLocaleString('fr-FR')} FCFA` : '••••• FCFA'}
              </p>
            </div>
            <XCircleIcon className="w-10 h-10 text-red-600 dark:text-red-400 opacity-50" />
          </div>
        </div>
      </div>

      {/* Système Intelligent de Rappels - Dossiers non payés */}
      {rappelsAgreges.length > 0 && !viewingOngletImpayes && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-orange-100/50 dark:bg-orange-900/30 px-6 py-4 border-b border-orange-200 dark:border-orange-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <BellAlertIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
               <h2 className="text-lg font-bold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                 Dossiers livrés en attente de paiement
                 <span className="bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200 py-0.5 px-2 rounded-full text-xs ml-2">
                    {dossiersNonPayes.length} au total
                 </span>
               </h2>
             </div>
             <button 
               onClick={() => setViewingOngletImpayes(true)} 
               className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm"
             >
               Voir tous les dossiers impayés ({dossiersNonPayes.length})
             </button>
          </div>
          
          <div className="p-4 md:p-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {rappelsAgreges.slice(0, 6).map((client, idx) => (
               <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-orange-100 shadow-sm hover:shadow-md hover:border-blue-300 dark:border-gray-700 dark:hover:border-orange-500 transition-all flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">
                           {client.nom.charAt(0).toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{client.nom}</p>
                           <p className="text-sm font-medium text-red-500 flex items-center gap-1.5 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                              {client.count} dossier{client.count > 1 ? 's' : ''} en retard
                           </p>
                        </div>
                     </div>
                  </div>
                  <div className="mt-2 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-end">
                     <div>
                        <p className="text-xs text-gray-500 font-medium pb-1">Dette totale</p>
                        <p className="font-mono font-bold text-lg text-gray-900 dark:text-white leading-none">
                           {client.montant.toLocaleString('fr-FR')} F
                        </p>
                     </div>
                     <button
                        onClick={() => {
                          setViewingOngletImpayes(true);
                          setSelectedImpayesClient(client.nom);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider"
                     >
                        Voir la liste
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                     </button>
                  </div>
               </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {['tous', 'en_attente', 'approuve', 'refuse'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setOffset(0); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === f
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              {f === 'tous' ? 'Tous' : f === 'en_attente' ? 'En attente' : f === 'approuve' ? 'Approuvés' : 'Refusés'}
            </button>
          ))}
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                📅 Période
              </label>
              <select
                value={periode}
                onChange={(e) => { setPeriode(e.target.value); setOffset(0); }}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="">Toutes</option>
                <option value="semaine">Cette semaine (7 jours)</option>
                <option value="mois">Ce mois (30 jours)</option>
                <option value="annee">Cette année (365 jours)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                🔍 Recherche par client
              </label>
              <input
                type="text"
                placeholder="Nom du client..."
                value={rechercheClient}
                onChange={(e) => { setRechercheClient(e.target.value); setOffset(0); }}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Liste des paiements - Cards */}
      {loading && offset === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      ) : paiements.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <BanknotesIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Aucun paiement trouvé</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paiements.map((p) => (
            <div
              key={p.id || `potential-${p.dossier_id}`}
              className="group bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg dark:hover:border-gray-500 transition-all cursor-pointer relative"
              onClick={(e) => {
                // Prevent opening modal if clicking inside action buttons
                if (e.target.closest('button')) return;
                openDossierDetails(p.dossier_id);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatutBadge(p.statut)}
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {parseInt(p.montant).toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className="text-xl">
                      {getModePaiementIcon(p.mode_paiement_final || p.mode_paiement)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {(p.mode_paiement_final || p.mode_paiement)?.replace('_', ' ')}
                    </span>
                    
                    {/* Visual Hover Hint to click */}
                    <span className="ml-2 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Cliquer pour voir le dossier →
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Type</span>
                      <span className="text-gray-900 dark:text-white font-medium capitalize">
                        {p.type || 'N/A'}
                      </span>
                    </div>

                    {p.dossier_numero && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Dossier</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold underline decoration-transparent group-hover:decoration-blue-400 transition-colors">
                          {p.dossier_numero}
                        </span>
                      </div>
                    )}

                    {p.facture_numero && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Facture</span>
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          {p.facture_numero}
                        </span>
                      </div>
                    )}

                    {p.dossier_client && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Client</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {p.dossier_client}
                        </span>
                      </div>
                    )}

                    {p.prenom && p.nom && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Préparateur</span>
                        <span className="text-gray-900 dark:text-white">
                          {p.prenom} {p.nom}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Date</span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {p.reference_transaction && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Référence</span>
                        <span className="text-gray-900 dark:text-white font-mono text-xs">
                          {p.reference_transaction}
                        </span>
                      </div>
                    )}
                  </div>

                  {p.commentaire && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        💬 <span className="font-medium">Commentaire:</span> {p.commentaire}
                      </p>
                    </div>
                  )}

                  {p.raison_refus && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        ❌ <span className="font-medium">Raison du refus:</span> {p.raison_refus}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(p.statut === 'en_attente' || p.statut === 'encaisse_livreur') && (
                  <div className="ml-4 flex flex-col gap-2 relative z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionModal({ isOpen: true, type: 'approving', paiementId: p.id, textData: '' });
                      }}
                      disabled={processing[p.id] === 'approving'}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      {processing[p.id] === 'approving' ? 'Approbation...' : 'Approuver'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionModal({ isOpen: true, type: 'refusing', paiementId: p.id, textData: '' });
                      }}
                      disabled={processing[p.id] === 'refusing'}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                    >
                      <XCircleIcon className="w-5 h-5" />
                      {processing[p.id] === 'refusing' ? 'Refus...' : 'Refuser'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && !loading && paiements.length >= LIMIT && (
             <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border-2 border-green-600 text-green-600 dark:text-green-500 rounded-lg font-semibold hover:bg-green-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {loadingMore ? (
                    <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Chargement...</>
                  ) : (
                    <><ArrowDownIcon className="w-5 h-5" /> Charger plus de paiements</>
                  )}
                </button>
             </div>
          )}
        </div>
      )}

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
          ></div>
          
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-full ${actionModal.type === 'approving' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {actionModal.type === 'approving' ? <CheckIcon className="w-6 h-6 stroke-2" /> : <XMarkIcon className="w-6 h-6 stroke-2" />}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {actionModal.type === 'approving' ? 'Approuver le paiement' : 'Refuser le paiement'}
              </h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {actionModal.type === 'approving' 
                ? 'Êtes-vous certain de vouloir valider ce paiement ? Vous pouvez ajouter un commentaire (optionnel).'
                : 'Veuillez définir la raison du refus (champ obligatoire).'}
            </p>

            <textarea
              value={actionModal.textData}
              onChange={(e) => setActionModal(prev => ({ ...prev, textData: e.target.value }))}
              placeholder={actionModal.type === 'approving' ? "Commentaire interne (optionnel)..." : "Raison du rejet (obligatoire)*"}
              className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm mb-6 resize-none outline-none"
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setActionModal({ isOpen: false, type: null, paiementId: null, textData: '' })}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition"
              >
                Annuler
              </button>
              <button
                onClick={handleActionSubmit}
                className={`px-4 py-2 text-white rounded-lg font-medium transition shadow-sm ${
                  actionModal.type === 'approving' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionModal.type === 'approving' ? 'Confirmer' : 'Confirmer le Rejet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails Dossier */}
      <DossierDetails
        dossierId={selectedDossierId}
        isOpen={showDossierDetails}
        onClose={closeDossierDetails}
        onStatusChange={() => fetchPaiements(true)}
      />
    </div>
  );
};

export default AdminPaiementsDashboard;
