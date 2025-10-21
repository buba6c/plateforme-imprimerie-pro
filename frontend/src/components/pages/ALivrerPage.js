import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, MapPinIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import DeliveryCard from '../DeliveryCard';
import DossierDetails from '../dossiers/DossierDetails';
import ProgrammerLivraisonModal from '../modals/ProgrammerLivraisonModal';
import ValiderLivraisonModal from '../modals/ValiderLivraisonModal';
import LoadingOverlay from '../transitions/LoadingOverlay';
import SuccessAnimation from '../transitions/SuccessAnimation';
import { SkeletonGrid } from '../transitions/SkeletonCard';
import LoadingButton from '../transitions/LoadingButton';
import useRealtimeUpdates from '../../hooks/useRealtimeUpdates';

const ALivrerPage = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAdresse, setFilterAdresse] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showProgrammerModal, setShowProgrammerModal] = useState(false);
  const [showLivrerModal, setShowLivrerModal] = useState(false);
  const [dossierEnCours, setDossierEnCours] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const itemsPerPage = 12;

  // Mise à jour en temps réel
  useRealtimeUpdates({
    onDossierStatusChanged: (data) => {
      // Mettre à jour le dossier localement avec animation
      setDossiers(prevDossiers => {
        const updatedDossiers = prevDossiers.map(d => 
          d.id === data.dossierId ? { ...d, status: data.newStatus, statut: data.newStatus } : d
        );
        
        // Filtrer à nouveau selon le statut de la page
        return updatedDossiers.filter(d => {
          const status = (d.status || d.statut || '').toLowerCase();
          return status === 'imprime' || status === 'pret_livraison';
        });
      });
    },
    onDossierUpdated: (data) => {
      // Mise à jour complète du dossier
      if (data.dossier) {
        setDossiers(prevDossiers => {
          const exists = prevDossiers.find(d => d.id === data.dossierId);
          if (exists) {
            return prevDossiers.map(d => d.id === data.dossierId ? data.dossier : d);
          } else {
            // Vérifier si le nouveau dossier doit être affiché sur cette page
            const status = (data.dossier.status || data.dossier.statut || '').toLowerCase();
            if (status === 'imprime' || status === 'pret_livraison') {
              return [...prevDossiers, data.dossier];
            }
          }
          return prevDossiers;
        });
      }
    },
    onDossierCreated: (data) => {
      // Ajouter le nouveau dossier si pertinent
      if (data.dossier) {
        const status = (data.dossier.status || data.dossier.statut || '').toLowerCase();
        if (status === 'imprime' || status === 'pret_livraison') {
          setDossiers(prevDossiers => [data.dossier, ...prevDossiers]);
        }
      }
    }
  });

  useEffect(() => {
    loadDossiers();
  }, []);

  const loadDossiers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dossiers');
      const allDossiers = response.data.dossiers || [];
      // Filtrer pour "À Livrer": imprime ou pret_livraison
      const filteredByStatus = allDossiers.filter(d => {
        const status = (d.status || d.statut || '').toLowerCase();
        return status === 'imprime' || status === 'pret_livraison';
      });
      setDossiers(filteredByStatus);
    } catch (error) {
      // Erreur silencieuse
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProgrammerLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setShowProgrammerModal(true);
  };

  const handleConfirmProgrammation = async (data) => {
    try {
      setLoadingAction(true);
      await api.put(`/dossiers/${dossierEnCours.id}`, {
        status: 'en_livraison',
        date_livraison_prevue: data.date_livraison_prevue,
        commentaire: data.commentaire
      });
      
      setShowProgrammerModal(false);
      setDossierEnCours(null);
      
      // Afficher animation de succès
      setSuccessMessage('Livraison programmée avec succès !');
      setShowSuccess(true);
      
      await loadDossiers();
    } catch (error) {
      alert('Erreur lors de la programmation');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLivrerDirectement = (dossier) => {
    setDossierEnCours(dossier);
    setShowLivrerModal(true);
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
      
      setShowLivrerModal(false);
      setDossierEnCours(null);
      
      // Afficher animation de succès
      setSuccessMessage('Livraison validée avec succès !');
      setShowSuccess(true);
      
      await loadDossiers();
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
    
    const matchAdresse = filterAdresse === 'all' || 
      (filterAdresse === 'avec' && d.adresse_livraison) ||
      (filterAdresse === 'sans' && !d.adresse_livraison);
    
    return matchSearch && matchAdresse;
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-amber-200 dark:border-amber-800 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-yellow-400/20 to-amber-400/20 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
                <MapPinIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-neutral-800 dark:text-white">
                  À Livrer
                </h1>
                <p className="text-neutral-600 dark:text-neutral-300 mt-1">
                  {filteredDossiers.length} dossier{filteredDossiers.length > 1 ? 's' : ''} à livrer
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
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-amber-500 dark:bg-neutral-700 dark:text-white"
            />
          </div>

          {/* Filtre Adresse */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <select
              value={filterAdresse}
              onChange={(e) => {
                setFilterAdresse(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-amber-500 dark:bg-neutral-700 dark:text-white appearance-none"
            >
              <option value="all">Toutes les adresses</option>
              <option value="avec">Avec adresse</option>
              <option value="sans">Sans adresse</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des dossiers */}
      {loading ? (
        <SkeletonGrid count={8} type="delivery" columns={2} />
      ) : paginatedDossiers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
          <MapPinIcon className="h-16 w-16 mx-auto text-neutral-300 dark:text-neutral-600 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-300">Aucun dossier à livrer</p>
        </div>
      ) : (
        <>
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.05
                }
              }
            }}
          >
            {paginatedDossiers.map((dossier) => (
              <motion.div
                key={dossier.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                transition={{ duration: 0.3 }}
              >
                <DeliveryCard
                  dossier={dossier}
                  onOpenDetails={openDetails}
                  actions={
                    <div className="flex flex-col gap-2">
                      {/* Programmer livraison */}
                      <LoadingButton
                        onClick={() => handleProgrammerLivraison(dossier)}
                        disabled={!dossier.adresse_livraison}
                        variant="primary"
                        size="md"
                        icon={CalendarIcon}
                        className="w-full"
                      >
                        Programmer
                      </LoadingButton>
                      
                      {/* Livrer directement avec paiement */}
                      <LoadingButton
                        onClick={() => handleLivrerDirectement(dossier)}
                        disabled={!dossier.adresse_livraison}
                        variant="success"
                        size="md"
                        icon={CheckCircleIcon}
                        className="w-full"
                      >
                        Livrer maintenant
                      </LoadingButton>
                    </div>
                  }
                />
              </motion.div>
            ))}
          </motion.div>

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
                      ? 'bg-amber-500 text-white shadow-lg'
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

      {/* Animations & Overlays */}
      <LoadingOverlay 
        isLoading={loadingAction} 
        message="Traitement en cours..."
        type="spinner"
      />
      
      <SuccessAnimation 
        isVisible={showSuccess}
        message={successMessage}
        onComplete={() => setShowSuccess(false)}
      />

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

      {/* Modal Programmer Livraison */}
      {showProgrammerModal && dossierEnCours && (
        <ProgrammerLivraisonModal
          isOpen={showProgrammerModal}
          onClose={() => {
            setShowProgrammerModal(false);
            setDossierEnCours(null);
          }}
          dossier={dossierEnCours}
          onConfirm={handleConfirmProgrammation}
        />
      )}

      {/* Modal Livrer Directement */}
      {showLivrerModal && dossierEnCours && (
        <ValiderLivraisonModal
          isOpen={showLivrerModal}
          onClose={() => {
            setShowLivrerModal(false);
            setDossierEnCours(null);
          }}
          dossier={dossierEnCours}
          onConfirm={handleConfirmLivraison}
        />
      )}
    </div>
  );
};

export default ALivrerPage;
