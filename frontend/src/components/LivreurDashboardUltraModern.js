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
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import notificationService from '../services/notificationService';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';
import PropTypes from 'prop-types';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

const LivreurDashboardUltraModern = ({ user }) => {
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase().trim().replace(/\s+/g, '_');
    if (val.includes('imprime')) return 'imprime';
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('en_livraison')) return 'en_livraison';
    if (val.includes('livre')) return 'livre';
    return val;
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
      await dossiersService.updateDossierStatus(dossier.id, 'en_livraison');
      notificationService.success('Livraison démarrée');
      loadDossiers();
    } catch (error) {
      notificationService.error('Erreur lors du démarrage de la livraison');
    }
  };

  const handleMarquerLivre = async (dossier) => {
    try {
      await dossiersService.updateDossierStatus(dossier.id, 'livre');
      notificationService.success('Marqué comme livré');
      loadDossiers();
    } catch (error) {
      notificationService.error('Erreur lors de la mise à jour');
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
    const hasAddress = dossier.adresse_livraison && dossier.adresse_livraison.trim() !== '';
    const hasPhone = dossier.telephone_contact && dossier.telephone_contact.trim() !== '';

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
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {dossier.nom_client || dossier.numero || `Dossier #${dossier.id}`}
              </h3>
              <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                <UserIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">{dossier.preparateur_name || 'Non assigné'}</span>
              </div>
            </div>
            
            {/* Badge de statut avec couleurs unifiées */}
            <span className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusColors.light} ${statusColors.text} ${statusColors.border}`}>
              {getStatusLabel(dossier.statut)}
            </span>
          </div>

          {/* Informations détaillées */}
          <div className="space-y-2 mb-4">
            {/* Type de machine si disponible */}
            {machineConfig && (
              <div className="flex items-center">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${machineConfig.bg} ${machineConfig.text} shadow-sm`}>
                  <span>{machineConfig.icon}</span>
                  <span>{machineConfig.label}</span>
                </span>
              </div>
            )}
            
            {/* Adresse de livraison */}
            <div className="flex items-start text-sm">
              <MapPinIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
              {hasAddress ? (
                <span className="text-gray-700 dark:text-gray-300">
                  {dossier.adresse_livraison}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Adresse manquante
                </span>
              )}
            </div>
            
            {/* Téléphone */}
            <div className="flex items-center text-sm">
              <PhoneIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              {hasPhone ? (
                <a
                  href={`tel:${dossier.telephone_contact}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {dossier.telephone_contact}
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
            
            {/* Date de création */}
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <ClockIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
              <span>{formatDate(dossier.date_creation || dossier.created_at)}</span>
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleViewDetails(dossier)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
            >
              <EyeIcon className="h-4 w-4" />
              <span>Détails</span>
            </button>
            
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
                          onClick={() => handleDemarrerLivraison(dossier)}
                          disabled={!dossier.adresse_livraison}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                        >
                          <TruckIcon className="h-4 w-4" />
                          Livrer
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
                          onClick={() => handleMarquerLivre(dossier)}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors duration-200 shadow-sm hover:shadow"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Terminé
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
                      actions={null}
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
