import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TruckIcon,
  CheckCircleIcon,
  MapPinIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  DocumentIcon,
  ClockIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetails';
import NotificationToast from './common/NotificationToast';
import useNotifications from '../hooks/useNotifications';

const LivreurDossiers = ({ user }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, client_asc, montant_desc
  const [refreshing, setRefreshing] = useState(false);
  const [showProgrammerModal, setShowProgrammerModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [dossierEnCours, setDossierEnCours] = useState(null);
  const [paiementData, setPaiementData] = useState({
    date_livraison: new Date().toISOString().split('T')[0],
    mode_paiement: '',
    montant_cfa: ''
  });

  // Hook pour les notifications améliorées
  const { notifications, removeNotification, success, error, warning } = useNotifications();

// Normalisation des statuts de livraison
  const normalizeDeliveryStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase();
    // IMPORTANT: Vérifier 'termine' en priorité et le mapper vers 'imprime' pour afficher les boutons d'action
    if (val === 'termine' || val === 'terminated' || val === 'finished') return 'imprime';
    if (val.includes('imprim')) return 'imprime';
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('livraison') && !val.includes('pret')) return 'en_livraison';
    if (val.includes('livre') || val.includes('delivered')) return 'livre';
    if (val.includes('retour') || val.includes('return')) return 'retour';
    if (val.includes('echec') || val.includes('failed')) return 'echec_livraison';
    if (val.includes('reporte') || val.includes('postponed')) return 'reporte';
    return val.replace(/\s/g, '_');
  };

  // Calcul des zones de livraison
  const getDeliveryZone = (dossier) => {
    const codePostal = dossier.code_postal_livraison || dossier.code_postal || '';
    
    // Simplification par code postal (à adapter selon votre géographie)
    if (codePostal.startsWith('75')) return 'paris';
    if (codePostal.startsWith('92') || codePostal.startsWith('93') || codePostal.startsWith('94')) return 'banlieue';
    if (codePostal.startsWith('77') || codePostal.startsWith('78') || codePostal.startsWith('91') || codePostal.startsWith('95')) return 'idf';
    return 'autre';
  };

  // Récupération des dossiers de livraison
