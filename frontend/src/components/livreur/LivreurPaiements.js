/**
 * 💰 LivreurPaiements - Gestion des paiements de livraison
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CalendarIcon,
  FunnelIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import paiementsService from '../../services/paiementsService';
import EncaissementModal from './EncaissementModal';
import notificationService from '../../services/notificationService';

const LivreurPaiements = ({ user }) => {
  const [activeTab, setActiveTab] = useState('a-encaisser'); // 'a-encaisser', 'historique', 'statistiques'
  const [dossiersAEncaisser, setDossiersAEncaisser] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [stats, setStats] = useState({
    total_encaisse: 0,
    en_attente: 0,
    approuve: 0,
    nombre_encaissements: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showEncaissementModal, setShowEncaissementModal] = useState(false);
  const [dossierToEncaisser, setDossierToEncaisser] = useState(null);
  
  // Filtres pour l'historique
  const [filters, setFilters] = useState({
    date_debut: '',
    date_fin: '',
    statut: '',
    mode_paiement: '',
  });

  // Chargement des données
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Dossiers à encaisser
      const dossiersResponse = await paiementsService.getDossiersAEncaisser();
      console.log('📋 Réponse API dossiers à encaisser:', dossiersResponse);
      if (dossiersResponse?.success) {
        console.log('✅ Dossiers reçus:', dossiersResponse.dossiers);
        setDossiersAEncaisser(dossiersResponse.dossiers || []);
      } else {
        console.log('❌ Erreur API:', dossiersResponse);
      }

      // Historique des encaissements
      const historiqueResponse = await paiementsService.getMesEncaissements(filters);
      if (historiqueResponse?.success) {
        setHistorique(historiqueResponse.encaissements || []);
        
        // Calculer les statistiques
        const encaissements = historiqueResponse.encaissements || [];
        const statsCalc = {
          total_encaisse: encaissements.reduce((sum, e) => sum + parseFloat(e.montant || 0), 0),
          en_attente: encaissements.filter(e => e.statut === 'encaisse_livreur').reduce((sum, e) => sum + parseFloat(e.montant || 0), 0),
          approuve: encaissements.filter(e => e.statut === 'approuve').reduce((sum, e) => sum + parseFloat(e.montant || 0), 0),
          nombre_encaissements: encaissements.length,
        };
        setStats(statsCalc);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      notificationService.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  // Handlers
  const handleEncaisser = (dossier) => {
    setDossierToEncaisser(dossier);
    setShowEncaissementModal(true);
  };

  const handleEncaissementSuccess = () => {
    setShowEncaissementModal(false);
    setDossierToEncaisser(null);
    loadData();
  };

  const handleEncaissementClose = () => {
    setShowEncaissementModal(false);
    setDossierToEncaisser(null);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      date_debut: '',
      date_fin: '',
      statut: '',
      mode_paiement: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <CreditCardIcon className="h-16 w-16 text-orange-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Chargement des paiements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <BanknotesIcon className="h-8 w-8 text-orange-600" />
                💰 Paiements et Encaissements
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Gérez les paiements à la livraison et consultez votre historique
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
            >
              <svg 
                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Actualisation...' : 'Actualiser'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('a-encaisser')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === 'a-encaisser'
                    ? 'border-b-2 border-orange-600 text-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CreditCardIcon className="h-5 w-5" />
                  <span>À encaisser</span>
                  {dossiersAEncaisser.length > 0 && (
                    <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">
                      {dossiersAEncaisser.length}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('historique')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === 'historique'
                    ? 'border-b-2 border-orange-600 text-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <DocumentTextIcon className="h-5 w-5" />
                  <span>Historique</span>
                  {historique.length > 0 && (
                    <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
                      {historique.length}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('statistiques')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === 'statistiques'
                    ? 'border-b-2 border-orange-600 text-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <ChartBarIcon className="h-5 w-5" />
                  <span>Statistiques</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Section 1: À encaisser */}
            {activeTab === 'a-encaisser' && (
              <div>
                {dossiersAEncaisser.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Aucun paiement à encaisser
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Tous les paiements à la livraison ont été collectés
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {dossiersAEncaisser.length} dossier{dossiersAEncaisser.length > 1 ? 's' : ''} en attente d'encaissement
                    </p>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {dossiersAEncaisser.map((dossier) => (
                        <div
                          key={dossier.id}
                          className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-white">
                                {dossier.numero || `Dossier #${dossier.id}`}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Client: {dossier.client || 'N/A'}
                              </p>
                            </div>
                            <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                              {paiementsService.formatMontant(dossier.montant_cfa || 0)}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm mb-4">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <span className="font-medium">Statut:</span>
                              <span className="capitalize">{dossier.statut_dossier || dossier.statut || 'N/A'}</span>
                            </div>
                            {dossier.adresse_livraison && (
                              <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                                <span className="font-medium">Adresse:</span>
                                <span className="flex-1">{dossier.adresse_livraison}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleEncaisser(dossier)}
                            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                          >
                            <CreditCardIcon className="h-5 w-5" />
                            Encaisser maintenant
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Historique */}
            {activeTab === 'historique' && (
              <div>
                {/* Filtres */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Filtres</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date début
                      </label>
                      <input
                        type="date"
                        value={filters.date_debut}
                        onChange={(e) => handleFilterChange('date_debut', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date fin
                      </label>
                      <input
                        type="date"
                        value={filters.date_fin}
                        onChange={(e) => handleFilterChange('date_fin', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Statut
                      </label>
                      <select
                        value={filters.statut}
                        onChange={(e) => handleFilterChange('statut', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Tous</option>
                        <option value="encaisse_livreur">En attente</option>
                        <option value="approuve">Approuvé</option>
                        <option value="rejete">Rejeté</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mode paiement
                      </label>
                      <select
                        value={filters.mode_paiement}
                        onChange={(e) => handleFilterChange('mode_paiement', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Tous</option>
                        <option value="especes">Espèces</option>
                        <option value="cb">Carte Bancaire</option>
                        <option value="wave">Wave</option>
                        <option value="orange_money">Orange Money</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                </div>

                {/* Liste des encaissements */}
                {historique.length === 0 ? (
                  <div className="text-center py-12">
                    <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Aucun encaissement
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Votre historique d'encaissements apparaîtra ici
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historique.map((encaissement) => {
                      const statut = encaissement.statut || 'encaisse_livreur';
                      const statutConfig = {
                        encaisse_livreur: {
                          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
                          text: 'text-yellow-700 dark:text-yellow-400',
                          border: 'border-yellow-300 dark:border-yellow-700',
                          icon: ClockIcon,
                          label: 'En attente validation'
                        },
                        approuve: {
                          bg: 'bg-green-100 dark:bg-green-900/30',
                          text: 'text-green-700 dark:text-green-400',
                          border: 'border-green-300 dark:border-green-700',
                          icon: CheckCircleIcon,
                          label: 'Approuvé'
                        },
                        rejete: {
                          bg: 'bg-red-100 dark:bg-red-900/30',
                          text: 'text-red-700 dark:text-red-400',
                          border: 'border-red-300 dark:border-red-700',
                          icon: XCircleIcon,
                          label: 'Rejeté'
                        }
                      };
                      
                      const config = statutConfig[statut] || statutConfig.encaisse_livreur;
                      const StatusIcon = config.icon;

                      return (
                        <div
                          key={encaissement.id}
                          className={`${config.bg} border ${config.border} rounded-lg p-4`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-bold text-gray-900 dark:text-white">
                                  {encaissement.dossier_numero || `Dossier #${encaissement.dossier_id}`}
                                </h3>
                                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${config.text}`}>
                                  <StatusIcon className="h-4 w-4" />
                                  {config.label}
                                </span>
                              </div>

                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Client: {encaissement.nom_client || 'N/A'}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Montant:</span>
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {paiementsService.formatMontant(encaissement.montant)}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Mode:</span>
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {paiementsService.getModeLabel(encaissement.mode_paiement_final)}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {new Date(encaissement.date_encaissement || encaissement.date_paiement).toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                                {encaissement.reference_transaction && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Référence:</span>
                                    <p className="font-mono text-xs text-gray-900 dark:text-white">
                                      {encaissement.reference_transaction}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Statistiques */}
            {activeTab === 'statistiques' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {/* Total encaissé */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <BanknotesIcon className="h-8 w-8 opacity-80" />
                      <span className="text-sm font-medium opacity-90">Total encaissé</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {paiementsService.formatMontant(stats.total_encaisse)}
                    </p>
                    <p className="text-xs opacity-75 mt-1">{stats.nombre_encaissements} encaissement{stats.nombre_encaissements > 1 ? 's' : ''}</p>
                  </div>

                  {/* En attente validation */}
                  <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <ClockIcon className="h-8 w-8 opacity-80" />
                      <span className="text-sm font-medium opacity-90">En attente</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {paiementsService.formatMontant(stats.en_attente)}
                    </p>
                    <p className="text-xs opacity-75 mt-1">
                      {historique.filter(e => e.statut === 'encaisse_livreur').length} paiement{historique.filter(e => e.statut === 'encaisse_livreur').length > 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Approuvé */}
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <CheckCircleIcon className="h-8 w-8 opacity-80" />
                      <span className="text-sm font-medium opacity-90">Approuvé</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {paiementsService.formatMontant(stats.approuve)}
                    </p>
                    <p className="text-xs opacity-75 mt-1">
                      {historique.filter(e => e.statut === 'approuve').length} paiement{historique.filter(e => e.statut === 'approuve').length > 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* À encaisser */}
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <CreditCardIcon className="h-8 w-8 opacity-80" />
                      <span className="text-sm font-medium opacity-90">À encaisser</span>
                    </div>
                    <p className="text-3xl font-bold">
                      {dossiersAEncaisser.length}
                    </p>
                    <p className="text-xs opacity-75 mt-1">
                      {paiementsService.formatMontant(
                        dossiersAEncaisser.reduce((sum, d) => sum + parseFloat(d.montant_cfa || 0), 0)
                      )}
                    </p>
                  </div>
                </div>

                {/* Graphique ou informations supplémentaires */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ChartBarIcon className="h-6 w-6" />
                    Répartition par mode de paiement
                  </h3>
                  <div className="space-y-3">
                    {['especes', 'cb', 'wave', 'orange_money'].map((mode) => {
                      const count = historique.filter(e => e.mode_paiement_final === mode).length;
                      const total = historique.filter(e => e.mode_paiement_final === mode)
                        .reduce((sum, e) => sum + parseFloat(e.montant || 0), 0);
                      const percentage = historique.length > 0 ? (count / historique.length * 100).toFixed(1) : 0;

                      return count > 0 ? (
                        <div key={mode} className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {paiementsService.getModeLabel(mode)}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[100px] text-right">
                            {paiementsService.formatMontant(total)}
                          </span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Encaissement */}
      {showEncaissementModal && dossierToEncaisser && (
        <EncaissementModal
          isOpen={showEncaissementModal}
          dossier={dossierToEncaisser}
          onClose={handleEncaissementClose}
          onSuccess={handleEncaissementSuccess}
        />
      )}
    </div>
  );
};

export default LivreurPaiements;
