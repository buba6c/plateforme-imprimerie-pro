import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon, MagnifyingGlassIcon, FolderIcon,
  CalendarIcon, XMarkIcon, DocumentArrowDownIcon,
  ClockIcon, ChevronLeftIcon, ChevronRightIcon,
  EyeIcon, ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { dossiersService } from '../../../services/apiAdapter';
import DossierDetails from '../../dossiers/DossierDetails';
import DossierCard from '../../DossierCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const AdminClientsDatabase = ({ onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filtre
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);

  // Tiroir Client
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDossiers, setClientDossiers] = useState([]);
  const [loadingDossiers, setLoadingDossiers] = useState(false);

  // Fusion Client
  const [mergeModal, setMergeModal] = useState({ isOpen: false, sourceClient: null });
  const [targetClient, setTargetClient] = useState('');
  const [merging, setMerging] = useState(false);

  // Clic sur Dossier dans le tiroir -> Ouvrir <DossierDetails />
  const [viewedDossierId, setViewedDossierId] = useState(null);

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const offset = (page - 1) * limit;
      
      const response = await axios.get(`${API_URL}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit, offset, q: search }
      });

      if (response.data.success) {
         setClients(response.data.data);
         setTotal(response.data.total);
      }
    } catch (error) {
      console.error('Erreur chargement base clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
  };

  const loadClientDetails = async (clientName) => {
    setSelectedClient(clientName);
    setLoadingDossiers(true);
    try {
       const response = await dossiersService.getDossiers({ search: clientName, limit: 100 });
       const strictDossiers = response.dossiers.filter(d => 
         (d.client || d.nom_client || '').toLowerCase().includes(clientName.toLowerCase())
       );
       setClientDossiers(strictDossiers);
    } catch (err) {
       console.error("Erreur récupération dossiers:", err);
    } finally {
       setLoadingDossiers(false);
    }
  };

  const handleMergeClient = async () => {
    if (!targetClient.trim()) {
      alert("Veuillez saisir le nom du client avec lequel fusionner.");
      return;
    }
    const confirmMsg = `Êtes-vous sûr de vouloir transférer TOUS les dossiers de "${mergeModal.sourceClient}" vers "${targetClient}" ? Cette action est irréversible.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setMerging(true);
      const token = localStorage.getItem('auth_token');
      await axios.post(`${API_URL}/clients/merge`, {
        sourceClient: mergeModal.sourceClient,
        targetClient: targetClient
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Fusion effectuée avec succès !');
      setMergeModal({ isOpen: false, sourceClient: null });
      setTargetClient('');
      fetchClients();
    } catch (error) {
      console.error('Erreur fusion:', error);
      alert(error.response?.data?.error || 'Erreur lors de la fusion');
    } finally {
      setMerging(false);
    }
  };

  const getStatusColor = (status) => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('nouveau')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (normalized.includes('cours')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    if (normalized.includes('revoir')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (normalized.includes('impression')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    if (normalized.includes('livraison')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    if (normalized.includes('livre') || normalized.includes('termine')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Si on regarde un dossier, on affiche ça en priorité (superposé à tout le reste)
  if (viewedDossierId) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-100 dark:bg-gray-900 overflow-y-auto">
        <DossierDetails isOpen={true} dossierId={viewedDossierId} onClose={() => setViewedDossierId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative h-full">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl shadow-xl text-white">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3 tracking-wide">
            <UserGroupIcon className="w-9 h-9 opacity-80" />
            Portefeuille Clients
          </h2>
          <p className="text-blue-100 mt-2 font-medium opacity-90">
            {total} clients enregistrés et fidélisés
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-10 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-md shadow-inner transition-all"
          />
          <MagnifyingGlassIcon className="w-5 h-5 text-blue-200 absolute left-4 top-1/2 transform -translate-y-1/2" />
          {search && (
            <button onClick={clearSearch} className="absolute right-4 top-1/2 transform -translate-y-1/2 opacity-70 hover:opacity-100">
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Tableau des clients premium */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-700">
                <th className="px-6 py-5 font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest text-xs">Identité</th>
                <th className="px-6 py-5 font-bold text-center text-gray-800 dark:text-gray-200 uppercase tracking-widest text-xs">Volume</th>
                <th className="px-6 py-5 font-bold text-center text-gray-800 dark:text-gray-200 uppercase tracking-widest text-xs">Réussite</th>
                <th className="px-6 py-5 font-bold text-right text-gray-800 dark:text-gray-200 uppercase tracking-widest text-xs">Revenus Globaux</th>
                <th className="px-6 py-5 font-bold text-right text-gray-800 dark:text-gray-200 uppercase tracking-widest text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Chargement des données CRM...</p>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-gray-500 dark:text-gray-400">
                    Aucun client ne correspond à votre recherche.
                  </td>
                </tr>
              ) : (
                clients.map((client, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.3 }}
                    key={client.nom} 
                    className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-5" onClick={() => loadClientDetails(client.nom)}>
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50 dark:from-indigo-900/50 dark:to-blue-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200/50 dark:border-indigo-700/50 group-hover:scale-110 transition-transform shadow-sm">
                           {client.nom.charAt(0).toUpperCase()}
                         </div>
                         <div>
                           <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-base">{client.nom}</p>
                           <p className="text-xs text-gray-400 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             Dernier dossier: {new Date(client.dernier_dossier).toLocaleDateString()}
                           </p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center" onClick={() => loadClientDetails(client.nom)}>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-mono font-medium text-sm">
                        <FolderIcon className="w-4 h-4 text-gray-400" />
                        {client.total_dossiers}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center" onClick={() => loadClientDetails(client.nom)}>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-mono font-medium text-sm">
                        Livrés: {client.dossiers_livres}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2 text-indigo-700 dark:text-indigo-400" onClick={() => loadClientDetails(client.nom)}>
                      <span className="font-mono font-bold text-lg tracking-tight">
                        {parseInt(client.ca_genere).toLocaleString('fr-FR')} 
                      </span>
                      <span className="text-xs font-semibold opacity-70">FCFA</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <button
                         onClick={(e) => { e.stopPropagation(); setMergeModal({ isOpen: true, sourceClient: client.nom }); }}
                         className="inline-flex items-center justify-center p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm"
                         title="Fusionner avec un autre client"
                       >
                         <ArrowsRightLeftIcon className="w-5 h-5" />
                       </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-gray-50/50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
             Affichage de <span className="font-bold text-gray-900 dark:text-white">{(page - 1) * limit + 1}</span> à <span className="font-bold text-gray-900 dark:text-white">{Math.min(page * limit, total)}</span> sur <span className="font-bold text-gray-900 dark:text-white">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors shadow-sm"
            >
               <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800">
              {page} / {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors shadow-sm"
            >
               <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL FUSION */}
      {mergeModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-800"
          >
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <ArrowsRightLeftIcon className="w-6 h-6 text-red-500" />
                 Fusionner Clients
               </h3>
               <button onClick={() => setMergeModal({ isOpen: false, sourceClient: null })} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                 <XMarkIcon className="w-6 h-6" />
               </button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              Transférez tous les dossiers de <strong>"{mergeModal.sourceClient}"</strong> vers le client de votre choix. Cette action supprimera <strong>"{mergeModal.sourceClient}"</strong> de la liste si tous ses dossiers sont transférés.
            </p>

            <div className="space-y-4">
              <div>
                 <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                   Nom cible (Nouveau propriétaire)
                 </label>
                 <input 
                   type="text" 
                   value={targetClient}
                   onChange={e => setTargetClient(e.target.value)}
                   className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                   placeholder="Tapez le nom exact du client principal..."
                 />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                 <button 
                   onClick={() => setMergeModal({ isOpen: false, sourceClient: null })}
                   className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                 >
                   Annuler
                 </button>
                 <button 
                   disabled={merging}
                   onClick={handleMergeClient}
                   className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                 >
                   {merging ? 'Fusion en cours...' : 'Fusionner maintenant'}
                 </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Drawer Tiroir Client */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setSelectedClient(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full md:w-1/2 xl:w-2/5 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-800"
            >
              {/* Header du Drawer */}
              <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                 <div>
                   <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                     <span className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex flex-col items-center justify-center text-indigo-700 dark:text-indigo-400 shadow-inner border border-indigo-200 dark:border-indigo-800">
                       {selectedClient.charAt(0).toUpperCase()}
                     </span>
                     {selectedClient}
                   </h3>
                   <p className="text-sm font-medium text-gray-500 mt-1 pl-14">Historique complet des dossiers</p>
                 </div>
                 <button 
                   onClick={() => setSelectedClient(null)}
                   className="p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                 >
                   <XMarkIcon className="w-6 h-6" />
                 </button>
              </div>

              {/* Contenu du Drawer (Liste des dossiers) */}
              <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 dark:bg-gray-900/30 scrollbar-custom grid grid-cols-1 gap-4 items-start content-start">
                 {loadingDossiers ? (
                    <div className="flex flex-col items-center justify-center h-40">
                       <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
                       <p className="text-gray-500 font-medium">Recherche des dossiers en cours...</p>
                    </div>
                 ) : clientDossiers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                       <DocumentArrowDownIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                       <p className="text-gray-500 font-medium text-center">Aucun dossier trouvé pour l'instant.</p>
                    </div>
                 ) : (
                    clientDossiers.map((d, index) => (
                      <div key={d.id || index} onClick={() => setViewedDossierId(d.id)} className="cursor-pointer">
                        <DossierCard 
                          dossier={d} 
                          onView={() => setViewedDossierId(d.id)} 
                          showClient={false}
                          animationDelay={index * 0.05}
                        />
                      </div>
                    ))
                 )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminClientsDatabase;
