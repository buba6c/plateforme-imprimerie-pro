/**
 * 🚚 Interface Livreur V2 - Nouvelle interface moderne complète
 * Interface dédiée aux livreurs avec tous les nouveaux composants
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TruckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// Import des nouveaux composants V2
import {
  ALivrerSectionV2,
  ProgrammeesSectionV2,
  TermineesSectionV2
} from './livreur-v2/sections';
import { LoadingState } from './livreur-v2/common';

// Services
import { dossiersService } from '../services/apiAdapter';
import notificationService from '../services/notificationService';

const LivreurInterfaceV2 = ({ user, initialSection = 'a_livrer' }) => {
  // États principaux
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Navigation et interface
  const [currentSection, setCurrentSection] = useState(initialSection === 'dashboard' ? 'a_livrer' : initialSection);

  // 📊 Normalisation des statuts
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
    // Zone simplifiée - à adapter selon le pays
    const ville = String(dossier.ville_livraison || dossier.ville || '').toLowerCase().trim();
    const quartier = String(dossier.quartier || '').toLowerCase().trim();
    
    // Logique simple basée sur la ville/quartier
    if (ville || quartier) {
      return ville || quartier;
    }
    return 'autre';
  }, []);

  // 🚚 Récupération des dossiers
  const fetchDossiers = useCallback(async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const data = await dossiersService.getDossiers({});
      let dossiersList = Array.isArray(data?.dossiers) ? data.dossiers : [];
      
      // Enrichissement des données
      dossiersList = dossiersList.map(d => {
        const deliveryStatus = normalizeDeliveryStatus(d.statut || d.status);
        const deliveryPriority = calculateDeliveryPriority(d);
        const deliveryZone = getDeliveryZone(d);
        const isUrgentDelivery = deliveryPriority === 'urgent' || deliveryPriority === 'high';
        
        const zoneDistances = { paris: 5, petite_couronne: 12, grande_couronne: 25, autre: 35 };
        const estimatedDistance = zoneDistances[deliveryZone] || 10;
        const estimatedTime = Math.round(estimatedDistance * 3);
        
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
    } catch (error) {
      notificationService.error && notificationService.error('Erreur chargement dossiers: ' + (error?.message || error));
      setDossiers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizeDeliveryStatus, calculateDeliveryPriority, getDeliveryZone]);

  // Catégorisation des dossiers
  const categorizedDossiers = useMemo(() => {
    return {
      aLivrer: dossiers.filter(d => ['imprime', 'pret_livraison'].includes(d.deliveryStatus)),
      programmees: dossiers.filter(d => d.deliveryStatus === 'en_livraison'),
      terminees: dossiers.filter(d => ['livre', 'retour', 'echec_livraison'].includes(d.deliveryStatus))
    };
  }, [dossiers]);

  // Handlers pour les actions (sans toast pour éviter les problèmes)
  const handleProgrammer = useCallback((dossier) => {
    notificationService.info(`Programmation de ${dossier.displayNumber}`);
  }, []);

  const handleShowDetails = useCallback((dossier) => {
    notificationService.info(`Détails de ${dossier.displayNumber}`);
  }, []);

  const handleNavigation = useCallback((dossier) => {
    const address = encodeURIComponent(dossier.displayAdresse);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    window.open(mapsUrl, '_blank');
  }, []);

  const handleCallClient = useCallback((dossier) => {
    if (dossier.displayTelephone) {
      window.location.href = `tel:${dossier.displayTelephone}`;
    } else {
      notificationService.warn('Numéro de téléphone non disponible');
    }
  }, []);

  const handleValider = useCallback((dossier) => {
    notificationService.success(`Livraison ${dossier.displayNumber} validée`);
  }, []);

  const handleEchec = useCallback((dossier) => {
    notificationService.error(`Échec enregistré pour ${dossier.displayNumber}`);
  }, []);

  const handleReporter = useCallback((dossier) => {
    notificationService.info(`Livraison ${dossier.displayNumber} reportée`);
  }, []);

  const handleReessayer = useCallback((dossier) => {
    notificationService.info(`Nouvelle tentative pour ${dossier.displayNumber}`);
  }, []);

  // Initialisation
  useEffect(() => {
    // Ne charger les dossiers que si l'utilisateur est connecté
    if (user && user.id) {
      fetchDossiers();
    }

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      {/* Header avec Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo et titre */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                <TruckIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Centre de Livraison
                </h1>
                <p className="text-xs text-gray-600 font-medium">
                  Bonjour, {user?.nom || 'Livreur'} 👋
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Refresh */}
              <button
                onClick={() => fetchDossiers(true)}
                disabled={refreshing}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 disabled:opacity-50"
                title="Actualiser"
              >
                <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex gap-1 mt-3 bg-gray-100 p-1 rounded-lg">
            {[
              { key: 'a_livrer', label: 'À Livrer', count: categorizedDossiers.aLivrer.length, color: 'blue' },
              { key: 'programmees', label: 'En Cours', count: categorizedDossiers.programmees.length, color: 'orange' },
              { key: 'terminees', label: 'Terminées', count: categorizedDossiers.terminees.length, color: 'green' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setCurrentSection(tab.key)}
                className={`
                  flex-1 px-4 py-2 font-semibold text-sm rounded-md transition-all duration-200 whitespace-nowrap
                  ${currentSection === tab.key
                    ? `bg-${tab.color}-600 text-white shadow-sm`
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className="flex items-center justify-center gap-2">
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-md text-xs font-bold
                      ${currentSection === tab.key
                        ? `bg-white/20 text-white`
                        : 'bg-gray-200 text-gray-700'
                      }
                    `}>
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LivreurInterfaceV2;