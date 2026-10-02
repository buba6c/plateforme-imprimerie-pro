import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TruckIcon,
  MapPinIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  DocumentTextIcon,
  PhoneIcon,
  UserIcon,
  CreditCardIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import EncaissementModal from './livreur/EncaissementModal';
import RepousserLivraisonModal from './dossiers/RepousserLivraisonModal';
import LivreurPaiements from './livreur/LivreurPaiements';
import notificationService from '../services/notificationService';
import livraisonNotificationService from '../services/livraisonNotificationService';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';
import PropTypes from 'prop-types';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

const LivreurDashboardUltraModern = ({ user }) => {
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEncaissementModal, setShowEncaissementModal] = useState(false);
  const [showRepousserModal, setShowRepousserModal] = useState(false);
  const [dossierToEncaisser, setDossierToEncaisser] = useState(null);
  const [dossierToRepousser, setDossierToRepousser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [activeTab, setActiveTab] = useState('livraisons'); // 'livraisons' ou 'paiements'

    // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return 'nouveau';
    const statutLower = statut.toLowerCase().trim();
    const statusMap = {
      'nouveau': 'nouveau',
      'devis': 'devis',
      'valide': 'valide',
      'production': 'production',
      'production en cours': 'production',
      'imprime': 'imprime',
      'imprimé': 'imprime',
      'pret_livraison': 'pret_livraison',
      'prêt à livrer': 'pret_livraison',
      'pret a livrer': 'pret_livraison',
      'en_livraison': 'en_livraison',
      'en livraison': 'en_livraison',
      'livre': 'livre',
      'livré': 'livre',
      'annule': 'annule',
      'annulé': 'annule'
    };
    return statusMap[statutLower] || statutLower.replace(/\s+/g, '_');
  };

  // Fonction pour obtenir la route selon le statut du dossier
  const getRouteForDossier = (dossier) => {
    const statut = normalizeStatus(dossier.statut);
    switch (statut) {
      case 'imprime':
      case 'pret_livraison':
        return '/a-livrer';
      case 'en_livraison':
        return '/en-livraison';
      case 'livre':
        return '/livres';
      default:
        return '/a-livrer';
    }
  };

  // Mise à jour en temps réel
  useRealtimeUpdates({
    onDossierStatusChanged: (data) => {
      setDossiers(prevDossiers => {
        return prevDossiers.map(d => {
          if (d.id === data.dossierId) {
            return { 
              ...d, 
              statut: data.newStatus, 
              statut_dossier: data.newStatus,
              status: data.newStatus 
            };
          }
          return d;
        });
      });
      
      // Notification visuelle
      notificationService.info(`Statut du dossier mis à jour: ${data.newStatus}`);
    },
    onDossierUpdated: (data) => {
      if (data.dossier) {
        setDossiers(prevDossiers => {
          const exists = prevDossiers.find(d => d.id === data.dossierId);
          if (exists) {
            return prevDossiers.map(d => d.id === data.dossierId ? data.dossier : d);
          } else {
            // Vérifier si le dossier est pertinent pour le livreur
            const status = normalizeStatus(data.dossier.statut || data.dossier.statut_dossier);
            if (['imprime', 'pret_livraison', 'en_livraison', 'livre'].includes(status)) {
              return [...prevDossiers, data.dossier];
            }
          }
          return prevDossiers;
        });
      }
    },
  });

  // Chargement des dossiers
  const loadDossiers = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);
      const response = await dossiersService.getDossiers();
      
      if (response?.success && Array.isArray(response.dossiers)) {
        const livreurDossiers = response.dossiers.filter(d => {
          const status = normalizeStatus(d.statut || d.statut_dossier);
          return ['imprime', 'pret_livraison', 'en_livraison', 'livre'].includes(status);
        });
        setDossiers(livreurDossiers);
      } else {
        setDossiers([]);
      }
    } catch (error) {
      notificationService.error('Erreur lors du chargement des dossiers');
      setDossiers([]);
    } finally {
      setLoading(false);
      if (showLoader) setRefreshing(false);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    loadDossiers();
    const interval = setInterval(() => loadDossiers(false), 30000);
    return () => clearInterval(interval);
  }, [loadDossiers]);

  // Démarrage du service de notification des livraisons
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
        setShowDetailsModal(true);
      }
    };

    window.addEventListener('openDossierFromNotification', handleOpenDossier);

    // Cleanup
    return () => {
      livraisonNotificationService.stopChecking();
      window.removeEventListener('openDossierFromNotification', handleOpenDossier);
    };
  }, [dossiers]);

  // Gestion de l'encaissement
  const handleEncaisser = (dossier) => {
    setDossierToEncaisser(dossier);
    setShowEncaissementModal(true);
  };

  const handleEncaissementSuccess = () => {
    setShowEncaissementModal(false);
    setDossierToEncaisser(null);
    loadDossiers(true);
  };

  const handleEncaissementClose = () => {
    setShowEncaissementModal(false);
    setDossierToEncaisser(null);
  };

  // Gestion du report de livraison
  const handleRepousserLivraison = (dossier) => {
    setDossierToRepousser(dossier);
    setShowRepousserModal(true);
  };

  const handleRepousserSuccess = async (dossierId, nouvelleDateLivraison, raison) => {
    try {
      // Utiliser l'endpoint spécifique pour reporter la livraison
      await dossiersService.repousserLivraison(dossierId, {
        date_livraison_prevue: nouvelleDateLivraison,
        commentaire_report: raison
      });

      notificationService.success('Date de livraison reportée avec succès');
      
      // Recharger les dossiers
      await loadDossiers(true);
      
      // Réinitialiser les notifications pour ce dossier
      livraisonNotificationService.resetNotifications();
      
    } catch (error) {
      console.error('Erreur lors du report de la livraison:', error);
      notificationService.error('Erreur lors du report de la livraison');
      throw error;
    }
  };

  const handleRepousserClose = () => {
    setShowRepousserModal(false);
    setDossierToRepousser(null);
  };

  // Calcul des statistiques
  const stats = {
    total: dossiers.length,
    aLivrer: dossiers.filter(d => {
      const status = normalizeStatus(d.statut || d.statut_dossier);
      return ['imprime', 'pret_livraison'].includes(status);
    }).length,
    enLivraison: dossiers.filter(d => normalizeStatus(d.statut || d.statut_dossier) === 'en_livraison').length,
    livres: dossiers.filter(d => normalizeStatus(d.statut || d.statut_dossier) === 'livre').length,
  };

  // Formatage de date
  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return 'Erreur de date';
    }
  };

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

  // Filtrage et tri
  const getFilteredDossiers = useCallback((statusFilters) => {
    let filtered = dossiers.filter(d => statusFilters.includes(normalizeStatus(d.statut || d.statut_dossier)));

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.numero?.toString().includes(searchTerm) ||
        d.adresse_livraison?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));
    } else if (sortBy === 'client') {
      filtered.sort((a, b) => (a.nom_client || '').localeCompare(b.nom_client || ''));
    }

    return filtered;
  }, [dossiers, searchTerm, sortBy]);

  // Actions
  const handleDemarrerLivraison = async (dossier) => {
    if (!dossier.adresse_livraison) {
      notificationService.error('Adresse de livraison manquante');
      return;
    }
    try {
      await dossiersService.changeStatus(dossier.id, 'en_livraison', 'Livraison démarrée');
      notificationService.success('Livraison démarrée');
      loadDossiers(true);
    } catch (error) {
      console.error('Erreur lors du démarrage de la livraison:', error);
      notificationService.error('Erreur lors du démarrage de la livraison');
    }
  };

  const handleMarquerLivre = async (dossier) => {
    try {
      await dossiersService.changeStatus(dossier.id, 'livre', 'Livraison effectuée');
      notificationService.success('Marqué comme livré');
      loadDossiers(true);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      notificationService.error('Erreur lors de la mise à jour du statut');
    }
  };

  const handleViewDetails = (dossier) => {
    setSelectedDossier(dossier);
    setShowDetailsModal(true);
  };

  // Composant StatCard responsive
  const StatCard = ({ icon: Icon, label, value, gradient, textColor }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-2xl dark:shadow-2xl dark:shadow-black/40 dark:hover:shadow-black/50 transition-all duration-300 border border-white/10 dark:border-white/5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm text-white/90 dark:text-white/95 font-medium mb-1 sm:mb-2 drop-shadow-sm">{label}</p>
          <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${textColor} drop-shadow-md`}>{value}</p>
        </div>
        <div className="bg-white/20 dark:bg-white/30 p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-lg">
          <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-lg" />
        </div>
      </div>
    </div>
  );

  // Composant DeliveryCard responsive
  const DeliveryCard = ({ dossier, actions }) => {
    const hasPhone = (dossier.telephone_client || dossier.telephone || dossier.displayTelephone || '').trim() !== '';
    const hasAddress = (dossier.adresse_livraison || dossier.adresse || '').trim() !== '';

    // Système de couleurs unifié pour le statut
    const statusColors = getStatusColor(dossier.statut);
    
    // Type de machine si disponible
    const normalizedType = (dossier.machine_impression || dossier.type || '').toString().trim().toLowerCase();
    const typeConfig = {
      roland: {
        bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
        text: 'text-white',
        icon: '🖨️',
        label: 'Roland'
      },
      xerox: {
        bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
        text: 'text-white',
        icon: '📄',
        label: 'Xerox'
      }
    };
    
    const machineConfig = typeConfig[normalizedType];

    return (
      <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Bande de statut colorée en haut */}
        <div className={`h-1.5 ${statusColors.bg}`}></div>
        
        <div className="p-4">
          {/* En-tête avec numéro de commande et statut */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              {/* Numéro de commande */}
              {dossier.numero ? (
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {dossier.numero}
                </h3>
              ) : (
                <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400 truncate">
                  ⚠️ Numéro manquant
                </h3>
              )}
              
              {/* Client */}
              <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">{dossier.nom_client || dossier.client || dossier.preparateur_name || 'Non renseigné'}</span>
              </div>
            </div>
            
            {/* Badge de statut avec couleurs unifiées */}
            <span className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors.light} ${statusColors.text} ${statusColors.border}`}>
              {getStatusLabel(dossier.statut)}
            </span>
          </div>

          {/* Informations détaillées */}
          <div className="space-y-2 mb-4">
            {/* Badge statut de paiement */}
            {(() => {
              const isPaye = dossier.statut_paiement === 'paye' || dossier.statut_paiement === 'encaisse';
              const isPartiel = dossier.statut_paiement === 'partiel';
              
              if (isPaye) {
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs font-semibold border border-green-300 dark:border-green-700">
                    <CreditCardIcon className="h-4 w-4" />
                    <span>✓ Payé {dossier.montant_cfa ? `- ${new Intl.NumberFormat('fr-FR').format(dossier.montant_cfa)} FCFA` : ''}</span>
                  </div>
                );
              } else if (isPartiel) {
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md text-xs font-semibold border border-yellow-300 dark:border-yellow-700">
                    <CreditCardIcon className="h-4 w-4" />
                    <span>Paiement partiel</span>
                  </div>
                );
              } else if (dossier.mode_paiement_final === 'a_la_livraison') {
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md text-xs font-semibold border border-orange-300 dark:border-orange-700">
                    <CreditCardIcon className="h-4 w-4" />
                    <span>À encaisser: {dossier.montant_cfa ? new Intl.NumberFormat('fr-FR').format(dossier.montant_cfa) : '0'} FCFA</span>
                  </div>
                );
              } else {
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-xs font-semibold border border-red-300 dark:border-red-700">
                    <CreditCardIcon className="h-4 w-4" />
                    <span>Non payé {dossier.montant_cfa ? `- ${new Intl.NumberFormat('fr-FR').format(dossier.montant_cfa)} FCFA` : ''}</span>
                  </div>
                );
              }
            })()}
            
            {/* Type de machine si disponible */}
            {machineConfig && (
              <div className="flex items-center">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${machineConfig.bg} ${machineConfig.text} shadow-sm`}>
                  <span>{machineConfig.icon}</span>
                  <span>{machineConfig.label}</span>
                </span>
              </div>
            )}
            
            {/* Téléphone */}
            <div className="flex items-center text-sm">
              <PhoneIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              {hasPhone ? (
                <a
                  href={`tel:${dossier.telephone_client || dossier.telephone || dossier.displayTelephone}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {dossier.telephone_client || dossier.telephone || dossier.displayTelephone}
                </a>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Numéro manquant
                </span>
              )}
            </div>
            
            {/* Mode de paiement */}
            {dossier.mode_paiement && (
              <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <CreditCardIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="font-medium capitalize">
                  {dossier.mode_paiement}
                  {dossier.montant_a_encaisser && ` - ${dossier.montant_a_encaisser}€`}
                </span>
              </div>
            )}
            
            {/* Date (livraison réelle ou création) */}
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              {(() => {
                // Debug pour dossiers livrés
                if (dossier.statut === 'livre') {
                  console.log('🔍 Dossier livré - Données date:', {
                    numero: dossier.numero,
                    statut: dossier.statut,
                    date_livraison_reelle: dossier.date_livraison_reelle,
                    date_livraison: dossier.date_livraison,
                    date_livraison_prevue: dossier.date_livraison_prevue,
                    created_at: dossier.created_at,
                    date_creation: dossier.date_creation,
                    updated_at: dossier.updated_at
                  });
                }
                
                // Dossier livré : afficher la date de livraison réelle
                if (dossier.statut === 'livre') {
                  const dateLivraison = dossier.date_livraison_reelle || dossier.date_livraison || dossier.updated_at;
                  if (dateLivraison) {
                    return <span className="font-medium">Livré le: {formatDate(dateLivraison)}</span>;
                  } else {
                    return <span className="text-amber-600 dark:text-amber-400">⚠️ Date de livraison non renseignée</span>;
                  }
                }
                
                // Dossier en livraison : afficher la date prévue
                if (dossier.statut === 'en_livraison' && dossier.date_livraison_prevue) {
                  return <span className="font-medium">Livraison prévue: {formatDate(dossier.date_livraison_prevue)}</span>;
                }
                
                // Autres cas : afficher la date de création
                const dateCreation = dossier.date_creation || dossier.created_at;
                if (dateCreation) {
                  return <span>Créé le: {formatDate(dateCreation)}</span>;
                } else {
                  return <span className="text-gray-400">Date inconnue</span>;
                }
              })()}
            </div>

            {/* Nombre de fichiers */}
            {dossier.nombre_fichiers > 0 && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <DocumentTextIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{dossier.nombre_fichiers} fichier{dossier.nombre_fichiers > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-center">
            {actions}
          </div>
        </div>
        
        {/* Effet de hover */}
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 dark:group-hover:border-blue-400/20 rounded-xl transition-colors duration-300 pointer-events-none"></div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-gray-900">
        <div className="text-center">
          <TruckIcon className="h-12 w-12 sm:h-16 sm:w-16 text-amber-600 dark:text-amber-500 animate-pulse mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-gray-300 text-sm sm:text-base">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-gray-900 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Header moderne avec carte */}
        <div className="relative bg-white dark:bg-gray-800 rounded-3xl sm:rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-gray-200 dark:border-gray-700 p-6 sm:p-8 lg:p-10 overflow-hidden mb-6 sm:mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/8 via-orange-600/8 to-amber-600/8 dark:from-amber-400/10 dark:via-orange-400/10 dark:to-amber-400/10"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-amber-400/20 to-orange-400/20 dark:from-amber-500/10 dark:to-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-orange-400/20 to-amber-400/20 dark:from-orange-500/10 dark:to-amber-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-5">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 dark:from-amber-300 dark:via-orange-300 dark:to-amber-300 bg-clip-text text-transparent mb-2 sm:mb-3 drop-shadow-sm">
                🚚 Dashboard Livreur
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base lg:text-lg font-medium">
                Bienvenue, <span className="font-bold text-amber-600 dark:text-amber-400">{user?.prenom} {user?.nom}</span>
              </p>
            </div>
            <button
              onClick={() => loadDossiers(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-3.5 text-sm sm:text-base font-bold text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Statistiques */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <StatCard
            icon={DocumentTextIcon}
            label="Total"
            value={stats.total}
            gradient="from-amber-500 to-orange-600"
            textColor="text-white"
          />
          <StatCard
            icon={MapPinIcon}
            label="À livrer"
            value={stats.aLivrer}
            gradient="from-amber-500 to-orange-600"
            textColor="text-white"
          />
          <StatCard
            icon={TruckIcon}
            label="En livraison"
            value={stats.enLivraison}
            gradient="from-blue-500 to-cyan-600"
            textColor="text-white"
          />
          <StatCard
            icon={CheckCircleIcon}
            label="Livrés"
            value={stats.livres}
            gradient="from-emerald-500 to-green-600"
            textColor="text-white"
          />
        </div>

        {/* Onglets Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 p-2 mb-6 sm:mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('livraisons')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base transition-all duration-200 ${
                activeTab === 'livraisons'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <TruckIcon className="h-5 w-5" />
              <span>Mes Livraisons</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'livraisons' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {stats.total}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('paiements')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base transition-all duration-200 ${
                activeTab === 'paiements'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <CreditCardIcon className="h-5 w-5" />
              <span>Mes Paiements</span>
            </button>
          </div>
        </div>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'livraisons' ? (
          <>
            {/* Filtres */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 p-4 sm:p-6 mb-6 sm:mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400 dark:text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un dossier ou une adresse..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-neutral-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
              >
                <option value="date">Trier par date</option>
                <option value="client">Trier par client</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 1: À Livrer - Masquée si vide */}
        {getFilteredDossiers(['imprime', 'pret_livraison']).length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 overflow-hidden border-t-4 border-amber-500 dark:border-amber-600">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 px-4 sm:px-6 py-4 sm:py-5 border-b border-amber-200 dark:border-amber-700">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2 sm:gap-3">
                  <MapPinIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  📦 À Livrer
                  <span className="ml-auto text-base sm:text-lg bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-100 px-3 py-1 rounded-full">
                    {getFilteredDossiers(['imprime', 'pret_livraison']).length}
                  </span>
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {getFilteredDossiers(['imprime', 'pret_livraison']).slice(0, 2).map((dossier) => (
                    <DeliveryCard
                      key={dossier.id}
                      dossier={dossier}
                      actions={
                        <button
                          onClick={() => navigate(getRouteForDossier(dossier))}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                        >
                          <EyeIcon className="h-4 w-4" />
                          Voir
                        </button>
                      }
                    />
                  ))}
                </div>
                {getFilteredDossiers(['imprime', 'pret_livraison']).length > 2 && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => navigate('/a-livrer')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
                    >
                      <EyeIcon className="h-5 w-5" />
                      Voir tous les {getFilteredDossiers(['imprime', 'pret_livraison']).length} dossiers
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: En Livraison - Masquée si vide */}
        {getFilteredDossiers(['en_livraison']).length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 overflow-hidden border-t-4 border-blue-500 dark:border-blue-600">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 px-4 sm:px-6 py-4 sm:py-5 border-b border-blue-200 dark:border-blue-700">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 sm:gap-3">
                  <TruckIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  🚚 En Livraison
                  <span className="ml-auto text-base sm:text-lg bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100 px-3 py-1 rounded-full">
                    {getFilteredDossiers(['en_livraison']).length}
                  </span>
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {getFilteredDossiers(['en_livraison']).slice(0, 2).map((dossier) => (
                    <DeliveryCard
                      key={dossier.id}
                      dossier={dossier}
                      actions={
                        <button
                          onClick={() => navigate(getRouteForDossier(dossier))}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                        >
                          <EyeIcon className="h-4 w-4" />
                          Voir
                        </button>
                      }
                    />
                  ))}
                </div>
                {getFilteredDossiers(['en_livraison']).length > 2 && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => navigate('/en-livraison')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
                    >
                      <EyeIcon className="h-5 w-5" />
                      Voir toutes les {getFilteredDossiers(['en_livraison']).length} livraisons
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Livrés - Masquée si vide */}
        {getFilteredDossiers(['livre']).length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-2xl dark:shadow-black/30 overflow-hidden border-t-4 border-emerald-500 dark:border-emerald-600">
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 px-4 sm:px-6 py-4 sm:py-5 border-b border-emerald-200 dark:border-emerald-700">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2 sm:gap-3">
                  <CheckCircleIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  ✅ Livrés
                  <span className="ml-auto text-base sm:text-lg bg-emerald-200 dark:bg-emerald-700 text-emerald-800 dark:text-emerald-100 px-3 py-1 rounded-full">
                    {getFilteredDossiers(['livre']).length}
                  </span>
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {getFilteredDossiers(['livre']).slice(0, 2).map((dossier) => (
                    <DeliveryCard
                      key={dossier.id}
                      dossier={dossier}
                      actions={
                        <button
                          onClick={() => navigate(getRouteForDossier(dossier))}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                        >
                          <EyeIcon className="h-4 w-4" />
                          Voir
                        </button>
                      }
                    />
                  ))}
                </div>
                {getFilteredDossiers(['livre']).length > 2 && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => navigate('/livres')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
                    >
                      <EyeIcon className="h-5 w-5" />
                      Voir tous les {getFilteredDossiers(['livre']).length} dossiers livrés
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          /* Onglet Paiements */
          <LivreurPaiements user={user} />
        )}
      </div>

      {/* Modal détails */}
      {showDetailsModal && selectedDossier && (
        <DossierDetails
          dossier={selectedDossier}
          dossierId={selectedDossier.id || selectedDossier.folder_id || selectedDossier.dossier_id}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedDossier(null);
          }}
          onUpdate={loadDossiers}
        />
      )}

      {/* Modal encaissement */}
      {showEncaissementModal && dossierToEncaisser && (
        <EncaissementModal
          isOpen={showEncaissementModal}
          dossier={dossierToEncaisser}
          onClose={handleEncaissementClose}
          onSuccess={handleEncaissementSuccess}
        />
      )}

      {/* Modal repousser livraison */}
      {showRepousserModal && dossierToRepousser && (
        <RepousserLivraisonModal
          isOpen={showRepousserModal}
          dossier={dossierToRepousser}
          onClose={handleRepousserClose}
          onRepousser={handleRepousserSuccess}
        />
      )}
    </div>
  );
};

LivreurDashboardUltraModern.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    prenom: PropTypes.string,
    nom: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,
};

export default LivreurDashboardUltraModern;
