/**
 * 🚚 Dashboard Livreur V2 - Version COMPLÈTE avec TOUS les composants
 * Orchestration complète avec Header, KPI, Navigation, Filters, Sections, Modales
 */

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLivreurData, useLivreurActions } from '../hooks';
import { LoadingState } from '../common';
import LivreurHeader from './LivreurHeader';
import LivreurKPICards from './LivreurKPICards';
import { LivreurNavigation, LivreurFilters } from '../navigation';
import { ALivrerSectionV2, ProgrammeesSectionV2, TermineesSectionV2 } from '../sections';
import { 
  ProgrammerModalV2, 
  ValiderLivraisonModalV2, 
  DossierDetailsModalV2, 
  EchecLivraisonModalV2 
} from '../modals';

const LivreurDashboardV2 = ({ user = {}, initialSection = 'a_livrer' }) => {
  // Hooks de données et actions
  const {
    dossiersALivrer,
    dossiersProgrammees,
    dossiersTerminees,
    loading,
    refreshing,
    stats,
    filters,
    setFilters,
    refresh
  } = useLivreurData();

  const { 
    programmerLivraison, 
    validerLivraison, 
    declarerEchec,
    processing 
  } = useLivreurActions({ onSuccess: refresh });

  // États locaux
  const [activeSection, setActiveSection] = useState(initialSection);
  const [viewMode, setViewMode] = useState('cards');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // États des modales
  const [modalState, setModalState] = useState({
    programmer: { isOpen: false, dossier: null },
    valider: { isOpen: false, dossier: null },
    details: { isOpen: false, dossier: null },
    echec: { isOpen: false, dossier: null }
  });

  // Calcul du nombre de dossiers urgents
  const urgentCount = dossiersALivrer.filter(d => d.isUrgentDelivery).length;

  // Handlers modales
  const openModal = (type, dossier) => {
    setModalState(prev => ({
      ...prev,
      [type]: { isOpen: true, dossier }
    }));
  };

  const closeModal = (type) => {
    setModalState(prev => ({
      ...prev,
      [type]: { isOpen: false, dossier: null }
    }));
  };

  // Handler refresh
  const handleRefresh = () => {
    refresh();
    setLastUpdate(new Date());
  };

  // Regroupement des dossiers pour navigation
  const groupedDossiers = {
    aLivrer: dossiersALivrer,
    programmees: dossiersProgrammees,
    livrees: dossiersTerminees
  };

  // Affichage du chargement initial
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingState message="Chargement du dashboard..." size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header principal */}
      <LivreurHeader
        user={user}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        lastUpdate={lastUpdate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onToggleFilters={() => setShowFilters(!showFilters)}
        showFilters={showFilters}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Cartes KPI */}
        <LivreurKPICards 
          stats={stats} 
          urgentCount={urgentCount}
          loading={refreshing}
        />

        {/* Filtres avancés (conditionnels) */}
        <AnimatePresence>
          {showFilters && (
            <LivreurFilters
              filters={filters}
              onFiltersChange={setFilters}
              resultCount={groupedDossiers[activeSection]?.length || 0}
              totalCount={stats.total}
              onClose={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>

        {/* Navigation par onglets */}
        <LivreurNavigation
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          stats={stats}
          groupedDossiers={groupedDossiers}
        />

        {/* Sections de contenu */}
        <div className="min-h-[400px]">
          {activeSection === 'a_livrer' && (
            <ALivrerSectionV2
              dossiers={dossiersALivrer}
              loading={loading}
              refreshing={refreshing}
              onProgrammer={(dossier) => openModal('programmer', dossier)}
              onVoirDetails={(dossier) => openModal('details', dossier)}
              onNavigation={(dossier) => {
                // TODO: Intégrer navigation Google Maps
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dossier.displayAdresse)}`, '_blank');
              }}
              onAppel={(dossier) => {
                // TODO: Intégrer appel téléphonique
                if (dossier.displayTelephone) window.location.href = `tel:${dossier.displayTelephone}`;
              }}
              viewMode={viewMode}
            />
          )}

          {activeSection === 'programmees' && (
            <ProgrammeesSectionV2
              dossiers={dossiersProgrammees}
              loading={loading}
              refreshing={refreshing}
              onValider={(dossier) => openModal('valider', dossier)}
              onEchec={(dossier) => openModal('echec', dossier)}
              onReporter={(dossier) => openModal('programmer', dossier)}
              onVoirDetails={(dossier) => openModal('details', dossier)}
              onNavigation={(dossier) => {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dossier.displayAdresse)}`, '_blank');
              }}
              onAppel={(dossier) => {
                if (dossier.displayTelephone) window.location.href = `tel:${dossier.displayTelephone}`;
              }}
              viewMode={viewMode}
            />
          )}

          {activeSection === 'terminees' && (
            <TermineesSectionV2
              dossiers={dossiersTerminees}
              loading={loading}
              refreshing={refreshing}
              onVoirDetails={(dossier) => openModal('details', dossier)}
              onReessayer={(dossier) => openModal('programmer', dossier)}
              viewMode={viewMode}
            />
          )}
        </div>
      </div>

      {/* Modales */}
      <ProgrammerModalV2
        dossier={modalState.programmer.dossier}
        isOpen={modalState.programmer.isOpen}
        onClose={() => closeModal('programmer')}
        onProgrammer={async (dossier, data) => {
          await programmerLivraison(dossier, data);
          closeModal('programmer');
        }}
        loading={processing}
      />

      <ValiderLivraisonModalV2
        dossier={modalState.valider.dossier}
        isOpen={modalState.valider.isOpen}
        onClose={() => closeModal('valider')}
        onValider={async (dossier, data) => {
          await validerLivraison(dossier, data);
          closeModal('valider');
        }}
        loading={processing}
      />

      <DossierDetailsModalV2
        dossier={modalState.details.dossier}
        isOpen={modalState.details.isOpen}
        onClose={() => closeModal('details')}
      />

      <EchecLivraisonModalV2
        dossier={modalState.echec.dossier}
        isOpen={modalState.echec.isOpen}
        onClose={() => closeModal('echec')}
        onMarquerEchec={async (dossier, data) => {
          await declarerEchec(dossier, data);
          closeModal('echec');
        }}
        loading={processing}
      />
    </div>
  );
};

export default LivreurDashboardV2;
