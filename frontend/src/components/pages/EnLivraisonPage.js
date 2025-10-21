import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, TruckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import api from '../../services/api';
import DeliveryCard from '../DeliveryCard';
import DossierDetails from '../dossiers/DossierDetails';
import ValiderLivraisonModal from '../modals/ValiderLivraisonModal';
import LoadingOverlay from '../transitions/LoadingOverlay';
import SuccessAnimation from '../transitions/SuccessAnimation';
import { SkeletonGrid } from '../transitions/SkeletonCard';
import LoadingButton from '../transitions/LoadingButton';
import useRealtimeUpdates from '../../hooks/useRealtimeUpdates';

const EnLivraisonPage = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showValiderModal, setShowValiderModal] = useState(false);
  const [dossierEnCours, setDossierEnCours] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const itemsPerPage = 12;

  // Mise à jour en temps réel
  useRealtimeUpdates({
    onDossierStatusChanged: (data) => {
      setDossiers(prevDossiers => {
        const updatedDossiers = prevDossiers.map(d => 
          d.id === data.dossierId ? { ...d, status: data.newStatus, statut: data.newStatus } : d
        );
        
        // Ne garder que les dossiers "en_livraison"
        return updatedDossiers.filter(d => {
          const status = (d.status || d.statut || '').toLowerCase();
          return status === 'en_livraison';
        });
      });
    },
    onDossierUpdated: (data) => {
      if (data.dossier) {
        const status = (data.dossier.status || data.dossier.statut || '').toLowerCase();
        setDossiers(prevDossiers => {
          const exists = prevDossiers.find(d => d.id === data.dossierId);
          if (status === 'en_livraison') {
            if (exists) {
              return prevDossiers.map(d => d.id === data.dossierId ? data.dossier : d);
            } else {
              return [...prevDossiers, data.dossier];
            }
          } else {
            // Retirer si le statut n'est plus "en_livraison"
            return prevDossiers.filter(d => d.id !== data.dossierId);
          }
        });
      }
    },
  });

  useEffect(() => {
    loadDossiers();
  }, []);

  const loadDossiers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dossiers?status=en_livraison');
      setDossiers(response.data.dossiers || []);
    } catch (error) {
      // Erreur silencieuse
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValiderLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setShowValiderModal(true);
  };

  const handleConfirmLivraison = async (data) => {
    try {
      setLoadingAction(true);
      await api.put(`/dossiers/${dossierEnCours.id}`, {
        status: 'livre',
        date_livraison: data.date_livraison,
        mode_paiement: data.mode_paiement,
        montant_cfa: data.montant_cfa,
        commentaire: data.commentaire
      });
      
      setShowValiderModal(false);
      setDossierEnCours(null);
      
      // Afficher animation de succès
      setSuccessMessage('Livraison validée avec succès !');
      setShowSuccess(true);
      
      // Le dossier sera retiré automatiquement via Socket.IO
      // await loadDossiers();
    } catch (error) {
      alert('Erreur lors de la validation');
    } finally {
      setLoadingAction(false);
    }
  };

  // Filtrage
  const filteredDossiers = dossiers.filter(d => {
    const matchSearch = !searchTerm || 
      d.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.numero_dossier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.adresse_livraison?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterDate === 'all') return matchSearch;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dossierDate = d.date_livraison_prevue ? new Date(d.date_livraison_prevue) : null;
    
    if (filterDate === 'today' && dossierDate) {
      const dosDate = new Date(dossierDate);
      dosDate.setHours(0, 0, 0, 0);
      return matchSearch && dosDate.getTime() === today.getTime();
    }
    
    if (filterDate === 'urgent' && dossierDate) {
      return matchSearch && dossierDate < new Date();
    }
    
    return matchSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredDossiers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDossiers = filteredDossiers.slice(startIndex, startIndex + itemsPerPage);

  const openDetails = (dossier) => {
    setSelectedDossier(dossier);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-blue-200 dark:border-blue-800 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-sky-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
                <TruckIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-neutral-800 dark:text-white">
                  En Livraison
                </h1>
                <p className="text-neutral-600 dark:text-neutral-300 mt-1">
                  {filteredDossiers.length} livraison{filteredDossiers.length > 1 ? 's' : ''} en cours
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recherche */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher par client, numéro ou adresse..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white"
            />
          </div>

          {/* Filtre Date */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <select
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white appearance-none"
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="urgent">En retard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des dossiers */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-300">Chargement...</p>
        </div>
      ) : paginatedDossiers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
          <TruckIcon className="h-16 w-16 mx-auto text-neutral-300 dark:text-neutral-600 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-300">Aucune livraison en cours</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {paginatedDossiers.map((dossier) => (
              <DeliveryCard
                key={dossier.id}
                dossier={dossier}
                onOpenDetails={openDetails}
                actions={
                  <button
                    onClick={() => handleValiderLivraison(dossier)}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Valider livraison
                  </button>
                }
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-neutral-300 dark:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
              >
                Précédent
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white dark:bg-gray-800 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-neutral-300 dark:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Détails */}
      {showDetails && selectedDossier && (
        <DossierDetails
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedDossier(null);
            loadDossiers();
          }}
          dossier={selectedDossier}
          dossierId={selectedDossier.id}
        />
      )}

      {/* Modal Valider Livraison */}
      {showValiderModal && dossierEnCours && (
        <ValiderLivraisonModal
          isOpen={showValiderModal}
          onClose={() => {
            setShowValiderModal(false);
            setDossierEnCours(null);
          }}
          dossier={dossierEnCours}
          onConfirm={handleConfirmLivraison}
        />
      )}
    </div>
  );
};

export default EnLivraisonPage;