const fetchDossiers = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await dossiersService.getDossiers();
      let list = [];
      if (Array.isArray(response?.dossiers)) {
        list = response.dossiers;
      } else if (Array.isArray(response?.data)) {
        list = response.data;
      }
      if (Array.isArray(list)) {
        // Enrichissement des données pour livraison
        const enrichedDossiers = list.map(dossier => ({
          ...dossier,
          deliveryStatus: normalizeDeliveryStatus(dossier.statut),
          deliveryZone: getDeliveryZone(dossier),
          displayNumber: dossier.numero_commande || dossier.numero || `#${dossier.id?.toString()?.slice(-8)}`,
          displayClient: dossier.client || 'Client non spécifié',
          displayAdresse: `${dossier.adresse_livraison || 'Adresse non spécifiée'}`,
          isUrgentDelivery: dossier.priorite === 'urgent' || dossier.urgent === true || 
                           (dossier.date_livraison_prevue && new Date(dossier.date_livraison_prevue) < new Date())
        }));

        setDossiers(enrichedDossiers);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Erreur lors du chargement des dossiers:', err);
      error('Erreur lors du chargement des dossiers', {
        title: 'Erreur de chargement',
        duration: 8000
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [error]);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

// Filtrage et tri des dossiers
  const filteredDossiers = dossiers.filter(dossier => {
    const matchesSearch = searchTerm === '' || 
      dossier.displayNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dossier.displayClient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dossier.displayAdresse.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesZone = filterZone === 'all' || dossier.deliveryZone === filterZone;
    const matchesStatus = filterStatus === 'all' || normalizeDeliveryStatus(dossier.statut) === filterStatus || (filterStatus === 'a_livrer' && ['imprime','pret_livraison'].includes(normalizeDeliveryStatus(dossier.statut)));
    
    // Filtre par date
    let matchesDate = true;
    if (filterDateFrom) {
      const dateFrom = new Date(filterDateFrom);
      const dossierDate = new Date(dossier.date_creation || dossier.date_livraison_prevue || dossier.created_at);
      matchesDate = matchesDate && dossierDate >= dateFrom;
    }
    if (filterDateTo) {
      const dateTo = new Date(filterDateTo);
      const dossierDate = new Date(dossier.date_creation || dossier.date_livraison_prevue || dossier.created_at);
      matchesDate = matchesDate && dossierDate <= dateTo;
    }
    
    return matchesSearch && matchesZone && matchesStatus && matchesDate;
  }).sort((a, b) => {
    // Tri des résultats
    switch (sortBy) {
      case 'date_asc':
        return new Date(a.date_creation || a.created_at || 0) - new Date(b.date_creation || b.created_at || 0);
      case 'date_desc':
        return new Date(b.date_creation || b.created_at || 0) - new Date(a.date_creation || a.created_at || 0);
      case 'client_asc':
        return a.displayClient.localeCompare(b.displayClient);
      case 'montant_desc':
        return (b.montant_total || 0) - (a.montant_total || 0);
      default:
        return 0;
    }
  });

// Organisation des dossiers par statut
  const dossiersByStatus = {
    imprime: filteredDossiers.filter(d => d.deliveryStatus === 'imprime'),
    pret_livraison: filteredDossiers.filter(d => d.deliveryStatus === 'pret_livraison'),
    en_livraison: filteredDossiers.filter(d => d.deliveryStatus === 'en_livraison'),
    livre: filteredDossiers.filter(d => d.deliveryStatus === 'livre'),
    retour: filteredDossiers.filter(d => ['retour', 'echec_livraison', 'reporte'].includes(d.deliveryStatus)),
  };

  // Composants Badge optimisés
  const DeliveryStatusBadge = React.memo(({ status, size = 'sm' }) => {
    const configs = {
      'imprime': { label: 'Imprimé', bgClass: 'bg-purple-100 dark:bg-purple-900/20', textClass: 'text-purple-700 dark:text-purple-300' },
      'pret_livraison': { label: 'Prêt', bgClass: 'bg-blue-100 dark:bg-blue-900/20', textClass: 'text-blue-700 dark:text-blue-300' },
      'en_livraison': { label: 'En cours', bgClass: 'bg-orange-100 dark:bg-orange-900/20', textClass: 'text-orange-700 dark:text-orange-300' },
      'livre': { label: 'Livré', bgClass: 'bg-success-100 dark:bg-green-900/20', textClass: 'text-success-700 dark:text-green-300' },
      'retour': { label: 'Retour', bgClass: 'bg-neutral-100 dark:bg-gray-800', textClass: 'text-neutral-700 dark:text-gray-300' },
      'echec_livraison': { label: 'Échec', bgClass: 'bg-error-100 dark:bg-red-900/20', textClass: 'text-error-700 dark:text-red-300' },
      'reporte': { label: 'Reporté', bgClass: 'bg-yellow-100 dark:bg-yellow-900/20', textClass: 'text-yellow-700 dark:text-yellow-300' },
    };

    const config = configs[status] || configs['pret_livraison'];
    const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-xs';

    return (
      <span className={`inline-flex items-center font-medium rounded-full ${config.bgClass} ${config.textClass} ${sizeClass}`}>
        {config.label}
      </span>
    );
  });

  DeliveryStatusBadge.displayName = 'DeliveryStatusBadge';

  const ZoneBadge = React.memo(({ zone }) => {
    const configs = {
      'paris': { label: 'Paris', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
      'banlieue': { label: 'Banlieue', bgClass: 'bg-indigo-100', textClass: 'text-indigo-700' },
      'idf': { label: 'IDF', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
      'autre': { label: 'Autre', bgClass: 'bg-neutral-100 dark:bg-neutral-800', textClass: 'text-neutral-700 dark:text-neutral-200' },
    };

    const config = configs[zone] || configs['autre'];

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.bgClass} ${config.textClass}`}>
        {config.label}
      </span>
    );
  });

  ZoneBadge.displayName = 'ZoneBadge';

  // Carte de dossier enrichie avec plus d'informations (optimisée avec React.memo)
  const DossierCard = React.memo(({ dossier, index }) => {
    return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md dark:shadow-secondary-900/20 transition-shadow ${
        dossier.isUrgentDelivery ? 'border-l-4 border-l-red-500 dark:border-l-red-700' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
              {dossier.displayNumber}
            </span>
            {dossier.isUrgentDelivery && (
              <ExclamationTriangleIcon className="h-4 w-4 text-error-500" title="Livraison urgente" />
            )}
            <DeliveryStatusBadge status={dossier.deliveryStatus} size="sm" />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-neutral-900 dark:text-white">
              <UserIcon className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
              <span className="truncate font-medium">{dossier.displayClient}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-gray-300">
              <MapPinIcon className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
              <span className="truncate">{dossier.displayAdresse}</span>
            </div>
            
            {/* Nouvelles informations enrichies */}
            <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-gray-400 mt-2">
              {dossier.montant_total && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">💰</span>
                  <span>{Number(dossier.montant_total).toLocaleString()} CFA</span>
                </div>
              )}
              {dossier.date_livraison_prevue && (
                <div className="flex items-center gap-1">
                  <CalendarDaysIcon className="h-3 w-3" />
                  <span>{new Date(dossier.date_livraison_prevue).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {dossier.mode_paiement && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">💳</span>
                  <span>{dossier.mode_paiement}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <ZoneBadge zone={dossier.deliveryZone} />
            {dossier.commentaire && (
              <span className="text-xs text-neutral-500 dark:text-gray-400 bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded-full max-w-32 truncate" title={dossier.commentaire}>
                📝 {dossier.commentaire}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2 ml-4">
          <button
            onClick={() => {
              setSelectedDossier(dossier);
              setShowDetailsModal(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-gray-200 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            aria-label={`Voir les détails du dossier ${dossier.displayNumber}`}
          >
            <EyeIcon className="h-3 w-3" />
            Voir
          </button>
          
          {(dossier.deliveryStatus === 'pret_livraison' || dossier.deliveryStatus === 'imprime') && (
            <button
              onClick={() => {
                setDossierEnCours(dossier);
                setPaiementData(prev => ({ ...prev, date_livraison: new Date().toISOString().split('T')[0] }));
                setShowProgrammerModal(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-success-600 rounded-lg hover:bg-success-700 transition-colors"
              aria-label={`Démarrer la livraison du dossier ${dossier.displayNumber}`}
            >
              <PlayIcon className="h-3 w-3" />
              Démarrer
            </button>
          )}
          
          {dossier.deliveryStatus === 'en_livraison' && (
            <button
              onClick={() => handleValiderLivraison(dossier)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              aria-label={`Valider la livraison du dossier ${dossier.displayNumber}`}
            >
              <CheckCircleIcon className="h-3 w-3" />
              Valider
            </button>
          )}
        </div>
      </div>
    </motion.div>
    );
  });
  
  DossierCard.displayName = 'DossierCard';

  // Section de statut
  const StatusSection = ({ title, status, dossiers, icon: Icon, color }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700"
    >
<div className={`p-4 border-b border-neutral-200 dark:border-neutral-700 bg-${color}-50 dark:bg-neutral-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${color}-100`}>
              <Icon className={`h-5 w-5 text-${color}-600`} />
            </div>
            <div>
<h3 className={`text-lg font-semibold text-${color}-900 dark:text-white`}>{title}</h3>
<p className="text-sm text-neutral-600 dark:text-gray-300">{dossiers.length} dossier(s)</p>
            </div>
          </div>
          <DeliveryStatusBadge status={status} size="lg" />
        </div>
      </div>
      
      <div className="p-4">
        {dossiers.length === 0 ? (
<div className="text-center py-8 text-neutral-500 dark:text-gray-400">
<DocumentIcon className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-neutral-600 dark:text-neutral-300" />
            <p>Aucun dossier dans cette catégorie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dossiers.map((dossier, index) => (
              <DossierCard key={dossier.id} dossier={dossier} index={index} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-300">Chargement des dossiers...</p>
        </div>
      </div>
    );
  }


  // Actions: programmer et valider livraison

  const handleConfirmProgrammation = async (dateLivraison) => {
    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossierEnCours.id, 'en_livraison', {
        commentaire: `Livraison programmée pour le ${dateLivraison} par ${user?.nom || 'Livreur'}`,
        date_livraison_prevue: dateLivraison,
      });
      success(`Livraison programmée pour le ${dateLivraison}`, {
        title: '📅 Programmation réussie',
        duration: 4000
      });
      setShowProgrammerModal(false);
      setDossierEnCours(null);
      fetchDossiers();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Erreur lors de la programmation de la livraison:', err);
      error('Erreur lors de la programmation de la livraison', {
        title: 'Erreur de programmation',
        duration: 8000
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleValiderLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setPaiementData({
      date_livraison: new Date().toISOString().split('T')[0],
      mode_paiement: '',
      montant_cfa: ''
    });
    setShowPaiementModal(true);
  };

  const handleConfirmLivraison = async () => {
    if (!paiementData.mode_paiement || !paiementData.montant_cfa) {
      warning('Veuillez renseigner le mode de paiement et le montant', {
        title: '⚠️ Informations manquantes',
        duration: 6000
      });
      return;
    }
    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossierEnCours.id, 'livre', {
        commentaire: `Livraison terminée par ${user?.nom || 'Livreur'}`,
        date_livraison: paiementData.date_livraison,
        mode_paiement: paiementData.mode_paiement,
        montant_cfa: parseFloat(paiementData.montant_cfa),
      });
      success(`Livraison validée - ${paiementData.montant_cfa} CFA par ${paiementData.mode_paiement}`, {
        title: '✅ Livraison terminée',
        duration: 5000
      });
      setShowPaiementModal(false);
      setDossierEnCours(null);
      fetchDossiers();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Erreur lors de la validation de la livraison:', err);
      error('Erreur lors de la validation de la livraison', {
        title: 'Erreur de validation',
        duration: 8000
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {/* Système de notifications amélioré */}
      <NotificationToast 
        notifications={notifications} 
        onRemove={removeNotification} 
      />
      
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête */}
        {/*
          --- DASHBOARD SUMMARY CARD REMOVED ---
          If you want to use the dashboard summary card, move its code to your dashboard component (e.g., LivreurDashboard.js)
        */}

        {/* Filtres et recherche enrichis */}
        <div className="mb-8 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-6">
          <div className="flex flex-col gap-4">
            {/* Première ligne : Recherche */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par numéro, client ou adresse..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    aria-label="Rechercher des dossiers"
                  />
                </div>
              </div>
              
              <button
                onClick={fetchDossiers}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                aria-label="Actualiser la liste des dossiers"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>

            {/* Deuxième ligne : Filtres avancés */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  value={filterZone}
                  onChange={(e) => setFilterZone(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  aria-label="Filtrer par zone"
                >
                  <option value="all">Toutes les zones</option>
                  <option value="paris">Paris</option>
                  <option value="banlieue">Banlieue</option>
                  <option value="idf">IDF</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label htmlFor="date-debut-filter" className="block text-xs text-neutral-600 dark:text-gray-300 mb-1">Du</label>
                <input
                  id="date-debut-filter"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  aria-label="Date de début"
                />
              </div>

              <div>
                <label htmlFor="date-fin-filter" className="block text-xs text-neutral-600 dark:text-gray-300 mb-1">Au</label>
                <input
                  id="date-fin-filter"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  aria-label="Date de fin"
                />
              </div>

              <div>
                <label htmlFor="sort-filter" className="block text-xs text-neutral-600 dark:text-gray-300 mb-1">Trier par</label>
                <select
                  id="sort-filter"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  aria-label="Critère de tri"
                >
                  <option value="date_desc">Date (récent)</option>
                  <option value="date_asc">Date (ancien)</option>
                  <option value="client_asc">Client (A-Z)</option>
                  <option value="montant_desc">Montant (élevé)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                    setFilterZone('all');
                    setSortBy('date_desc');
                    setSearchTerm('');
                  }}
                  className="w-full px-3 py-2 text-sm text-neutral-600 dark:text-gray-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                  aria-label="Réinitialiser les filtres"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres statut rapides */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'imprime', label: 'Imprimés' },
            { id: 'pret_livraison', label: 'Prêt livraison' },
            { id: 'en_livraison', label: 'En livraison' },
            { id: 'livre', label: 'Livrés' },
            { id: 'retour', label: 'Retours' },
            { id: 'a_livrer', label: 'À livrer (Imprimés + Prêts)' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilterStatus(btn.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterStatus === btn.id
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-gray-200 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Sections par statut */}
        <div className="space-y-8">
          <StatusSection
            title="Imprimés"
            status="imprime"
            dossiers={dossiersByStatus.imprime}
            icon={DocumentIcon}
            color="purple"
          />

          <StatusSection
            title="Prêt livraison"
            status="pret_livraison"
            dossiers={dossiersByStatus.pret_livraison}
            icon={DocumentIcon}
            color="blue"
          />
          
          <StatusSection
            title="En Livraison"
            status="en_livraison"
            dossiers={dossiersByStatus.en_livraison}
            icon={TruckIcon}
            color="orange"
          />
          
          <StatusSection
            title="Livrés"
            status="livre"
            dossiers={dossiersByStatus.livre}
            icon={CheckCircleIcon}
            color="green"
          />
          
          <StatusSection
            title="Retours / Échecs"
            status="retour"
            dossiers={dossiersByStatus.retour}
            icon={ClockIcon}
            color="gray"
          />
        </div>
      </div>

      {/* Modal des détails */}
      <AnimatePresence>
        {showDetailsModal && selectedDossier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-neutral-200 dark:border-neutral-700"
            >
              <DossierDetails 
                dossier={selectedDossier} 
                onClose={() => setShowDetailsModal(false)} 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals améliorées avec confirmations */}
      <AnimatePresence>
        {showProgrammerModal && dossierEnCours && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowProgrammerModal(false)}
            role="dialog"
            aria-labelledby="programmer-modal-title"
            aria-describedby="programmer-modal-description"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-700"
            >
              <h3 id="programmer-modal-title" className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="h-6 w-6 text-emerald-600" /> 
                Programmer une livraison
              </h3>
              
              <div id="programmer-modal-description" className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-lg">
                  <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-2">
                    ℹ️ Cette action changera le statut du dossier en "En livraison"
                  </p>
                  <div className="text-sm text-neutral-600 dark:text-gray-300">
                    <p><strong>Dossier:</strong> {dossierEnCours.displayNumber}</p>
                    <p><strong>Client:</strong> {dossierEnCours.displayClient}</p>
                    <p><strong>Adresse:</strong> {dossierEnCours.displayAdresse}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-gray-200 mb-2">
                    Date de livraison prévue *
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    defaultValue={paiementData.date_livraison}
                    onChange={(e) => setPaiementData(prev => ({ ...prev, date_livraison: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                    aria-describedby="date-help"
                  />
                  <p id="date-help" className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    La date ne peut pas être antérieure à aujourd'hui
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-gray-200 mb-2">
                    Commentaire (optionnel)
                  </label>
                  <textarea
                    placeholder="Notes pour la livraison..."
                    onChange={(e) => setPaiementData(prev => ({ ...prev, commentaire: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    rows="2"
                  />
                </div>
                
                <div className="flex gap-2 mt-6">
                  <button 
                    onClick={() => setShowProgrammerModal(false)} 
                    className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-gray-200 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                    aria-label="Annuler la programmation"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={() => handleConfirmProgrammation(paiementData.date_livraison)} 
                    disabled={refreshing || !paiementData.date_livraison} 
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Confirmer la programmation de livraison"
                  >
                    {refreshing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Programmation...
                      </span>
                    ) : 'Confirmer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaiementModal && dossierEnCours && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaiementModal(false)}
            role="dialog"
            aria-labelledby="paiement-modal-title"
            aria-describedby="paiement-modal-description"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-neutral-200 dark:border-neutral-700"
            >
              <h3 id="paiement-modal-title" className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" /> 
                Valider la livraison
              </h3>
              
              <div id="paiement-modal-description" className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    ⚠️ Attention : Cette action finalisera définitivement la livraison
                  </p>
                  <div className="text-sm text-neutral-600 dark:text-gray-300">
                    <p><strong>Dossier:</strong> {dossierEnCours.displayNumber}</p>
                    <p><strong>Client:</strong> {dossierEnCours.displayClient}</p>
                    <p><strong>Adresse:</strong> {dossierEnCours.displayAdresse}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-gray-200 mb-2">
                      Date de livraison *
                    </label>
                    <input
                      type="date"
                      value={paiementData.date_livraison}
                      onChange={(e) => setPaiementData(prev => ({ ...prev, date_livraison: e.target.value }))}
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-gray-200 mb-2">
                      Mode de paiement *
                    </label>
                    <select
                      value={paiementData.mode_paiement}
                      onChange={(e) => setPaiementData(prev => ({ ...prev, mode_paiement: e.target.value }))}
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                      aria-describedby="payment-help"
                    >
                      <option value="">Sélectionnez un mode</option>
                      <option value="Wave">📱 Wave</option>
                      <option value="Orange Money">📱 Orange Money</option>
                      <option value="Virement bancaire">🏦 Virement bancaire</option>
                      <option value="Chèque">📝 Chèque</option>
                      <option value="Espèces">💵 Espèces</option>
                    </select>
                    <p id="payment-help" className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                      Sélectionnez le mode de paiement utilisé par le client
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-gray-200 mb-2">
                    Montant payé (CFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={paiementData.montant_cfa}
                    onChange={(e) => setPaiementData(prev => ({ ...prev, montant_cfa: e.target.value }))}
                    placeholder="Ex: 50000"
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                    aria-describedby="montant-help"
                  />
                  <p id="montant-help" className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                    Montant exact reçu du client
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-gray-200 mb-2">
                    Notes de livraison (optionnel)
                  </label>
                  <textarea
                    placeholder="Commentaires sur la livraison..."
                    onChange={(e) => setPaiementData(prev => ({ ...prev, notes_livraison: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    rows="2"
                  />
                </div>
                
                <div className="flex gap-2 mt-6">
                  <button 
                    onClick={() => setShowPaiementModal(false)} 
                    className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-gray-200 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                    aria-label="Annuler la validation"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleConfirmLivraison} 
                    disabled={refreshing || !paiementData.mode_paiement || !paiementData.montant_cfa} 
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Confirmer la livraison et le paiement"
                  >
                    {refreshing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Validation...
                      </span>
                    ) : '✅ Valider définitivement'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
};

// PropTypes
const PropTypes = require('prop-types');

LivreurDossiers.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nom: PropTypes.string,
    prenom: PropTypes.string,
    role: PropTypes.string,
  }),
};

export default LivreurDossiers;
