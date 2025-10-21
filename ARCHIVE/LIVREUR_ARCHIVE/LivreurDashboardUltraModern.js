import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TruckIcon,
  MapPinIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  MapIcon,
  PhoneIcon,
  CalendarDaysIcon,
  TagIcon,
  SparklesIcon,
  DocumentCheckIcon,
  PencilSquareIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../services/apiAdapter';
import DossierDetails from './dossiers/DossierDetailsFixed';
import notificationService from '../services/notificationService';
import confirmPromptService from '../services/confirmPromptService';
import PropTypes from 'prop-types';

const LivreurDashboardUltraModern = ({ user, initialView = 'a_livrer' }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState(initialView); // a_livrer, programmees, terminees
  const [showProgrammerModal, setShowProgrammerModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [dossierEnCours, setDossierEnCours] = useState(null);
  // Données de programmation (prévision)
  const [programmationData, setProgrammationData] = useState({
    date_livraison_prevue: new Date().toISOString().slice(0, 16), // datetime-local
    adresse_livraison: '',
    mode_paiement_prevu: '',
    montant_a_encaisser: '',
    commentaire: '',
  });
  // Données de confirmation (réel)
  const [paiementData, setPaiementData] = useState({
    date_livraison: new Date().toISOString().split('T')[0],
    mode_paiement: '',
    montant_cfa: ''
  });
  const [livraison, setLivraison] = useState({
    enCours: null,
    statut: 'libre', // libre, en_route, en_livraison, pause
    position: { lat: 48.8566, lng: 2.3522 }, // Paris par défaut
    trajetsDuJour: 0,
    kmParcourus: 0,
    tempsMoyen: 25, // minutes
  });

  // Filtres pour la vue "Terminées"
  const [termineeFilters, setTermineeFilters] = useState({
    startDate: '',
    endDate: '',
    machine: 'all', // all | roland | xerox
    payment: 'all', // all | Wave | Orange Money | Virement bancaire | Chèque | Espèces
    search: '',
  });

  // Statistiques calculées
  const [stats, setStats] = useState({
    totalLivraisons: 0,
    enAttente: 0,
    enCours: 0,
    terminees: 0,
    livraisonsJour: 0,
    tempsLivraison: 0,
    performance: 0,
    satisfaction: 95, // score de satisfaction client
  });

  // Normalisation des statuts
  const normalizeStatus = (statut) => {
    if (!statut) return '';
    const val = String(statut).toLowerCase().trim();
    // Normaliser les variations de statuts (workflow 8 statuts)
    if (val === 'terminé' || val === 'termine' || val === 'fini') return 'termine';
    if (val === 'prêt livraison' || val === 'pret_livraison' || val === 'pret livraison') return 'pret_livraison';
    if (val === 'en livraison' || val === 'en_livraison') return 'en_livraison';
    if (val === 'livré' || val === 'livre') return 'livre';
    return val;
  };

  // Calcul des statistiques (stable) - défini AVANT loadDossiers
  const calculateStats = useCallback((dossiersList) => {
    const totalLivraisons = dossiersList.length;
    // 📦 À livrer: dossiers prêts pour livraison
    const aLivrer = dossiersList.filter(d => {
      const status = normalizeStatus(d.statut);
      return status === 'pret_livraison';
    }).length;
    // 🚚 Programmées: en cours de livraison
    const programmees = dossiersList.filter(d => normalizeStatus(d.statut) === 'en_livraison').length;
    // ✅ Terminées: livrées
    const terminees = dossiersList.filter(d => normalizeStatus(d.statut) === 'livre').length;
    const enAttente = aLivrer;
    const enCours = programmees;
    
    const today = new Date();
    const livraisonsJour = dossiersList.filter(d => {
      const updated = new Date(d.updated_at || d.created_at);
      return updated.toDateString() === today.toDateString() && normalizeStatus(d.statut) === 'livre';
    }).length;

    // Total encaissé ce mois (CFA)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const encaisseMonth = dossiersList
      .filter(d => normalizeStatus(d.statut) === 'livre')
      .filter(d => new Date(d.updated_at || d.date_livraison || d.created_at) >= monthStart)
      .reduce((sum, d) => sum + (parseFloat(d.montant_encaisse || d.montant_cfa || 0) || 0), 0);

    setStats({
      totalLivraisons,
      enAttente,
      enCours,
      terminees,
      aLivrer,
      programmees,
      livraisonsJour,
      encaisseMois: encaisseMonth,
    });
  }, []);

  // Chargement des dossiers
  const loadDossiers = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);
      const response = await dossiersService.getDossiers();
      // Accepte les deux formes: { dossiers: [...] } ou { data: [...] }
      const list = Array.isArray(response?.dossiers)
        ? response.dossiers
        : Array.isArray(response?.data)
          ? response.data
          : [];
      
  if (list.length > 0) {
        // Filtrer les dossiers pertinents pour le livreur
        const livreurDossiers = list.filter(d => {
          const status = normalizeStatus(d.statut);
          // Statuts livreur (workflow 8 statuts):
          // - pret_livraison: prêt à être livré
          // - en_livraison: livraison programmée/en cours
          // - livre: livraison terminée
          return ['pret_livraison', 'en_livraison', 'livre'].includes(status);
        }).map(d => ({
          ...d,
          // Champs optionnels normalisés (si backend fournit d’autres noms)
          montant_prevu: d.montant_prevu || d.montant_a_encaisser || d.montant_encaisse_prevu || null,
          mode_paiement_prevu: d.mode_paiement_prevu || d.paiement_prevu || null,
          date_livraison_prevue: d.date_livraison_prevue || d.date_prevue || d.date_programmee || null,
          montant_encaisse: d.montant_encaisse || d.montant_paye || d.montant_cfa || null,
        }));
        setDossiers(livreurDossiers);
        calculateStats(livreurDossiers);
      } else {
        notificationService.warn('Réponse API invalide');
        setDossiers([]);
      }
    } catch (error) {
      notificationService.error('Erreur lors du chargement des dossiers');
      setDossiers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    loadDossiers(true);

    // Ecoute temps réel: rafraîchir sur mise à jour de dossier
    const offUpdated = notificationService.on('dossier_updated', () => loadDossiers());
    const offNew = notificationService.on('new_dossier', () => loadDossiers());

    // Simulation GPS en temps réel
    const gpsInterval = setInterval(() => {
      if (livraison.statut !== 'libre') {
        setLivraison(prev => ({
          ...prev,
          position: {
            lat: prev.position.lat + (Math.random() - 0.5) * 0.001,
            lng: prev.position.lng + (Math.random() - 0.5) * 0.001,
          }
        }));
      }
    }, 10000); // Update GPS every 10s

    return () => {
      clearInterval(gpsInterval);
      if (typeof offUpdated === 'function') offUpdated();
      if (typeof offNew === 'function') offNew();
    };
  }, [loadDossiers, livraison.statut]);

  // Composant Status Badge spécialisé livraison
  const DeliveryStatusBadge = ({ status, size = 'md' }) => {
    const configs = {
      pret_livraison: { 
        bg: 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30', 
        text: 'text-blue-800 dark:text-blue-300', 
        label: 'Prêt à livrer',
        icon: '📦',
        ring: 'ring-blue-200 dark:ring-blue-700'
      },
      en_livraison: { 
        bg: 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30', 
        text: 'text-amber-800 dark:text-amber-300', 
        label: 'En livraison',
        icon: '🚚',
        ring: 'ring-amber-200 dark:ring-amber-700',
        pulse: true
      },
      livre: { 
        bg: 'bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30', 
        text: 'text-emerald-800 dark:text-emerald-300', 
        label: 'Livré',
        icon: '✅',
        ring: 'ring-emerald-200 dark:ring-emerald-700'
      },
      termine: { 
        bg: 'bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800', 
        text: 'text-neutral-700 dark:text-neutral-300',
        label: 'Terminé',
        icon: '🏁',
        ring: 'ring-gray-300 dark:ring-gray-600'
      },
    };

    const config = configs[status] || { 
      bg: 'bg-gradient-to-r from-gray-100 to-slate-100', 
      text: 'text-neutral-700 dark:text-neutral-200', 
      label: status || 'Inconnu',
      icon: '📄',
      ring: 'ring-gray-200'
    };
    
    const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : size === 'lg' ? 'text-base px-4 py-2' : 'text-sm px-3 py-1.5';

    return (
      <span className={`${config.bg} ${config.text} ${config.ring} ${sizeClass} rounded-full font-medium inline-flex items-center gap-2 ring-1 shadow-sm ${config.pulse ? 'animate-pulse' : ''}`}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Composant Carte de Livraison
  const DeliveryCard = ({ dossier, index }) => {
    const status = normalizeStatus(dossier.statut);
    const isUrgent = dossier.urgent || dossier.priorite === 'high';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className={`bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 hover:shadow-xl dark:shadow-secondary-900/30 transition-all duration-300 border group hover:-translate-y-2 ${
          isUrgent 
            ? 'border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20' 
            : 'border-neutral-100 dark:border-neutral-700'
        }`}
      >
        {/* En-tête avec priorité */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-300">
                {dossier.nom || 'Sans nom'}
              </h3>
              {isUrgent && (
                <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                  🚨 URGENT
                </span>
              )}
            </div>
            <p className="text-neutral-600 dark:text-neutral-300 text-sm font-medium">{dossier.client}</p>
          </div>
          <DeliveryStatusBadge status={status} size="sm" />
        </div>

        {/* Informations de livraison */}
        <div className="space-y-3 mb-6">
          {/* Avertissement si infos manquantes */}
          {(!dossier.adresse_livraison || !dossier.telephone_contact) && (
            <div className="flex items-center gap-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 p-2 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <span>⚠️</span>
              <span className="font-medium">Informations incomplètes - Contactez le préparateur</span>
            </div>
          )}
          
          <div className={`flex items-center gap-3 text-sm p-3 rounded-lg ${
            dossier.adresse_livraison 
              ? 'text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-700'
              : 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
          }`}>
            <MapPinIcon className={`h-4 w-4 ${dossier.adresse_livraison ? 'text-error-500' : 'text-orange-600 dark:text-orange-400'}`} />
            <div>
              <div className="font-medium text-neutral-900 dark:text-white">Adresse de livraison</div>
              <div>{dossier.adresse_livraison || '⚠️ Adresse à compléter'}</div>
            </div>
          </div>
          
          <div className={`flex items-center gap-3 text-sm p-3 rounded-lg ${
            dossier.telephone_contact ? 'text-neutral-600 bg-neutral-50 dark:bg-neutral-900' : 'text-yellow-700 bg-yellow-50 border border-yellow-200'
          }`}>
            <PhoneIcon className={`h-4 w-4 ${dossier.telephone_contact ? 'text-emerald-500' : 'text-orange-600'}`} />
            <div>
              <div className="font-medium text-neutral-900">Contact</div>
              <div>
                {dossier.telephone_contact ? (
                  <a href={`tel:${dossier.telephone_contact}`} className="text-emerald-600 hover:underline">
                    {dossier.telephone_contact}
                  </a>
                ) : (
                  '⚠️ Téléphone à compléter'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <CalendarDaysIcon className="h-4 w-4" />
            <span>Créé le {new Date(dossier.created_at).toLocaleDateString()}</span>
          </div>

          {/* Infos spécifiques aux livraisons programmées */}
          {status === 'en_livraison' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="text-sm p-3 rounded-lg bg-blue-50 text-blue-700">
                <div className="font-medium">Date prévue</div>
                <div>{dossier.date_livraison_prevue ? new Date(dossier.date_livraison_prevue).toLocaleString() : 'N/A'}</div>
              </div>
              <div className="text-sm p-3 rounded-lg bg-emerald-50 text-emerald-700">
                <div className="font-medium">Montant à encaisser</div>
                <div>{new Intl.NumberFormat('fr-FR').format(dossier.montant_prevu || dossier.montant_a_encaisser || 0)} CFA</div>
              </div>
              {/* Statut complémentaire */}
              <div className="text-sm p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 md:col-span-2">
                <div className="font-medium">Etat</div>
                <div>
                  {(() => {
                    const now = new Date();
                    const prev = dossier.date_livraison_prevue ? new Date(dossier.date_livraison_prevue) : null;
                    if (prev && prev < now) return '⏰ En retard';
                    if (livraison.statut === 'en_route') return '🚚 En route';
                    return '🕒 En attente';
                  })()}
                </div>
              </div>
            </div>
          )}

          {dossier.type_formulaire && (
            <div className="flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                dossier.type_formulaire === 'roland' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {dossier.type_formulaire === 'roland' ? '🖨️ Roland' : '🖨️ Xerox'}
              </span>
            </div>
          )}
        </div>

        {/* Actions selon le statut */}
        <div className="flex gap-2">
          <button
            onClick={() => handleViewDetails(dossier)}
            className="flex-1 px-4 py-2 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 rounded-lg font-medium hover:bg-neutral-100 dark:bg-neutral-800 transition-colors duration-300 flex items-center justify-center gap-2"
          >
            <EyeIcon className="h-4 w-4" />
            Détails
          </button>
          <button
            onClick={() => downloadBonDeLivraison(dossier)}
            className="px-3 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 dark:bg-neutral-900 transition-colors duration-300"
            title="Télécharger le bon de livraison"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
          </button>
          
          {/* 📦 À livrer: bouton "Programmer" pour pret_livraison */}
          {(status === 'pret_livraison') && (
            <>
              <button
                onClick={() => handleProgrammerLivraison(dossier)}
                disabled={refreshing}
                className="flex-1 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-medium hover:bg-emerald-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CalendarDaysIcon className="h-4 w-4" />
                Programmer
              </button>
              <button
                onClick={() => {
                  const address = dossier.adresse_livraison || `${dossier.client}, Paris`;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-300"
                title="Naviguer vers l'adresse"
              >
                <MapIcon className="h-4 w-4" />
              </button>
            </>
          )}

          {/* 🚚 Programmées: bouton "Valider livraison" et "Modifier" */}
          {status === 'en_livraison' && (
            <>
              <button
                onClick={() => handleModifierLivraison(dossier)}
                disabled={refreshing}
                className="px-3 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-50 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                title="Modifier la livraison"
              >
                <PencilSquareIcon className="h-4 w-4" />
                Modifier
              </button>
              <button
                onClick={() => handleValiderLivraison(dossier)}
                disabled={refreshing}
                className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Valider livraison
              </button>
              <button
                onClick={() => {
                  const address = dossier.adresse_livraison || `${dossier.client}, Paris`;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-300"
                title="Naviguer vers l'adresse"
              >
                <MapIcon className="h-4 w-4" />
              </button>
            </>
          )}

          {/* ✅ Terminées: pas de bouton d'action, juste détails */}
        </div>
      </motion.div>
    );
  };

  // Actions sur les dossiers
  const handleViewDetails = (dossier) => {
    // ⚠️ GARDE : Rejeter les dossiers sans ID valide
    if (!dossier?.id || dossier.id === 'null' || dossier.id === 'undefined' || dossier.id === null || dossier.id === undefined) {
      notificationService.error(`Impossible d'ouvrir le dossier : ID invalide`);
      return;
    }
    setSelectedDossier(dossier);
    setShowDetailsModal(true);
  };

  const downloadBonDeLivraison = (dossier) => {
    try {
      const lines = [
        `Bon de Livraison`,
        `Numero: ${dossier.numero_commande || dossier.numero || dossier.id}`,
        `Client: ${dossier.client || dossier.client_nom || ''}`,
        `Adresse: ${dossier.adresse_livraison || ''}`,
        `Statut: ${normalizeStatus(dossier.statut)}`,
        `Montant prévu: ${new Intl.NumberFormat('fr-FR').format(dossier.montant_prevu || 0)} CFA`,
        `Montant encaissé: ${new Intl.NumberFormat('fr-FR').format(dossier.montant_encaisse || dossier.montant_cfa || 0)} CFA`,
        `Date prévue: ${dossier.date_livraison_prevue ? new Date(dossier.date_livraison_prevue).toLocaleString() : 'N/A'}`,
        `Date réelle: ${dossier.date_livraison ? new Date(dossier.date_livraison).toLocaleString() : 'N/A'}`,
      ].join('\n');
      const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bon_livraison_${dossier.numero || dossier.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      notificationService.error("Impossible de générer le bon de livraison");
    }
  };

  const getPaymentMode = (d) => d.mode_paiement || d.payment_mode || d.paiement || d.modePaiement || d.mode_paiement_utilise || '';

  const downloadTermineesCSV = (items) => {
    try {
      const headers = [
        'numero',
        'client',
        'type',
        'date_prevue',
        'date_livraison',
        'mode_paiement',
        'montant',
        'adresse',
      ];
      const rows = items.map(d => [
        d.numero_commande || d.numero || d.id,
        (d.client || d.client_nom || '').toString().replace(/\n/g, ' '),
        d.type_formulaire || '',
        d.date_livraison_prevue ? new Date(d.date_livraison_prevue).toLocaleString() : '',
        d.date_livraison ? new Date(d.date_livraison).toLocaleString() : (d.updated_at ? new Date(d.updated_at).toLocaleString() : ''),
        getPaymentMode(d),
        (d.montant_encaisse || d.montant_cfa || 0),
        (d.adresse_livraison || '').toString().replace(/\n/g, ' '),
      ]);

      const csv = [headers.join(';')]
        .concat(rows.map(r => r.map(v => (typeof v === 'string' && v.includes(';') ? `"${v.replace(/"/g, '""')}"` : v)).join(';')))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `livraisons_terminees_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      notificationService.error('Impossible de générer le CSV');
    }
  };

  // Note: fonction préparée pour usage futur (désactivée pour éviter warning ESLint)
  // eslint-disable-next-line no-unused-vars
  const handleStartDelivery = async (dossier) => {
    // Validation des informations avant démarrage
    if (!dossier.adresse_livraison) {
      notificationService.error('⚠️ Adresse de livraison manquante! Contactez le préparateur.');
      return;
    }
    
    if (!dossier.telephone_contact) {
      const confirmed = await confirmPromptService.confirm('⚠️ Numéro de téléphone manquant. Voulez-vous continuer quand même ?');
      if (!confirmed) return;
    }
    
    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossier.id, 'en_livraison', {
        commentaire: `Livraison démarrée par ${user?.nom || 'Livreur'}`
      });
      notificationService.success(`🚚 Livraison démarrée pour "${dossier.nom}"`);
      
      // Mise à jour du statut livreur
      setLivraison(prev => ({
        ...prev,
        statut: 'en_route',
        enCours: dossier
      }));
      
      loadDossiers();
    } catch (error) {
      // Prefer notification service for user-facing errors
      notificationService.error('Erreur lors du démarrage de la livraison');
    } finally {
      setRefreshing(false);
    }
  };

  // Programmer une livraison (ouvre modal de programmation)
  const handleProgrammerLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setProgrammationData({
      date_livraison_prevue: new Date().toISOString().slice(0, 16),
      adresse_livraison: dossier.adresse_livraison || '',
      mode_paiement_prevu: dossier.mode_paiement_prevu || '',
      montant_a_encaisser: dossier.montant_prevu || '',
      commentaire: '',
    });
    setShowProgrammerModal(true);
  };

  // Modifier une livraison programmée
  const handleModifierLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setProgrammationData({
      date_livraison_prevue: (dossier.date_livraison_prevue ? new Date(dossier.date_livraison_prevue) : new Date()).toISOString().slice(0,16),
      adresse_livraison: dossier.adresse_livraison || '',
      mode_paiement_prevu: dossier.mode_paiement_prevu || '',
      montant_a_encaisser: dossier.montant_prevu || dossier.montant_a_encaisser || '',
      commentaire: 'Modification de la livraison programmée',
    });
    setShowProgrammerModal(true);
  };

  // Confirmer programmation et passer en "en_livraison"
  const handleConfirmProgrammation = async () => {
    try {
      setRefreshing(true);
      const payload = {
        date_livraison_prevue: programmationData.date_livraison_prevue,
        adresse_livraison: programmationData.adresse_livraison,
        mode_paiement_prevu: programmationData.mode_paiement_prevu,
        montant_a_encaisser: programmationData.montant_a_encaisser ? parseFloat(programmationData.montant_a_encaisser) : undefined,
        comment: programmationData.commentaire || `Livraison programmée par ${user?.nom || 'Livreur'}`,
      };

      // Essayer d'utiliser l'endpoint dédié si dispo
      try {
        await dossiersService.scheduleDelivery(dossierEnCours.id, payload);
      } catch (e) {
        // Fallback: simple changement de statut avec commentaire et date prévue
        await dossiersService.updateDossierStatus(dossierEnCours.id, 'en_livraison', {
          commentaire: payload.comment,
          date_livraison_prevue: programmationData.date_livraison_prevue,
          adresse_livraison: programmationData.adresse_livraison,
          montant_cfa: payload.montant_a_encaisser,
        });
      }

      notificationService.success(`📅 Livraison programmée pour le ${new Date(programmationData.date_livraison_prevue).toLocaleString()}`);
      setShowProgrammerModal(false);
      setDossierEnCours(null);
      loadDossiers();
    } catch (error) {
      notificationService.error('Erreur lors de la programmation');
    } finally {
      setRefreshing(false);
    }
  };

  // Valider livraison (ouvre modal de paiement)
  const handleValiderLivraison = (dossier) => {
    setDossierEnCours(dossier);
    setPaiementData({
      date_livraison: new Date().toISOString().split('T')[0],
      mode_paiement: '',
      montant_cfa: ''
    });
    setShowPaiementModal(true);
  };

  // Confirmer livraison avec informations de paiement
  const handleConfirmLivraison = async () => {
    if (!paiementData.mode_paiement || !paiementData.montant_cfa) {
      notificationService.error('⚠️ Veuillez remplir le mode de paiement et le montant');
      return;
    }

    try {
      setRefreshing(true);
      await dossiersService.updateDossierStatus(dossierEnCours.id, 'livre', {
        commentaire: `Livraison terminée par ${user?.nom || 'Livreur'}`,
        date_livraison: paiementData.date_livraison,
        mode_paiement: paiementData.mode_paiement,
        montant_cfa: parseFloat(paiementData.montant_cfa)
      });
      notificationService.success(`✅ Livraison validée - ${paiementData.montant_cfa} CFA par ${paiementData.mode_paiement}`);
      
      // Mise à jour du statut livreur
      setLivraison(prev => ({
        ...prev,
        statut: 'libre',
        enCours: null,
        trajetsDuJour: prev.trajetsDuJour + 1,
        kmParcourus: prev.kmParcourus + 12.5
      }));

      setShowPaiementModal(false);
      setDossierEnCours(null);
      loadDossiers();
    } catch (error) {
      notificationService.error('Erreur lors de la validation');
    } finally {
      setRefreshing(false);
    }
  };

  // Navigation secondaire - 3 sections selon cahier des charges
  const viewTabs = [
    { id: 'a_livrer', label: '📦 À livrer', icon: DocumentCheckIcon, count: stats.enAttente },
    { id: 'programmees', label: '🚚 Programmées', icon: TruckIcon, count: stats.enCours },
    { id: 'terminees', label: '✅ Terminées', icon: CheckCircleIcon, count: stats.terminees },
  ];

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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-cyan-50 dark:from-secondary-900 dark:via-secondary-900 dark:to-secondary-900">
      {/* Header moderne avec gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-600 via-green-600 to-cyan-600 dark:from-emerald-800 dark:via-green-800 dark:to-cyan-800 text-white shadow-2xl"
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <TruckIcon className="h-8 w-8" />
                  </div>
                  Centre de Livraison
                </h1>
                <p className="text-emerald-100 mt-2 text-lg">
                  Bienvenue, {user?.nom || 'Livreur'}! Gérez vos livraisons efficacement
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <span className="text-sm text-emerald-50">Total encaissé (mois)</span>
                  <span className="text-lg font-extrabold text-white">{new Intl.NumberFormat('fr-FR').format(stats.encaisseMonth || 0)} CFA</span>
                </div>
                <button
                  onClick={() => loadDossiers(true)}
                  disabled={refreshing}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-sm transition-all duration-300 disabled:opacity-50"
                >
                  <ArrowPathIcon className={`h-6 w-6 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-sm ${
                  livraison.statut === 'libre' ? 'bg-green-400/20' :
                  livraison.statut === 'en_route' ? 'bg-orange-400/20' :
                  'bg-red-400/20'
                }`}>
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    livraison.statut === 'libre' ? 'bg-green-400' :
                    livraison.statut === 'en_route' ? 'bg-orange-400' :
                    'bg-red-400'
                  }`}></div>
                  <span className="text-sm font-medium">
                    {livraison.statut === 'libre' ? 'Disponible' :
                     livraison.statut === 'en_route' ? 'En route' :
                     'En livraison'}
                  </span>
                </div>
              </div>
            </div>

          {/* Navigation secondaire avec compteurs */}
          <div className="flex gap-2 mt-8">
            {viewTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
                  activeView === tab.id
                    ? 'bg-white text-emerald-600 shadow-lg dark:shadow-secondary-900/25'
                    : 'text-emerald-100 hover:bg-white/20'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeView === tab.id 
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-white/20 text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Filtrage des dossiers selon la vue active */}
          {(() => {
            let filteredDossiers = [];
            let sectionTitle = '';
            let sectionIcon = null;
            
          if (activeView === 'a_livrer') {
            filteredDossiers = dossiers.filter(d => {
              const status = normalizeStatus(d.statut);
              return status === 'pret_livraison';
            });
            sectionTitle = '📦 Dossiers à livrer';
            sectionIcon = DocumentCheckIcon;
          } else if (activeView === 'programmees') {
            filteredDossiers = dossiers.filter(d => normalizeStatus(d.statut) === 'en_livraison');
            sectionTitle = '🚚 Livraisons programmées';
            sectionIcon = TruckIcon;
          } else if (activeView === 'terminees') {
            filteredDossiers = dossiers.filter(d => normalizeStatus(d.statut) === 'livre');
            sectionTitle = '✅ Livraisons terminées';
            sectionIcon = CheckCircleIcon;
          }

          // Appliquer filtres supplémentaires pour "Terminees"
          let visibleDossiers = filteredDossiers;
          if (activeView === 'terminees') {
            visibleDossiers = filteredDossiers.filter(d => {
              const q = (termineeFilters.search || '').toLowerCase();
              const client = (d.client || d.client_nom || '').toLowerCase();
              const numero = (d.numero_commande || d.numero || `${d.id || ''}`).toLowerCase();
              const dateDelivered = new Date(d.date_livraison || d.updated_at || d.created_at);
              const type = (d.type_formulaire || '').toLowerCase();
              const pmode = (getPaymentMode(d) || '').toLowerCase();

              const matchesSearch = !q || client.includes(q) || numero.includes(q);
              const matchesMachine = termineeFilters.machine === 'all' || type.includes(termineeFilters.machine);
              const matchesPayment = termineeFilters.payment === 'all' || pmode === termineeFilters.payment.toLowerCase();
              const matchesStart = !termineeFilters.startDate || dateDelivered >= new Date(termineeFilters.startDate);
              const matchesEnd = !termineeFilters.endDate || dateDelivered <= new Date(`${termineeFilters.endDate}T23:59:59`);
              return matchesSearch && matchesMachine && matchesPayment && matchesStart && matchesEnd;
            });
          }

          return (
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* En-tête de section */}
              <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg mb-6 border border-neutral-100 dark:border-neutral-700">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
                    {sectionIcon && React.createElement(sectionIcon, { className: 'h-8 w-8 text-emerald-600' })}
                    {sectionTitle}
                    <span className="text-lg font-normal text-neutral-500 dark:text-neutral-400">({visibleDossiers.length})</span>
                  </h2>
                  {activeView === 'terminees' && (
                    <button
                      onClick={() => downloadTermineesCSV(visibleDossiers)}
                      className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
                    >
                      Export CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Panneau de filtres pour "Terminées" */}
              {activeView === 'terminees' && (
                <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg border border-neutral-100 dark:border-neutral-700">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Date min</label>
                      <input
                        type="date"
                        value={termineeFilters.startDate}
                        onChange={(e) => setTermineeFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Date max</label>
                      <input
                        type="date"
                        value={termineeFilters.endDate}
                        onChange={(e) => setTermineeFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Machine</label>
                      <select
                        value={termineeFilters.machine}
                        onChange={(e) => setTermineeFilters(prev => ({ ...prev, machine: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="all">Toutes</option>
                        <option value="roland">Roland</option>
                        <option value="xerox">Xerox</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Paiement</label>
                      <select
                        value={termineeFilters.payment}
                        onChange={(e) => setTermineeFilters(prev => ({ ...prev, payment: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="all">Tous</option>
                        <option value="Wave">Wave</option>
                        <option value="Orange Money">Orange Money</option>
                        <option value="Virement bancaire">Virement bancaire</option>
                        <option value="Chèque">Chèque</option>
                        <option value="Espèces">Espèces</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Recherche</label>
                      <input
                        type="text"
                        value={termineeFilters.search}
                        onChange={(e) => setTermineeFilters(prev => ({ ...prev, search: e.target.value }))}
                        placeholder="Client ou n° dossier"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  {(termineeFilters.startDate || termineeFilters.endDate || termineeFilters.machine !== 'all' || termineeFilters.payment !== 'all' || termineeFilters.search) && (
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-sm text-neutral-600 dark:text-neutral-300">{visibleDossiers.length} résultat(s)</span>
                      <button
                        onClick={() => setTermineeFilters({ startDate: '', endDate: '', machine: 'all', payment: 'all', search: '' })}
                        className="text-sm text-emerald-600 hover:underline"
                      >
                        Effacer filtres
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Statistiques rapides */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-neutral-100 dark:border-neutral-700 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">En attente</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{stats.enAttente}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Prêtes à livrer</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 group-hover:scale-110 transition-transform duration-300">
                    <DocumentCheckIcon className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-neutral-100 dark:border-neutral-700 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">En cours</p>
                    <p className="text-3xl font-bold text-amber-600 mt-2">{stats.enCours}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">En livraison</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 group-hover:scale-110 transition-transform duration-300">
                    <TruckIcon className="h-8 w-8 text-amber-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-neutral-100 dark:border-neutral-700 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Livrées</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.terminees}</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Terminées</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-neutral-100 dark:border-neutral-700 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Performance</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">{stats.performance}%</p>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">Efficacité</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 group-hover:scale-110 transition-transform duration-300">
                    <SparklesIcon className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </motion.div>
            </div>

              {/* Liste des dossiers filtrés */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {visibleDossiers.map((dossier, index) => (
                    <DeliveryCard key={dossier.id} dossier={dossier} index={index} />
                  ))}
                </AnimatePresence>
              </div>

              {visibleDossiers.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 bg-white rounded-2xl shadow-lg dark:shadow-secondary-900/25"
                >
                  <TruckIcon className="h-16 w-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
                    {activeView === 'a_livrer' && 'Aucun dossier à livrer'}
                    {activeView === 'programmees' && 'Aucune livraison programmée'}
                    {activeView === 'terminees' && 'Aucune livraison terminée'}
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400">
                    {activeView === 'a_livrer' && 'Tous les dossiers imprimés ont été programmés'}
                    {activeView === 'programmees' && 'Toutes les livraisons sont terminées'}
                    {activeView === 'terminees' && 'Aucune livraison finalisée pour le moment'}
                  </p>
                </motion.div>
              )}
            </motion.div>
          );
        })()}

      </div>

      {/* Modal des détails */}
      <AnimatePresence>
        {showDetailsModal && selectedDossier && (
          <DossierDetails
            dossierId={
              selectedDossier.id || 
              selectedDossier.folder_id || 
              selectedDossier.dossier_id ||
              selectedDossier.numero_dossier
            }
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedDossier(null);
            }}
            user={user}
            onUpdate={loadDossiers}
          />
        )}
      </AnimatePresence>

      {/* Modal Programmer Livraison */}
      <AnimatePresence>
        {showProgrammerModal && dossierEnCours && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowProgrammerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <h3 className="text-2xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="h-6 w-6 text-emerald-600" />
                Programmer une livraison
              </h3>
              
              <div className="space-y-4">
                <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Dossier</p>
                  <p className="font-semibold text-neutral-900">{dossierEnCours.nom || dossierEnCours.client}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
                    Date et heure prévues
                  </label>
                  <input
                    type="datetime-local"
                    min={new Date().toISOString().slice(0,16)}
                    value={programmationData.date_livraison_prevue}
                    onChange={(e) => setProgrammationData(prev => ({ ...prev, date_livraison_prevue: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Adresse de livraison</label>
                  <input
                    type="text"
                    value={programmationData.adresse_livraison}
                    onChange={(e) => setProgrammationData(prev => ({ ...prev, adresse_livraison: e.target.value }))}
                    placeholder={dossierEnCours.adresse_livraison || 'Ex: Avenue, Ville / Lieu connu'}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Mode de paiement prévu</label>
                    <select
                      value={programmationData.mode_paiement_prevu}
                      onChange={(e) => setProgrammationData(prev => ({ ...prev, mode_paiement_prevu: e.target.value }))}
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Sélectionnez</option>
                      <option value="Wave">📱 Wave</option>
                      <option value="Orange Money">📱 Orange Money</option>
                      <option value="Virement bancaire">🏦 Virement bancaire</option>
                      <option value="Chèque">📝 Chèque</option>
                      <option value="Espèces">💵 Espèces</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Montant à encaisser (CFA)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={programmationData.montant_a_encaisser}
                      onChange={(e) => setProgrammationData(prev => ({ ...prev, montant_a_encaisser: e.target.value }))}
                      placeholder="Ex: 50000"
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Notes (optionnel)</label>
                  <textarea
                    value={programmationData.commentaire}
                    onChange={(e) => setProgrammationData(prev => ({ ...prev, commentaire: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Ex: Laisser à l'accueil, demander facture papier, etc."
                  />
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setShowProgrammerModal(false)}
                    className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 dark:bg-neutral-700 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmProgrammation}
                    disabled={refreshing}
                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {refreshing ? 'Programmation...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Valider Livraison avec Paiement */}
      <AnimatePresence>
        {showPaiementModal && dossierEnCours && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaiementModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <h3 className="text-2xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                Valider la livraison
              </h3>
              
              <div className="space-y-4">
                <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Dossier</p>
                  <p className="font-semibold text-neutral-900">{dossierEnCours.nom || dossierEnCours.client}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
                    Date de livraison
                  </label>
                  <input
                    type="date"
                    value={paiementData.date_livraison}
                    onChange={(e) => setPaiementData(prev => ({ ...prev, date_livraison: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
                    Mode de paiement *
                  </label>
                  <select
                    value={paiementData.mode_paiement}
                    onChange={(e) => setPaiementData(prev => ({ ...prev, mode_paiement: e.target.value }))}
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Sélectionnez un mode</option>
                    <option value="Wave">📱 Wave</option>
                    <option value="Orange Money">📱 Orange Money</option>
                    <option value="Virement bancaire">🏦 Virement bancaire</option>
                    <option value="Chèque">📝 Chèque</option>
                    <option value="Espèces">💵 Espèces</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">
                    Montant payé (CFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={paiementData.montant_cfa}
                    onChange={(e) => setPaiementData(prev => ({ ...prev, montant_cfa: e.target.value }))}
                    placeholder="Ex: 50000"
                    className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setShowPaiementModal(false)}
                    className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 dark:bg-neutral-700 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmLivraison}
                    disabled={refreshing || !paiementData.mode_paiement || !paiementData.montant_cfa}
                    className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {refreshing ? 'Validation...' : 'Valider'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// PropTypes validation
LivreurDashboardUltraModern.propTypes = {
  user: PropTypes.shape({
    nom: PropTypes.string
  }),
  initialView: PropTypes.oneOf(['a_livrer', 'programmees', 'terminees'])
};

LivreurDashboardUltraModern.defaultProps = {
  user: {
    nom: 'Livreur'
  },
  initialView: 'a_livrer'
};

export default LivreurDashboardUltraModern;