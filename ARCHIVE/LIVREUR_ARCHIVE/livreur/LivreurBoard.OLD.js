import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TruckIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../../services/apiAdapter';
import notificationService from '../../services/notificationService';
import LivreurKPIHeader from './LivreurKPIHeader';
import LivreurNavTabs from './LivreurNavTabs';
import ALivrerSection from './ALivrerSection';
import ProgrammeesSection from './ProgrammeesSection';
import TermineesSection from './TermineesSection';
import ProgrammerModal from './ProgrammerModal';
import ValiderLivraisonModal from './ValiderLivraisonModal';
import DossierDetails from '../dossiers/DossierDetailsFixed';

const LivreurBoard = ({ user, initialSection = 'a_livrer' }) => {
  const [activeTab, setActiveTab] = useState(initialSection === 'dashboard' ? 'a_livrer' : initialSection); // a_livrer | programmees | terminees
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modales
  const [showProgrammerModal, setShowProgrammerModal] = useState(false);
  const [showValiderModal, setShowValiderModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState(null);

  // Stats globales
  const [stats, setStats] = useState({
    aLivrer: 0,
    programmees: 0,
    livrees: 0,
    encaisseMonth: 0,
  });

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase().trim();
    if (val === 'terminé' || val === 'termine' || val === 'fini') return 'termine';
    if (val === 'imprimé' || val === 'imprime') return 'imprime';
    if (val === 'prêt livraison' || val === 'pret_livraison' || val === 'pret livraison') return 'pret_livraison';
    if (val === 'en livraison' || val === 'en_livraison') return 'en_livraison';
    if (val === 'livré' || val === 'livre') return 'livre';
    return val;
  };

  // Chargement des dossiers
  const loadDossiers = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);
      const response = await dossiersService.getDossiers();
      const list = Array.isArray(response?.dossiers)
        ? response.dossiers
        : Array.isArray(response?.data)
          ? response.data
          : [];

      // Filtrer les dossiers pertinents pour le livreur
      const livreurDossiers = list
        .filter(d => {
          const status = normalizeStatus(d.statut);
          return ['imprime', 'pret_livraison', 'en_livraison', 'livre'].includes(status);
        })
        .map(d => ({
          ...d,
          normalized_status: normalizeStatus(d.statut),
          montant_prevu: d.montant_prevu || d.montant_a_encaisser || null,
          mode_paiement_prevu: d.mode_paiement_prevu || null,
          date_livraison_prevue: d.date_livraison_prevue || d.date_prevue || null,
          montant_encaisse: d.montant_encaisse || d.montant_cfa || null,
          mode_paiement: d.mode_paiement || d.payment_mode || null,
        }));

      setDossiers(livreurDossiers);
      calculateStats(livreurDossiers);
    } catch (error) {
      try { notificationService.error('Erreur lors du chargement des dossiers', error); } catch (e) {}
      setDossiers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Calcul des statistiques
  const calculateStats = (list) => {
    const aLivrer = list.filter(d => ['imprime', 'pret_livraison'].includes(d.normalized_status)).length;
    const programmees = list.filter(d => d.normalized_status === 'en_livraison').length;
    const livrees = list.filter(d => d.normalized_status === 'livre').length;

    // Total encaissé ce mois
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const encaisseMonth = list
      .filter(d => d.normalized_status === 'livre')
      .filter(d => new Date(d.updated_at || d.date_livraison || d.created_at) >= monthStart)
      .reduce((sum, d) => sum + (parseFloat(d.montant_encaisse) || 0), 0);

    setStats({ aLivrer, programmees, livrees, encaisseMonth });
  };

  useEffect(() => {
    loadDossiers(true);

    // Écoute temps réel
    const offUpdated = notificationService.on('dossier_updated', () => loadDossiers());
    const offNew = notificationService.on('new_dossier', () => loadDossiers());

    return () => {
      if (typeof offUpdated === 'function') offUpdated();
      if (typeof offNew === 'function') offNew();
    };
  }, [loadDossiers]);

  // Actions
  const handleProgrammer = (dossier) => {
    setSelectedDossier(dossier);
    setShowProgrammerModal(true);
  };

  const handleModifier = (dossier) => {
    setSelectedDossier(dossier);
    setShowProgrammerModal(true);
  };

  const handleValider = (dossier) => {
    setSelectedDossier(dossier);
    setShowValiderModal(true);
  };

  const handleVoirDetails = (dossier) => {
    setSelectedDossier(dossier);
    setShowDetailsModal(true);
  };

  const handleRefresh = () => {
    loadDossiers(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-cyan-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <TruckIcon className="h-8 w-8 text-white" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-300 font-medium">Chargement du centre de livraison...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-cyan-50">
      {/* Header moderne */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-600 via-green-600 to-cyan-600 text-white shadow-2xl"
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <div className="p-3 bg-white dark:bg-neutral-800/20 rounded-2xl backdrop-blur-sm">
                  <TruckIcon className="h-8 w-8" />
                </div>
                Centre de Livraison
              </h1>
              <p className="text-emerald-100 mt-2 text-lg">
                Bienvenue, {user?.nom || 'Livreur'}! Gérez vos livraisons efficacement
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-3 bg-white dark:bg-neutral-800/20 hover:bg-white dark:bg-neutral-800/30 rounded-xl backdrop-blur-sm transition-all duration-300 disabled:opacity-50"
                title="Actualiser"
              >
                <ArrowPathIcon className={`h-6 w-6 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* KPI Header */}
          <LivreurKPIHeader stats={stats} />

          {/* Navigation Tabs */}
          <LivreurNavTabs activeTab={activeTab} setActiveTab={setActiveTab} stats={stats} />
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'a_livrer' && (
          <ALivrerSection
            dossiers={dossiers.filter(d => ['imprime', 'pret_livraison'].includes(d.normalized_status))}
            onProgrammer={handleProgrammer}
            onVoirDetails={handleVoirDetails}
            refreshing={refreshing}
          />
        )}

        {activeTab === 'programmees' && (
          <ProgrammeesSection
            dossiers={dossiers.filter(d => d.normalized_status === 'en_livraison')}
            onModifier={handleModifier}
            onValider={handleValider}
            onVoirDetails={handleVoirDetails}
            refreshing={refreshing}
          />
        )}

        {activeTab === 'terminees' && (
          <TermineesSection
            dossiers={dossiers.filter(d => d.normalized_status === 'livre')}
            onVoirDetails={handleVoirDetails}
          />
        )}
      </div>

      {/* Modales */}
      {showProgrammerModal && selectedDossier && (
        <ProgrammerModal
          dossier={selectedDossier}
          user={user}
          onClose={() => {
            setShowProgrammerModal(false);
            setSelectedDossier(null);
          }}
          onSuccess={() => {
            setShowProgrammerModal(false);
            setSelectedDossier(null);
            loadDossiers();
          }}
        />
      )}

      {showValiderModal && selectedDossier && (
        <ValiderLivraisonModal
          dossier={selectedDossier}
          user={user}
          onClose={() => {
            setShowValiderModal(false);
            setSelectedDossier(null);
          }}
          onSuccess={() => {
            setShowValiderModal(false);
            setSelectedDossier(null);
            loadDossiers();
          }}
        />
      )}

      {showDetailsModal && selectedDossier && (
        <DossierDetails
          dossierId={selectedDossier.id || selectedDossier.folder_id}
          dossier={selectedDossier}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedDossier(null);
          }}
          onStatusChange={() => loadDossiers()}
        />
      )}
    </div>
  );
};

export default LivreurBoard;
