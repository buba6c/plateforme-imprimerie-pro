import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, MapPinIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import DeliveryCard from '../DeliveryCard';
import DossierDetails from '../dossiers/DossierDetails';
import ProgrammerLivraisonModal from '../modals/ProgrammerLivraisonModal';
import ValiderLivraisonModal from '../modals/ValiderLivraisonModal';
import RepousserLivraisonModal from '../dossiers/RepousserLivraisonModal';
import LoadingOverlay from '../transitions/LoadingOverlay';
import SuccessAnimation from '../transitions/SuccessAnimation';
import { SkeletonGrid } from '../transitions/SkeletonCard';
import LoadingButton from '../transitions/LoadingButton';
import useRealtimeUpdates from '../../hooks/useRealtimeUpdates';
import livraisonNotificationService from '../../services/livraisonNotificationService';
import notificationService from '../../services/notificationService';
import { getAvailableActions } from '../../workflow-adapter/workflowActions';
import { useAuth } from '../../context/AuthContext';

const ALivrerPage = () => {
  const { user } = useAuth(); // Récupérer l'utilisateur connecté
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAdresse, setFilterAdresse] = useState('all');
  const [filterProgrammation, setFilterProgrammation] = useState('all'); // Nouveau filtre
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showProgrammerModal, setShowProgrammerModal] = useState(false);
  const [showLivrerModal, setShowLivrerModal] = useState(false);
  const [showRepousserModal, setShowRepousserModal] = useState(false);
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

        // Filtrer à nouveau selon le statut de la page (À Livrer = pret_livraison UNIQUEMENT)
        return updatedDossiers.filter(d => {
          const status = (d.status || d.statut || '').toLowerCase().replace(/\s/g, '_');
          return status === 'pret_livraison';
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
            if (status === 'pret_livraison') {
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
        const status = (data.dossier.status || data.dossier.statut || '').toLowerCase().replace(/\s/g, '_');
        if (status === 'pret_livraison') {
          setDossiers(prevDossiers => [data.dossier, ...prevDossiers]);
        }
      }
    }
  });

  useEffect(() => {
    loadDossiers();
  }, []);

  // Gestion des notifications pour les livraisons programmées
  useEffect(() => {
    // Démarrer la vérification des livraisons programmées
    livraisonNotificationService.startChecking(
      async () => {
        // Récupérer les dossiers pour vérification
        return dossiers;
      },
      5 // Vérifier toutes les 5 minutes
    );

    // Écouter l'événement pour ouvrir un dossier depuis une notification
    const handleOpenDossier = (event) => {
      const { dossierId } = event.detail;
      const dossier = dossiers.find(d => d.id === dossierId);
      if (dossier) {
        setSelectedDossier(dossier);
        setShowDetails(true);
      }
    };

    window.addEventListener('openDossierFromNotification', handleOpenDossier);

    // Cleanup
    return () => {
      livraisonNotificationService.stopChecking();
      window.removeEventListener('openDossierFromNotification', handleOpenDossier);
    };
  }, [dossiers]);

  // Vérifier si un dossier a une livraison vraiment programmée
  const isLivraisonProgrammee = (dossier) => {
    if (!dossier.date_livraison_prevue) return false;
    if (dossier.date_livraison_prevue === '') return false;
    if (dossier.date_livraison_prevue === null) return false;

    // Vérifier que c'est une date valide
    try {
      const date = new Date(dossier.date_livraison_prevue);
      const isValid = !isNaN(date.getTime());

      // Log pour debug
      if (dossier.date_livraison_prevue && !isValid) {
        console.warn(`⚠️ Date invalide pour dossier ${dossier.id}:`, dossier.date_livraison_prevue);
      }

      return isValid;
    } catch (error) {
      console.error(`❌ Erreur validation date pour dossier ${dossier.id}:`, error);
      return false;
    }
  };

  const loadDossiers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dossiers');
      const allDossiers = response.data.dossiers || [];
      // Filtrer pour "À Livrer": UNIQUEMENT pret_livraison (dossiers prêts à être récupérés par le livreur)
      const filteredByStatus = allDossiers.filter(d => {
        const status = (d.status || d.statut || '').toLowerCase().replace(/\s/g, '_');
        // Seulement les dossiers au statut "prêt livraison"
        return status === 'pret_livraison';
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

      // Utiliser la route spéciale pour programmer la livraison (livreurs autorisés)
      await api.patch(`/dossiers/${dossierEnCours.id}/programmer-livraison`, {
        date_livraison_prevue: data.date_livraison_prevue,
        adresse_livraison: data.adresse_livraison,
        notes_livraison: data.commentaire
      });

      setShowProgrammerModal(false);
      setDossierEnCours(null);

      // Afficher animation de succès
      setSuccessMessage('Livraison programmée avec succès !');
      setShowSuccess(true);

      await loadDossiers();
    } catch (error) {
      console.error('Erreur programmation:', error);
      alert('Erreur lors de la programmation: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLivrerDirectement = async (dossier) => {
    try {
      // Charger les détails complets du dossier (inclut montant_cfa)
      const response = await api.get(`/dossiers/${dossier.id}`);
      const fullDossier = response.data.dossier || dossier;
      
      console.log('🔍 [ALivrerPage] Dossier complet chargé:', fullDossier);
      console.log('🔍 [ALivrerPage] montant_cfa:', fullDossier.montant_cfa);
      
      setDossierEnCours(fullDossier);
      setShowLivrerModal(true);
    } catch (error) {
      console.error('Erreur chargement détails dossier:', error);
      // Fallback: utiliser le dossier sans détails
      setDossierEnCours(dossier);
      setShowLivrerModal(true);
    }
  };

  const handleRepousserLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setShowRepousserModal(true);
  };

  const handleConfirmRepousser = async (dossierId, nouvelleDateLivraison, raison) => {
    try {
      setLoadingAction(true);

      // Utiliser l'endpoint spécifique pour reporter la livraison
      await api.patch(`/dossiers/${dossierId}/repousser-livraison`, {
        date_livraison_prevue: nouvelleDateLivraison,
        commentaire_report: raison
      });

      setShowRepousserModal(false);
      setDossierEnCours(null);

      // Afficher animation de succès
      setSuccessMessage('Date de livraison reportée avec succès !');
      setShowSuccess(true);

      await loadDossiers();

      // Réinitialiser les notifications pour ce dossier
      livraisonNotificationService.resetNotifications();

    } catch (error) {
      console.error('Erreur lors du report de la livraison:', error);
      const errorMsg = error.response?.data?.error ||
        error.response?.data?.message ||
        'Erreur lors du report de la livraison';
      notificationService.error(errorMsg);
      throw error;
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmLivraison = async (data) => {
    try {
      setLoadingAction(true);

      // 1. Changer le statut du dossier (endpoint autorisé pour livreur)
      await api.patch(`/dossiers/${dossierEnCours.id}/valider-livraison`, {
        commentaire: data.commentaire
      });

      // 2. Si montant renseigné, créer le paiement (sauf si déjà encaissé)
      if (data.montant_cfa && parseFloat(data.montant_cfa) > 0) {
        try {
          await api.post('/paiements/encaisser-livraison', {
            dossier_id: dossierEnCours.id,
            montant: parseFloat(data.montant_cfa),
            mode_paiement_final: data.mode_paiement || 'especes',
            commentaire: data.commentaire || 'Encaissement à la livraison'
          });
        } catch (paiementError) {
          // Si le paiement existe déjà, ce n'est pas grave
          if (paiementError.response?.status === 400 &&
            paiementError.response?.data?.error?.includes('déjà été encaissé')) {
            console.log('ℹ️ Paiement déjà existant pour ce dossier');
          } else {
            // Autre erreur, la propager
            throw paiementError;
          }
        }
      }

      setShowLivrerModal(false);
      setDossierEnCours(null);

      // Afficher animation de succès
      setSuccessMessage('Livraison validée avec succès !');
      setShowSuccess(true);

      await loadDossiers();
    } catch (error) {
      console.error('Erreur validation livraison:', error);
      const errorMsg = error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Erreur inconnue';
      alert('Erreur lors de la validation: ' + errorMsg);
    } finally {
      setLoadingAction(false);
    }
  };

  // 🔄 FONCTION UNIFIÉE : Génère les boutons d'action synchronisés avec DossierDetails
  const renderActionButtons = (dossier) => {
    if (!user) return null;

    const actions = getAvailableActions(user.role, dossier.statut || dossier.status, dossier);

    // Filtrer l'action "Programmer livraison" si le dossier est déjà programmé
    const filteredActions = actions.filter(action => {
      if ((action.label === 'Programmer livraison' || action.label === 'Préparer la livraison') && isLivraisonProgrammee(dossier)) {
        return false; // Ne pas afficher le bouton si déjà programmé
      }
      return true;
    });

    // Dédupliquer les actions similaires - ne garder que "Programmer livraison"
    const seenActions = new Set();
    const uniqueActions = filteredActions.filter(action => {
      // Normaliser les actions similaires
      let normalizedLabel = action.label;
      if (action.label === 'Préparer la livraison') {
        normalizedLabel = 'Programmer livraison';
      }

      if (seenActions.has(normalizedLabel)) {
        return false; // Action déjà vue
      }
      seenActions.add(normalizedLabel);
      return true;
    });

    // Mapper les actions workflow vers les handlers locaux
    const actionHandlers = {
      'Programmer livraison': () => handleProgrammerLivraison(dossier),
      'Livrer directement': () => handleLivrerDirectement(dossier),
      'Marquer comme livré': () => handleLivrerDirectement(dossier),
      'Préparer la livraison': () => handleProgrammerLivraison(dossier), // Fallback
    };

    // Configuration des boutons (icônes et styles)
    const buttonConfig = {
      'Programmer livraison': { icon: CalendarIcon, variant: 'primary', label: 'Programmer' },
      'Livrer directement': { icon: CheckCircleIcon, variant: 'success', label: 'Livrer maintenant' },
      'Marquer comme livré': { icon: CheckCircleIcon, variant: 'success', label: 'Livrer maintenant' },
      'Préparer la livraison': { icon: CalendarIcon, variant: 'primary', label: 'Programmer' },
    };

    return (
      <div className="flex flex-col gap-2">
        {uniqueActions.map((action, idx) => {
          const handler = actionHandlers[action.label];
          const config = buttonConfig[action.label] || { icon: CheckCircleIcon, variant: 'primary', label: action.label };

          if (!handler) {
            console.warn(`⚠️ Aucun handler trouvé pour l'action: ${action.label}`);
            return null;
          }

          return (
            <LoadingButton
              key={idx}
              onClick={handler}
              variant={config.variant}
              size="md"
              icon={config.icon}
              className="w-full"
            >
              {config.label}
            </LoadingButton>
          );
        })}

        {/* Bouton Repousser si dossier programmé */}
        {(() => {
          const shouldShow = isLivraisonProgrammee(dossier);
          if (shouldShow) {
            console.log(`✅ Bouton Repousser affiché pour dossier ${dossier.id}, date:`, dossier.date_livraison_prevue);
          }
          return shouldShow;
        })() && (
            <LoadingButton
              onClick={() => handleRepousserLivraison(dossier)}
              variant="secondary"
              size="md"
              icon={CalendarIcon}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              Repousser
            </LoadingButton>
          )}
      </div>
    );
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

    // Nouveau filtre programmation
    const matchProgrammation = filterProgrammation === 'all' ||
      (filterProgrammation === 'programmees' && d.date_livraison_prevue) ||
      (filterProgrammation === 'non_programmees' && !d.date_livraison_prevue);

    return matchSearch && matchAdresse && matchProgrammation;
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Filtre Programmation - NOUVEAU */}
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <select
              value={filterProgrammation}
              onChange={(e) => {
                setFilterProgrammation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-amber-500 dark:bg-neutral-700 dark:text-white appearance-none"
            >
              <option value="all">Toutes les livraisons</option>
              <option value="programmees">✓ Programmées</option>
              <option value="non_programmees">⏱ Non programmées</option>
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
                  actions={renderActionButtons(dossier)}
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
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === page
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

      {/* Modal Repousser Livraison */}
      {showRepousserModal && dossierEnCours && (
        <RepousserLivraisonModal
          isOpen={showRepousserModal}
          onClose={() => {
            setShowRepousserModal(false);
            setDossierEnCours(null);
          }}
          dossier={dossierEnCours}
          onRepousser={handleConfirmRepousser}
        />
      )}
    </div>
  );
};

export default ALivrerPage;
