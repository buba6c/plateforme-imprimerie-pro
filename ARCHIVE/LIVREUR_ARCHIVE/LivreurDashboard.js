/**
 * 🚚 Interface Livreur - Version 2.0 avec Composants Modernes
 * Utilise les nouveaux composants livreur-v2
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TruckIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';

// Import des nouveaux composants V2
import {
  ALivrerSectionV2,
  ProgrammeesSectionV2,
  TermineesSectionV2
} from './livreur-v2/sections';
import { LoadingState } from './livreur-v2/common';

// Services existants
import { dossiersService } from '../services/apiAdapter';
import notificationService from '../services/notificationService';
import { useToast } from './ui/Toast';

const LivreurDashboard = ({ user, activeSection = 'dashboard', onNavigate }) => {
  // États principaux
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Navigation et interface
  const [currentSection, setCurrentSection] = useState('a_livrer'); // a_livrer, programmees, terminees
  const [viewMode, setViewMode] = useState('cards'); // cards, list
  
  // Hook toast appelé au niveau supérieur (respecte les Rules of Hooks)
  const toast = useToast();

  // 📊 Fonctions utilitaires pour normalisation des données
  const normalizeDeliveryStatus = useCallback((statut) => {
    if (!statut) return 'imprime';
    const val = String(statut).toLowerCase().trim();
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('livraison') && !val.includes('pret')) return 'en_livraison';
    if (val.includes('livre') || val.includes('delivered')) return 'livre';
    if (val.includes('retour') || val.includes('return')) return 'retour';
    if (val.includes('echec') || val.includes('failed')) return 'echec_livraison';
    if (val.includes('reporte') || val.includes('postponed')) return 'reporte';
    return 'imprime';
  }, []);

  const calculateDeliveryPriority = useCallback((dossier) => {
    const now = new Date();
    const created = new Date(dossier.created_at);
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    
    if (dossier.date_livraison_prevue) {
      const datePrevu = new Date(dossier.date_livraison_prevue);
      const diffPrevu = (datePrevu - now) / (1000 * 60 * 60 * 24);
      
      if (diffPrevu < 0) return 'urgent';
      if (diffPrevu < 1) return 'high';
      if (diffPrevu < 2) return 'medium';
    }
    
    if (daysDiff > 7) return 'high';
    if (daysDiff > 3) return 'medium';
    return 'low';
  }, []);

  const getDeliveryZone = useCallback((dossier) => {
    const codePostal = String(dossier.code_postal_livraison || dossier.code_postal || '').trim();
    
    if (codePostal.startsWith('75')) return 'paris';
    if (['92', '93', '94'].some(prefix => codePostal.startsWith(prefix))) return 'petite_couronne';
    if (['77', '78', '91', '95'].some(prefix => codePostal.startsWith(prefix))) return 'grande_couronne';
    return 'autre';
  }, []);

  // 🚚 Récupération et enrichissement des dossiers
  const fetchDossiers = useCallback(async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const data = await dossiersService.getDossiers({});
      let dossiersList = Array.isArray(data?.dossiers) ? data.dossiers : [];
      
      // Enrichissement des données pour les nouveaux composants
      dossiersList = dossiersList.map(d => {
        const deliveryStatus = normalizeDeliveryStatus(d.statut || d.status);
        const deliveryPriority = calculateDeliveryPriority(d);
        const deliveryZone = getDeliveryZone(d);
        const isUrgentDelivery = deliveryPriority === 'urgent' || deliveryPriority === 'high';
        
        // Estimation distance basée sur la zone
        const zoneDistances = { paris: 5, petite_couronne: 12, grande_couronne: 25, autre: 35 };
        const estimatedDistance = zoneDistances[deliveryZone] || 10;
        const estimatedTime = Math.round(estimatedDistance * 3); // ~3min par km
        
        return {
          ...d,
          id: d.id || d.numero_dossier,
          displayNumber: d.numero_dossier || d.numero || `D-${d.id}`,
          displayClient: d.nom_client || d.client_nom || 'Client inconnu',
          displayAdresse: d.adresse_livraison || d.adresse || 'Adresse non définie',
          displayTelephone: d.telephone_client || d.telephone || '',
          deliveryStatus,
          deliveryZone,
          deliveryPriority,
          isUrgentDelivery,
          amount: d.montant_total || d.montant || 0,
          distance: estimatedDistance,
          estimatedTime: estimatedTime,
          deliveryDate: d.date_livraison || d.created_at,
          comments: d.commentaires || d.notes || '',
          retryCount: d.tentatives_livraison || 0
        };
      });
      
      setDossiers(dossiersList);
      
      if (!showRefreshLoader && toast?.success) {
        toast.success('Dossiers chargés avec succès');
      }
    } catch (error) {
      if (notificationService?.error) {
        try { notificationService.error('Erreur chargement dossiers', { error }); } catch (e) {}
      }
      if (toast?.error) {
        toast.error('Erreur lors du chargement des dossiers');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizeDeliveryStatus, calculateDeliveryPriority, getDeliveryZone, toast]);

  // Catégorisation des dossiers
  const categorizedDossiers = useMemo(() => {
    return {
      aLivrer: dossiers.filter(d => ['imprime', 'pret_livraison'].includes(d.deliveryStatus)),
      programmees: dossiers.filter(d => d.deliveryStatus === 'en_livraison'),
      terminees: dossiers.filter(d => ['livre', 'retour', 'echec_livraison'].includes(d.deliveryStatus))
    };
  }, [dossiers]);

  // Handlers pour les actions
  const handleProgrammer = useCallback((dossier) => {
    if (toast?.info) {
      toast.info(`Programmation de ${dossier.displayNumber}`);
    }
    // TODO: Ouvrir modal de programmation
  }, [toast]);

  const handleShowDetails = useCallback((dossier) => {
    // TODO: Ouvrir modal de détails
  }, []);

  const handleNavigation = useCallback((dossier) => {
    const address = encodeURIComponent(dossier.displayAdresse);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    window.open(mapsUrl, '_blank');
    if (toast?.info) {
      toast.info(`🗺️ Navigation vers ${dossier.displayClient}`);
    }
  }, [toast]);

  const handleCallClient = useCallback((dossier) => {
    if (dossier.displayTelephone) {
      window.location.href = `tel:${dossier.displayTelephone}`;
      if (toast?.info) {
        toast.info(`📞 Appel vers ${dossier.displayClient}`);
      }
    } else {
      if (toast?.warning) {
        toast.warning('Numéro de téléphone non disponible');
      }
    }
  }, [toast]);

  const handleValider = useCallback((dossier) => {
    if (toast?.success) {
      toast.success(`Livraison ${dossier.displayNumber} validée`);
    }
    // TODO: API call pour valider
  }, [toast]);

  const handleEchec = useCallback((dossier) => {
    if (toast?.error) {
      toast.error(`Échec enregistré pour ${dossier.displayNumber}`);
    }
    // TODO: API call pour marquer échec
  }, [toast]);

  const handleReporter = useCallback((dossier) => {
    if (toast?.info) {
      toast.info(`Livraison ${dossier.displayNumber} reportée`);
    }
    // TODO: API call pour reporter
  }, [toast]);

  const handleReessayer = useCallback((dossier) => {
    if (toast?.info) {
      toast.info(`Nouvelle tentative pour ${dossier.displayNumber}`);
    }
    // TODO: API call pour réessayer
  }, [toast]);

  // Initialisation
  useEffect(() => {
    // Ne charger les dossiers que si l'utilisateur est connecté
    if (user && user.id) {
      fetchDossiers();
    }

    // Écoute des événements de notification
    const unsubscribeRefresh = notificationService.on('refresh_dossiers_list', () => {
      fetchDossiers(true);
    });
    const unsubscribeDossierUpdate = notificationService.on('dossier_updated', () => {
      fetchDossiers(true);
    });

    return () => {
      if (typeof unsubscribeRefresh === 'function') unsubscribeRefresh();
      if (typeof unsubscribeDossierUpdate === 'function') unsubscribeDossierUpdate();
    };
  }, [user?.id, fetchDossiers]);

  // Rendu du contenu selon la section
  const renderContent = () => {
    switch (currentSection) {
      case 'a_livrer':
        return (
          <ALivrerSectionV2
            dossiers={categorizedDossiers.aLivrer}
            loading={loading}
            refreshing={refreshing}
            onProgrammer={handleProgrammer}
            onVoirDetails={handleShowDetails}
            onNavigation={handleNavigation}
            onAppel={handleCallClient}
            viewMode={viewMode}
          />
        );
      
      case 'programmees':
        return (
          <ProgrammeesSectionV2
            dossiers={categorizedDossiers.programmees}
            loading={loading}
            refreshing={refreshing}
            onValider={handleValider}
            onEchec={handleEchec}
            onReporter={handleReporter}
            onVoirDetails={handleShowDetails}
            onNavigation={handleNavigation}
            onAppel={handleCallClient}
            viewMode={viewMode}
          />
        );
      
      case 'terminees':
        return (
          <TermineesSectionV2
            dossiers={categorizedDossiers.terminees}
            loading={loading}
            refreshing={refreshing}
            onVoirDetails={handleShowDetails}
            onReessayer={handleReessayer}
            viewMode={viewMode}
          />
        );
      
      default:
        return null;
    }
  };

  // Affichage du chargement initial
  if (loading && dossiers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <LoadingState type="spinner" message="Chargement des dossiers..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      {/* Header avec Navigation */}
      <div className="bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo et titre */}
            <div className="flex items-center gap-3">
              <TruckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Interface Livreur
              </h1>
            </div>

            {/* Mode d'affichage */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-neutral-600 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Vue en cartes"
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-neutral-600 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Vue en liste"
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex gap-1 -mb-px">
            {[
              { key: 'a_livrer', label: 'À Livrer', count: categorizedDossiers.aLivrer.length },
              { key: 'programmees', label: 'En Cours', count: categorizedDossiers.programmees.length },
              { key: 'terminees', label: 'Terminées', count: categorizedDossiers.terminees.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setCurrentSection(tab.key)}
                className={`
                  px-6 py-3 font-medium text-sm border-b-2 transition-colors
                  ${currentSection === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    currentSection === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LivreurDashboard;