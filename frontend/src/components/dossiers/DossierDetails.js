import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  TrashIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../../services/apiAdapter';
import filesService, { uploadFilesAuto } from '../../services/filesService';
import notificationService from '../../services/notificationService';
import FileUpload from '../files/FileUpload';
import FileViewer from '../files/FileViewer';
import { useAuth } from '../../context/AuthContext';
import { normalizeDossier } from '../../services/dossierNormalizer';
import { getAvailableActions, WORKFLOW_ACTIONS } from '../../workflow-adapter/workflowActions';
import { normalizeStatusLabel } from '../../workflow-adapter/normalizeStatusLabel';
import { filterValidFiles } from '../../utils/fileValidation';
import { useDossierData } from '../../hooks/useDossierData';
import { stringifyFormData } from '../../utils/formDataNormalizer';
import AmountBadge from './AmountBadge';

// Composant pour charger les miniatures d'images avec gestion d'erreur
const FileThumbnailImage = ({ file }) => {
  const [imageUrl, setImageUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    const loadImage = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_URL || '/api';
        const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

        const response = await fetch(`${API_BASE}/files/preview/${file.id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.ok) throw new Error('Erreur de chargement');

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (isMounted) {
          setImageUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    if (file?.id) {
      loadImage();
    }

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file?.id]); // Supprimé imageUrl des dépendances

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="text-center">
        <svg className="w-20 h-20 mx-auto text-pink-500 dark:text-pink-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm text-gray-600 dark:text-gray-400 font-bold">Image</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={file.original_filename || file.nom}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
    />
  );
};

// Composant pour charger les miniatures de PDF
const FileThumbnailPDF = ({ file }) => {
  const [pdfUrl, setPdfUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    const loadPDF = async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_URL || '/api';
        const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

        const response = await fetch(`${API_BASE}/files/preview/${file.id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.ok) throw new Error('Erreur de chargement');

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (isMounted) {
          setPdfUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    if (file?.id) {
      loadPDF();
    }

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !pdfUrl) {
    return (
      <div className="text-center p-4">
        <svg className="w-20 h-20 mx-auto text-red-400 dark:text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">PDF</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-white flex items-center justify-center overflow-hidden">
      <iframe
        src={`${pdfUrl}#page=1&view=FitH`}
        className="w-full h-full border-0 pointer-events-none scale-150 origin-top"
        title="PDF Preview"
      />
      {/* Overlay pour éviter l'interaction */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
};

export default function DossierDetails({
  dossier: dossierProp = null,
  dossierId = null,
  isOpen = false,
  onClose,
  onStatusChange = () => { }
}) {
  const { user } = useAuth();
  const { updateFormData } = useDossierData();

  // Normaliser et mettre à jour les données du formulaire
  const processNewData = useCallback((rawData) => {
    if (!rawData) return null;
    
    // 1. Normaliser les données du formulaire
    const withUpdatedForm = updateFormData(rawData);
    
    // 2. Normaliser le dossier complet
    const normalized = normalizeDossier(withUpdatedForm);
    
    // 3. S'assurer que les données du formulaire sont bien stringifiées
    if (normalized?.data_formulaire) {
      normalized.data_formulaire = stringifyFormData(normalized.data_formulaire);
    }
    
    return normalized;
  }, [updateFormData]);

  // Initialiser avec dossierProp seulement s'il est vraiment fourni et valide
  const [dossier, setDossier] = useState(() => {
    if (dossierProp && typeof dossierProp === 'object' && Object.keys(dossierProp).length > 0) {
      return processNewData(dossierProp);
    }
    return null;
  });
  const [files, setFiles] = useState([]);
  const [statutHistory, setStatutHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingStatut, setChangingStatut] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentModalValue, setCommentModalValue] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [showForceStatusModal, setShowForceStatusModal] = useState(false);
  const [forceStatusValue, setForceStatusValue] = useState('');
  const [fileToDelete, setFileToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Modal de livraison avec montant
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryAmount, setDeliveryAmount] = useState('');

  // Extraire l'ID - utiliser un state pour le garder stable
  const [effectiveId, setEffectiveId] = useState(null);
  
  // État pour masquer temporairement ce modal quand CreateDossier est ouvert
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Ref pour éviter les mises à jour inutiles
  const lastResolvedIdRef = useRef(null);

  // Mettre à jour l'ID quand le modal s'ouvre - SIMPLIFIÉ pour éviter les boucles
  useEffect(() => {
    if (!isOpen) {
      // Modal fermé, réinitialiser
      if (effectiveId !== null) {
        console.log('🔄 [DossierDetails] Modal fermé, réinitialisation ID');
        setEffectiveId(null);
        lastResolvedIdRef.current = null;
      }
      return;
    }

    // Modal ouvert, extraire l'ID de façon simple
    const extractValidId = (value) => {
      if (!value || value === null || value === undefined) return null;
      const strValue = String(value).trim();
      if (strValue === '' || strValue === 'null' || strValue === 'undefined') return null;
      return parseInt(value, 10);
    };

    const id = extractValidId(dossierId) || 
      (dossierProp ? extractValidId(dossierProp.id || dossierProp.folder_id) : null);

    // Ne mettre à jour que si l'ID a vraiment changé
    if (id && id !== lastResolvedIdRef.current) {
      console.log('📝 [DossierDetails] Nouveau dossier détecté:', { ancien: lastResolvedIdRef.current, nouveau: id });
      lastResolvedIdRef.current = id;
      setEffectiveId(id);
    }
    // ⚠️ IMPORTANT: Ne dépendre que de isOpen et dossierId pour éviter les boucles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dossierId]);

  const formatDateTime = dateString => {
    try {
      if (!dateString) return 'Date inconnue';
      return new Date(dateString).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Date invalide';
    }
  };

  const formatDateSafe = dateString => {
    try {
      if (!dateString) return 'Date inconnue';
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Date invalide';
    }
  };

  const getStatusBadge = status => {
    const statusConfig = {
      nouveau: {
        gradient: 'bg-gradient-to-r from-sky-400 to-blue-500 dark:from-sky-500 dark:to-blue-600',
        icon: '🆕',
        label: 'Nouveau',
        ring: 'ring-sky-300/50 dark:ring-sky-400/40',
        shadow: 'shadow-sky-500/50 dark:shadow-sky-600/40'
      },
      en_cours: {
        gradient: 'bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600',
        icon: '⚙️',
        label: 'En préparation',
        ring: 'ring-yellow-300/50 dark:ring-yellow-400/40',
        shadow: 'shadow-yellow-500/50 dark:shadow-yellow-600/40'
      },
      a_revoir: {
        gradient: 'bg-gradient-to-r from-rose-500 to-red-600 dark:from-rose-600 dark:to-red-700',
        icon: '⚠️',
        label: 'À revoir',
        ring: 'ring-rose-300/50 dark:ring-rose-400/40',
        shadow: 'shadow-rose-500/50 dark:shadow-rose-600/40',
        animate: 'animate-pulse'
      },
      pret_impression: {
        gradient: 'bg-gradient-to-r from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700',
        icon: '✓',
        label: 'Prêt impression',
        ring: 'ring-violet-300/50 dark:ring-violet-400/40',
        shadow: 'shadow-violet-500/50 dark:shadow-violet-600/40'
      },
      en_impression: {
        gradient: 'bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700',
        icon: '🖨️',
        label: 'En impression',
        ring: 'ring-amber-300/50 dark:ring-amber-400/40',
        shadow: 'shadow-amber-500/50 dark:shadow-amber-600/40'
      },
      imprime: {
        gradient: 'bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700',
        icon: '📋',
        label: 'Imprimé',
        ring: 'ring-emerald-300/50 dark:ring-emerald-400/40',
        shadow: 'shadow-emerald-500/50 dark:shadow-emerald-600/40'
      },
      pret_livraison: {
        gradient: 'bg-gradient-to-r from-cyan-500 to-sky-600 dark:from-cyan-600 dark:to-sky-700',
        icon: '📦',
        label: 'Prêt livraison',
        ring: 'ring-cyan-300/50 dark:ring-cyan-400/40',
        shadow: 'shadow-cyan-500/50 dark:shadow-cyan-600/40'
      },
      en_livraison: {
        gradient: 'bg-gradient-to-r from-indigo-500 to-blue-600 dark:from-indigo-600 dark:to-blue-700',
        icon: '🚚',
        label: 'En livraison',
        ring: 'ring-indigo-300/50 dark:ring-indigo-400/40',
        shadow: 'shadow-indigo-500/50 dark:shadow-indigo-600/40'
      },
      livre: {
        gradient: 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700',
        icon: '✅',
        label: 'Livré',
        ring: 'ring-green-300/50 dark:ring-green-400/40',
        shadow: 'shadow-green-500/50 dark:shadow-green-600/40'
      },
      termine: {
        gradient: 'bg-gradient-to-r from-teal-500 to-green-600 dark:from-teal-600 dark:to-green-700',
        icon: '🎉',
        label: 'Terminé',
        ring: 'ring-teal-300/50 dark:ring-teal-400/40',
        shadow: 'shadow-teal-500/50 dark:shadow-teal-600/40'
      },
    };

    const config = statusConfig[status] || {
      gradient: 'bg-gradient-to-r from-slate-500 to-gray-600 dark:from-slate-600 dark:to-gray-700',
      icon: '📋',
      label: status,
      ring: 'ring-slate-300/50 dark:ring-slate-400/40',
      shadow: 'shadow-slate-500/50 dark:shadow-slate-600/40'
    };

    return (
      <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white ${config.gradient} shadow-lg ${config.shadow} ring-4 ${config.ring} transform transition-all duration-300 hover:scale-105 hover:shadow-2xl ${config.animate || ''}`}>
        <span className="text-lg">{config.icon}</span>
        <span className="tracking-wide">{config.label}</span>
      </span>
    );
  };

  // 💰 Badge pour le statut de paiement
  const getPaymentStatusBadge = (dossier) => {
    // Synchronisé avec DeliveryCard.js
    const isPaye = dossier.statut_paiement === 'paye' || dossier.statut_paiement === 'encaisse';
    const montant = dossier.montant_cfa ? new Intl.NumberFormat('fr-FR').format(dossier.montant_cfa) : '';
    const montantDisplay = montant ? ` - ${montant} FCFA` : '';
    const aLaLivraison = dossier.mode_paiement_final === 'a_la_livraison' || dossier.mode_paiement === 'a_la_livraison';
    const isPartiel = dossier.statut_paiement === 'acompte' || dossier.statut_paiement === 'partiellement_paye';

    const paymentConfig = {
      paye: {
        gradient: 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700',
        icon: '✅',
        label: `Payé${montantDisplay}`,
        ring: 'ring-green-300/50 dark:ring-green-400/40',
        shadow: 'shadow-green-500/50 dark:shadow-green-600/40'
      },
      a_encaisser: {
        gradient: 'bg-gradient-to-r from-orange-500 to-amber-600 dark:from-orange-600 dark:to-amber-700',
        icon: '💰',
        label: `À encaisser: ${montant || '0'} FCFA`,
        ring: 'ring-orange-300/50 dark:ring-orange-400/40',
        shadow: 'shadow-orange-500/50 dark:shadow-orange-600/40',
        animate: 'animate-pulse'
      },
      partiel: {
        gradient: 'bg-gradient-to-r from-yellow-500 to-orange-600 dark:from-yellow-600 dark:to-orange-700',
        icon: '💰',
        label: 'Paiement partiel',
        ring: 'ring-yellow-300/50 dark:ring-yellow-400/40',
        shadow: 'shadow-yellow-500/50 dark:shadow-yellow-600/40'
      },
      non_paye: {
        gradient: 'bg-gradient-to-r from-red-500 to-rose-600 dark:from-red-600 dark:to-rose-700',
        icon: '💳',
        label: `Non payé${montantDisplay}`,
        ring: 'ring-red-300/50 dark:ring-red-400/40',
        shadow: 'shadow-red-500/50 dark:shadow-red-600/40',
        animate: 'animate-pulse'
      }
    };

    let configKey;
    if (isPaye) {
      configKey = 'paye';
    } else if (aLaLivraison && !isPaye) {
      configKey = 'a_encaisser';
    } else if (isPartiel) {
      configKey = 'partiel';
    } else {
      configKey = 'non_paye';
    }

    const config = paymentConfig[configKey];

    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs text-white ${config.gradient} shadow-lg ${config.shadow} ring-2 ${config.ring} transform transition-all duration-300 hover:scale-105 hover:shadow-2xl ${config.animate || ''}`}>
        <span className="text-base">{config.icon}</span>
        <span className="tracking-wide">{config.label}</span>
      </span>
    );
  };

  // Fonction pour forcer la mise à jour du formulaire avec les bonnes données
  const forceFormDataUpdate = useCallback((raw) => {
    if (!raw?.data_formulaire) return raw;

    // Forcer la mise à jour des champs spécifiques
    const updatedFormData = {
      ...raw.data_formulaire,
      nombre_exemplaires: raw.data_formulaire.nombre_exemplaires?.toString()
    };

    return {
      ...raw,
      data_formulaire: updatedFormData
    };
  }, []);

  const loadDossierDetails = useCallback(async () => {
    const id = effectiveId;
    if (!id) {
      if (process.env.NODE_ENV === 'development') {
        notificationService.debug && notificationService.debug('[DossierDetails] loadDossierDetails appelé sans ID valide');
      }
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (process.env.NODE_ENV === 'development') {
        notificationService.debug && notificationService.debug('[DossierDetails] Chargement du dossier:', id);
      }

      // Log avant l'appel API
      console.log('🔍 [DossierDetails] Appel getDossier avec ID:', id);

      // Forcer un rechargement frais avec un timestamp
      const timestamp = new Date().getTime();
      const response = await dossiersService.getDossier(id, { 
        cache_buster: timestamp,
        _: timestamp, // Query param supplémentaire pour forcer le rechargement
        force_refresh: true // Force le rechargement complet
      });

      // Log de la réponse complète
      console.log('📥 [DossierDetails] Réponse API complète:', response);

      const raw = response?.dossier || response;
      if (!raw) {
        throw new Error('Aucune donnée de dossier reçue');
      }

      // Log des données spécifiques
      console.log('� [DossierDetails] Données critiques:', {
        id: raw.id,
        numero: raw.numero,
        quantite: raw.data_formulaire?.nombre_exemplaires,
        quantite_raw: raw.nombre_exemplaires,
        amount: raw.amount || raw.montant_cfa,
        data_formulaire: raw.data_formulaire
      });

      // Prétraitement des données pour s'assurer que la quantité est correctement gérée
      const preprocessed = {
        ...raw,
        data_formulaire: {
          ...raw.data_formulaire,
          nombre_exemplaires: String(raw.data_formulaire?.nombre_exemplaires || 0)
        }
      };

      const normalized = normalizeDossier(preprocessed);

      // Force la mise à jour des données critiques après normalisation
      normalized.data_formulaire = {
        ...normalized.data_formulaire,
        nombre_exemplaires: String(preprocessed.data_formulaire.nombre_exemplaires)
      };

      // Log après normalisation avec focus sur les données importantes
      console.log('📤 [DossierDetails] Après normalisation:', {
        id: normalized.id,
        numero: normalized.numero,
        quantite: normalized.data_formulaire?.nombre_exemplaires,
        amount: normalized.amount,
        data_formulaire: normalized.data_formulaire
      });

      // 🔍 DEBUG: Vérifier si description et telephone_client sont présents
      console.log('📦 [DossierDetails] Dossier reçu:', {
        id: normalized.id,
        client: normalized.client,
        description: normalized.description,
        telephone_client: normalized.telephone_client,
        montant_cfa: normalized.montant_cfa,
        amount: normalized.amount,
        data_formulaire: normalized.data_formulaire,
        raw_montant: raw.montant_cfa || raw.amount,
        raw_description: raw.description,
        raw_telephone: raw.telephone_client,
        raw_data_formulaire: raw.data_formulaire
      });

      let dossierFiles = response.files || raw?.fichiers || [];

      if (!dossierFiles || dossierFiles.length === 0) {
        try {
          const filesResponse = await filesService.getFiles(id);
          dossierFiles = filesResponse.files || [];
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            notificationService.debug && notificationService.debug('[DossierDetails] Impossible de charger les fichiers:', err);
          }
          // notificationService.warn n'existe pas, on utilise error avec un niveau bas
          // ou on ne notifie pas l'utilisateur pour ne pas le spammer
        }
      }

      // Filtrer les fichiers avec ID invalide
      const validFiles = filterValidFiles(dossierFiles);

      // CORRECTION: statut_history est dans raw (response.dossier), pas dans response directement
      const history = raw?.statut_history || raw?.historique || [];

      // DEBUG: Vérifier les données d'historique
      console.log('[DossierDetails] raw.statut_history:', raw?.statut_history);
      console.log('[DossierDetails] raw.historique:', raw?.historique);
      console.log('[DossierDetails] history utilisé:', history);
      console.log('[DossierDetails] Nombre total d\'entrées:', history.length);
      console.log('[DossierDetails] Entrées de type activity:', history.filter(h => h.type === 'activity').length);
      console.log('[DossierDetails] Entrées de type status_change:', history.filter(h => h.type === 'status_change').length);
      if (history.length > 0) {
        console.log('[DossierDetails] Premier élément:', history[0]);
        console.log('[DossierDetails] Dernier élément:', history[history.length - 1]);
      }

      // Batch tous les setState ensemble pour éviter multiples re-renders
      setDossier(prevDossier => {
        console.log('🔄 [DossierDetails] Mise à jour dossier:', {
          prev: prevDossier?.data_formulaire?.nombre_exemplaires,
          new: normalized.data_formulaire?.nombre_exemplaires
        });
        return normalized; // Retourner directement les données normalisées
      });
      setFiles(validFiles);
      setStatutHistory(history);
      setError('');
      setLoading(false);
      
      // 🔍 DEBUG: Vérifier les données après setDossier
      console.log('✅ [DossierDetails] État mis à jour avec:', {
        id: normalized.id,
        client: normalized.client,
        quantite: normalized.data_formulaire?.nombre_exemplaires,
        amount: normalized.amount,
        historique_count: history.length
      });
      
      // Notifier que le rechargement est terminé (pour réafficher le modal)
      window.dispatchEvent(new CustomEvent('dossierReloadComplete', { 
        detail: { dossierId: id } 
      }));

      if (process.env.NODE_ENV === 'development') {
        notificationService.debug && notificationService.debug('[DossierDetails] Chargement réussi:', {
          dossier: normalized?.numero_commande,
          files: validFiles.length,
          history: history.length
        });
      }
    } catch (err) {
      const status = err?.response?.status;
      let userMessage;
      if (status === 401) userMessage = 'Session expirée - Veuillez vous reconnecter';
      else if (status === 404) userMessage = "Ce dossier n'existe pas ou a été supprimé.";
      else if (status === 403) userMessage = "Vous n'avez pas les permissions pour consulter ce dossier.";
      else userMessage = err?.response?.data?.message || err?.message || 'Erreur lors du chargement des détails';

      if (process.env.NODE_ENV === 'development') {
        notificationService.debug && notificationService.debug('[DossierDetails] Erreur chargement:', err);
      }

      setError(userMessage);
      setDossier(null);
      setFiles([]);
      setStatutHistory([]);
      setLoading(false);
    }
  }, [effectiveId]);



  const loadFiles = useCallback(async () => {
    const id = effectiveId;
    if (!id) return;
    try {
      setLoadingFiles(true);
      const response = await filesService.getFiles(id);
      const list = response.files || response || [];

      // Filtrer les fichiers avec ID invalide
      const validFiles = filterValidFiles(list);

      setFiles(validFiles);
      setError('');
    } catch (err) {
      notificationService.error('Erreur lors du chargement des fichiers');
      setError('Erreur lors du chargement des fichiers');
    } finally {
      setLoadingFiles(false);
    }
  }, [effectiveId]);

  // handleValidateDossier removed (unused) – validation is covered via handleWorkflowAction/changeStatus

  // notify on success/error
  const notifySuccess = (msg) => {
    try {
      notificationService.success(msg);
    } catch (e) {
      // ignore notification failure in production
    }
  };

  const notifyError = (msg) => {
    try {
      notificationService.error(msg);
    } catch (e) {
      // ignore notification failure in production
    }
  };

  const handleReprintDossier = async comment => {
    if (!effectiveId) return;
    try {
      setChangingStatut(true);
      setError('');
      await dossiersService.reprintDossier(effectiveId, comment);
      await loadDossierDetails();
      if (onStatusChange) onStatusChange(effectiveId, dossier?.status, 'en_impression');
    } catch (err) {
      notificationService.error('Erreur lors de la remise en impression');
      setError(err?.error || err?.message || 'Erreur lors de la remise en impression');
    } finally {
      setChangingStatut(false);
    }
  };

  const handleStatusChange = async (newStatus, comment = null) => {
    if (!effectiveId) return;
    try {
      setChangingStatut(true);
      setError('');
      await dossiersService.changeStatus(effectiveId, newStatus, comment);
      await loadDossierDetails();
      if (onStatusChange) onStatusChange(effectiveId, dossier?.status, newStatus);
      setShowReviewModal(false);
      setReviewComment('');
      notifySuccess('Statut mis à jour');
    } catch (err) {
      notificationService.error('Erreur lors du changement de statut');
      setError(err?.error || err?.message || 'Erreur lors du changement de statut');
      notifyError('Erreur lors du changement de statut');
    } finally {
      setChangingStatut(false);
    }
  };

  const handleUnlockDossier = async () => {
    if (!effectiveId) return;
    try {
      setChangingStatut(true);
      setError('');
      await dossiersService.unlockDossier(effectiveId);
      await loadDossierDetails();
      notifySuccess('Dossier déverrouillé');
    } catch (err) {
      notificationService.error('Erreur lors du déverrouillage');
      setError(err?.error || err?.message || 'Erreur lors du déverrouillage');
      notifyError('Erreur lors du déverrouillage');
    } finally {
      setChangingStatut(false);
    }
  };

  const handleWorkflowAction = async action => {
    if (!action) return;

    // action with no nextStatus -> special cases (reprint, admin force transition)
    if (!action.nextStatus) {
      const label = (action.label || '').toLowerCase();

      // Remettre en impression / reprint
      if (label.includes('remettre') || label.includes('impression') || label.includes('reprint') || label.includes('imprimer')) {
        // open comment modal and remember pending action
        setPendingAction({ type: 'reprint' });
        setCommentModalValue('');
        setShowCommentModal(true);
        return;
      }

      // Admin: forcer transition vers un statut fourni
      if (user?.role === 'admin') {
        setPendingAction({ type: 'force' });
        setForceStatusValue('en_impression');
        setShowForceStatusModal(true);
        return;
      }

      // Fallback: ouvrir modal de révision si action inconnue
      setShowReviewModal(true);
      return;
    }

    // If nextStatus is provided, handle role-specific mapping
    let target = action.nextStatus;

    // Imprimeur: when marking as 'termine' we want to map to 'pret_livraison'
    if ((user?.role === 'imprimeur_roland' || user?.role === 'imprimeur_xerox') && target === 'termine') {
      target = 'pret_livraison';
    }

    if (target === 'a_revoir') {
      // open review modal to collect comment
      setPendingAction({ type: 'review' });
      setCommentModalValue('');
      setShowReviewModal(true);
      return;
    }

    // Intercepter "Marquer comme livré" pour afficher le modal de livraison avec montant
    if (target === 'livre') {
      // Pré-remplir le montant du dossier
      setDeliveryAmount(dossier?.montant_cfa || dossier?.amount || '');
      setShowDeliveryModal(true);
      return;
    }

    try {
      await handleStatusChange(target);
      notifySuccess('Statut modifié');
    } catch (err) {
      notifyError('Erreur lors du changement de statut');
    }
  };

  useEffect(() => {
    if (!isOpen) return; // Ne rien faire si modal fermée

    // Log détaillé pour debug
    try {
      notificationService.debug && notificationService.debug('[DossierDetails] Ouverture modal', {
        dossierId,
        effectiveId,
        folder_id: dossierProp?.folder_id,
        id: dossierProp?.id,
        dossierPropType: typeof dossierProp
      });
    } catch (e) { /* ignore */ }

    // Vérifications strictes de l'ID
    if (!effectiveId ||
      effectiveId === null ||
      effectiveId === undefined ||
      String(effectiveId).trim() === '' ||
      String(effectiveId).trim().toLowerCase() === 'null' ||
      String(effectiveId).trim().toLowerCase() === 'undefined') {
      const errMsg = `Identifiant du dossier manquant ou invalide (reçu: ${effectiveId})`;
      try {
        notificationService.debug && notificationService.debug('[DossierDetails] ERREUR ID invalide:', errMsg, { dossierId, dossierProp });
        notificationService.error && notificationService.error(errMsg);
      } catch (e) { /* ignore */ }
      setError(errMsg);
      setLoading(false);
      return;
    }

    try {
      notificationService.debug && notificationService.debug('[DossierDetails] ID valide, chargement...', effectiveId);
    } catch (e) { /* ignore */ }

    // Charger les données uniquement si l'ID est valide
    // Note: loadDossierDetails charge aussi les fichiers en interne
    loadDossierDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, effectiveId]);

  // Stocker les valeurs dans des refs pour éviter la réinstallation du listener
  const effectiveIdRef = useRef(effectiveId);
  const dossierIdRef = useRef(dossierId);
  const isOpenRef = useRef(isOpen);
  
  // Mettre à jour les refs à chaque render
  useEffect(() => {
    console.log('🔄 DossierDetails - Mise à jour des refs:', {
      effectiveId,
      dossierId,
      isOpen,
      refsBefore: {
        effectiveIdRef: effectiveIdRef.current,
        dossierIdRef: dossierIdRef.current,
        isOpenRef: isOpenRef.current
      }
    });
    effectiveIdRef.current = effectiveId;
    dossierIdRef.current = dossierId;
    isOpenRef.current = isOpen;
    console.log('✅ DossierDetails - Refs mises à jour:', {
      effectiveIdRef: effectiveIdRef.current,
      dossierIdRef: dossierIdRef.current,
      isOpenRef: isOpenRef.current
    });
  });

  // Ref pour loadDossierDetails aussi
  const loadDossierDetailsRef = useRef(loadDossierDetails);
  useEffect(() => {
    loadDossierDetailsRef.current = loadDossierDetails;
  });

  // ⚠️ DÉSACTIVÉ: Effet causant une boucle infinie
  // Le rechargement est déjà géré par l'événement dossierUpdated
  // useEffect(() => {
  //   if (!isEditModalOpen && dossier?._updateTimestamp) {
  //     console.log('🔄 DossierDetails - Modal fermé après mise à jour, rechargement...');
  //     const timeoutId = setTimeout(() => {
  //       loadDossierDetailsRef.current();
  //     }, 100);
  //     return () => clearTimeout(timeoutId);
  //   }
  // }, [isEditModalOpen, dossier?._updateTimestamp]);

  // Gestion des mises à jour du dossier depuis CreateDossier
  useEffect(() => {
    console.log('🎧 DossierDetails - Installation du listener dossierUpdated');
    
    const handleDossierUpdated = async (event) => {
      const updatedDossierId = event.detail?.dossierId;
      const updatedDossier = event.detail?.dossier;
      
      console.log('📨 DossierDetails - Événement dossierUpdated reçu:', {
        eventDossierId: updatedDossierId,
        currentId: effectiveId,
        hasUpdatedData: !!updatedDossier
      });
      
      // Vérifier si c'est notre dossier
      if (updatedDossierId && (updatedDossierId === effectiveId || updatedDossierId === dossierId)) {
        // Si on a les données mises à jour dans l'événement, les utiliser immédiatement
        if (updatedDossier) {
          console.log('✅ DossierDetails - Application des nouvelles données:', {
            quantite: updatedDossier.data_formulaire?.nombre_exemplaires,
            montant: updatedDossier.amount || updatedDossier.montant_cfa
          });
          
          const normalized = normalizeDossier(updatedDossier);
          // Appliquer la mise à jour et forcer la fermeture du modal
          setDossier(prev => {
            // Si les données sont différentes, forcer la fermeture du modal
            if (prev?.data_formulaire?.nombre_exemplaires !== normalized.data_formulaire?.nombre_exemplaires) {
              console.log('📊 DossierDetails - Changement détecté, fermeture du modal...', {
                prev: prev?.data_formulaire?.nombre_exemplaires,
                new: normalized.data_formulaire?.nombre_exemplaires
              });
            }

            return {
              ...normalized,
              data_formulaire: {
                ...normalized.data_formulaire,
                nombre_exemplaires: String(normalized.data_formulaire?.nombre_exemplaires || 0)
              }
            };
          });
        }
        
        // Fermer le modal d'édition immédiatement via l'événement (sera traité par le listener)
        console.log('🚪 DossierDetails - Dispatch événement fermeture modal');
        window.dispatchEvent(new CustomEvent('closeDossierEditor'));
        
        // Dans tous les cas, planifier un rechargement complet pour synchroniser
        const delayMs = 250; // Délai uniforme plus court
        console.log(`🔄 DossierDetails - Rechargement planifié dans ${delayMs}ms...`);
        
        const timeoutId = setTimeout(() => {
          // Le modal devrait être fermé maintenant grâce à l'événement
          console.log('⏰ DossierDetails - Rechargement complet du dossier:', updatedDossierId);
          loadDossierDetailsRef.current();
        }, delayMs);
      }
      
      // Nettoyer le timeout si le composant est démonté
      return () => clearTimeout(timeoutId);
    };
    
    window.addEventListener('dossierUpdated', handleDossierUpdated);
    return () => window.removeEventListener('dossierUpdated', handleDossierUpdated);
  }, [effectiveId, dossierId]); // ✅ Utiliser loadDossierDetailsRef.current au lieu de loadDossierDetails
  
  // Écouter l'événement de rechargement
  useEffect(() => {
    const handleReload = (event) => {
      const reloadDossierId = event.detail?.dossierId;
      console.log('🔄 DossierDetails - Demande de rechargement pour dossier:', reloadDossierId, {
        effectiveId,
        dossierId,
        match: effectiveId === reloadDossierId || dossierId === reloadDossierId
      });
      
      // Recharger si l'ID correspond à effectiveId OU dossierId
      if (reloadDossierId && (effectiveId === reloadDossierId || dossierId === reloadDossierId)) {
        console.log('✅ DossierDetails - ID correspond, rechargement...');
        loadDossierDetailsRef.current();
      } else {
        console.log('❌ DossierDetails - ID ne correspond pas, pas de rechargement');
      }
    };
    
    window.addEventListener('reloadDossierDetails', handleReload);
    return () => window.removeEventListener('reloadDossierDetails', handleReload);
  }, [effectiveId, dossierId]); // ✅ Utiliser loadDossierDetailsRef.current
  
  // Écouter l'ouverture/fermeture du modal d'édition CreateDossier
  useEffect(() => {
    const handleEditDossier = (event) => {
      // Un dossier va être édité - masquer temporairement ce modal
      console.log('🎭 DossierDetails - Modal d\'édition ouvert, masquage temporaire');
      setIsEditModalOpen(true);
    };
    
    const handleCloseDossierEditor = () => {
      // Fermeture du modal d'édition demandée
      console.log('🎭 DossierDetails - Fermeture du modal d\'édition');
      setIsEditModalOpen(false);
    };
    
    const handleReloadComplete = () => {
      // Le rechargement est terminé - réafficher ce modal
      console.log('🎭 DossierDetails - Rechargement terminé, réaffichage du modal');
      setIsEditModalOpen(false);
    };
    
    window.addEventListener('editDossier', handleEditDossier);
    window.addEventListener('closeDossierEditor', handleCloseDossierEditor);
    window.addEventListener('dossierReloadComplete', handleReloadComplete);
    
    return () => {
      window.removeEventListener('editDossier', handleEditDossier);
      window.removeEventListener('closeDossierEditor', handleCloseDossierEditor);
      window.removeEventListener('dossierReloadComplete', handleReloadComplete);
    };
  }, []);

  const handleFileUpload = async selected => {
    try {
      setUploadingFiles(true);
      setUploadProgress(0);
      await uploadFilesAuto(effectiveId, selected, (progress) => {
        setUploadProgress(progress);
      });
      
      // On recharge uniquement les fichiers pour une mise à jour rapide avec les nouvelles pièces jointes
      setTimeout(async () => {
        await loadFiles(); 
        setUploadProgress(0);
      }, 500); // Délai réduit, backend gère le fichier plus vite
      
      setShowUpload(false);
    } catch (err) {
      notificationService.error("Erreur lors de l'upload des fichiers");
      setError(err?.error || "Erreur lors de l'upload des fichiers");
    } finally {
      setUploadingFiles(false);
    }
  };

  // Gestion du drag & drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!canUploadFiles() || uploadingFiles) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const filesArray = Array.from(droppedFiles);
      await handleFileUpload(filesArray);
    }
  };

  const canUploadFiles = () => {
    if (!dossier || !user) return false;

    // Seuls admin et préparateur peuvent uploader des fichiers
    if (user.role === 'admin') return true;

    if (user.role === 'preparateur') {
      const isOwner = dossier.created_by === user.id || dossier.createdById === user.id;
      if (!isOwner) return false;
      const allowedStatusesBase = ['en_cours', 'a_revoir'];
      if (dossier.valide_preparateur || dossier.validated) {
        return dossier.status === 'a_revoir';
      } else {
        return allowedStatusesBase.includes(dossier.status);
      }
    }

    // Imprimeurs et livreurs ne peuvent PAS uploader de fichiers
    return false;
  };

  // Gestion fine de l'état du modal
  const shouldShowModal = isOpen && (!isEditModalOpen || loading);
  console.log('🎭 [DossierDetails] État modal:', { isOpen, isEditModalOpen, loading, shouldShow: shouldShowModal });

  if (!shouldShowModal) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
          <div className="fixed inset-0 bg-neutral-500 bg-opacity-75"></div>
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-center mt-4 text-neutral-600">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dossier || error) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
          <button
            type="button"
            aria-label="Fermer la fenêtre"
            className="fixed inset-0 bg-neutral-500 bg-opacity-75 cursor-pointer"
            onClick={onClose}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg p-8">
            <div className="text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-danger-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">{error}</h3>
              <button onClick={onClose} className="btn-primary mt-4">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // renderTabContent removed: sections are rendered via renderTabContentSection in single-page mode

  // ✅ Helper pour badges inline compacts (style image de référence)
  const renderCompactBadge = (label, value, colorClass = 'violet') => {
    const colors = {
      violet: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white',
      cyan: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white',
      green: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white',
      orange: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white',
      rose: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white',
      gray: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white',
    };

    if (!value || value === '' || value === 'undefined' || value === 'null') return null;

    return (
      <div className="flex items-center justify-between py-2.5 px-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider ${colors[colorClass] || colors.violet} shadow-sm`}>
          {label}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</span>
      </div>
    );
  };

  // Helper pour rendre chaque section en page unique
  const renderTabContentSection = (sectionId) => {
    switch (sectionId) {
      case 'technical': {
        const formData = dossier.data_formulaire || {};
        const machineType = (dossier.type_formulaire || dossier.machine || '').toLowerCase();
        const isRoland = machineType.includes('roland');
        const isXerox = machineType.includes('xerox') || (!isRoland && formData.type_document);

        // Fonction helper pour formater le mode d'impression
        const formatModeImpression = (mode) => {
          const modes = {
            'recto_simple': 'Recto simple',
            'recto_verso': 'Recto-verso',
            'recto': 'Recto simple',
            'verso': 'Verso'
          };
          return modes[mode] || mode;
        };

        // Fonction helper pour formater la couleur
        const formatCouleur = (couleur) => {
          const couleurs = {
            'couleur': 'Couleur',
            'noir_et_blanc': 'Noir & Blanc',
            'nb': 'Noir & Blanc'
          };
          return couleurs[couleur] || couleur;
        };

        return (
          <div className="space-y-4">
            {/* ========== FORMULAIRE XEROX - Format A4 Organisé ========== */}
            {isXerox && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* En-tête Machine */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Impression Numérique Xerox
                    </h3>
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold">
                      Document
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Section 1: Informations Document */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-100 dark:border-blue-900">
                      <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                        Document
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {formData.type_document && (
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-3 border border-violet-200 dark:border-violet-800">
                          <div className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase mb-1">Type</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formData.type_document === 'Autre' ? (formData.type_document_autre || 'Autre') : formData.type_document}
                          </div>
                        </div>
                      )}
                      {(formData.format || formData.format_personnalise) && (
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-3 border border-violet-200 dark:border-violet-800">
                          <div className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase mb-1">Format</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formData.format === 'Personnalisé' ? (formData.format_personnalise || 'Personnalisé') : (formData.format || formData.format_personnalise)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 2: Paramètres Impression */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-cyan-100 dark:border-cyan-900">
                      <div className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full"></div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                        Impression
                      </h4>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {formData.mode_impression && (
                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800">
                          <div className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase mb-1">Mode</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatModeImpression(formData.mode_impression)}</div>
                        </div>
                      )}
                      {formData.couleur_impression && (
                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800">
                          <div className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase mb-1">Couleur</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCouleur(formData.couleur_impression)}</div>
                        </div>
                      )}
                      {formData.nombre_exemplaires && (
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Quantité</div>
                          <div className="text-base font-black text-gray-900 dark:text-gray-100">{formData.nombre_exemplaires} ex.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 3: Support Papier */}
                  {(formData.grammage || formData.grammage_autre) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-orange-100 dark:border-orange-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-orange-500 to-amber-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Papier
                        </h4>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">Grammage</div>
                            <div className="text-lg font-black text-gray-900 dark:text-gray-100">
                              {formData.grammage === 'Autre' ? (formData.grammage_autre || 'Autre') : (formData.grammage || formData.grammage_autre)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 4: Finitions */}
                  {Array.isArray(formData.finition) && formData.finition.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-pink-100 dark:border-pink-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-pink-500 to-rose-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Finitions
                        </h4>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {formData.finition.map((fin, idx) => (
                          <div key={idx} className="group relative bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 rounded-lg px-4 py-2 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5">
                            <span className="text-white text-sm font-bold">{fin}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 5: Façonnage */}
                  {Array.isArray(formData.faconnage) && formData.faconnage.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-100 dark:border-purple-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Façonnage
                        </h4>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {formData.faconnage.map((fac, idx) => (
                          <div key={idx} className="group relative bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-lg px-4 py-2 shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5">
                            <span className="text-white text-sm font-bold">{fac}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 6: SECTIONS ADDITIONNELLES (Couverture, Intérieur, etc.) */}
                  {(() => {
                    // ⚠️ IMPORTANT: Les sections additionnelles sont DIFFÉRENTES du formulaire principal
                    // Le backend peut avoir converti automatiquement le formulaire principal en sections[0]
                    // lors de la migration. Il faut IGNORER cette conversion et afficher uniquement
                    // les VRAIES sections additionnelles créées via le bouton "+"
                    
                    // Si sections.length <= 1, c'est probablement juste la conversion du formulaire principal
                    // Les VRAIES sections additionnelles commencent à partir de sections[1] ou quand length >= 2
                    if (!dossier.sections || !Array.isArray(dossier.sections) || dossier.sections.length <= 1) {
                      return null; // Pas de sections additionnelles réelles
                    }
                    
                    // Si on a 2+ sections, alors sections[1], sections[2], etc. sont les vraies sections additionnelles
                    // On ignore sections[0] car c'est le formulaire principal converti
                    const validSections = dossier.sections
                      .slice(1) // Ignorer la première section (formulaire principal converti)
                      .filter(section => {
                        if (!section) return false;
                        
                        // Vérifier que c'est une vraie section additionnelle avec des données
                        const hasType = section.type;
                        const hasMode = section.mode || section.mode_impression;
                        const hasCopies = section.copies && section.copies > 0;
                        const hasPaperTypes = section.paper_types && Array.isArray(section.paper_types) && section.paper_types.length > 0;
                        
                        // Une section DOIT avoir au minimum un type ET un mode
                        return hasType && (hasMode || hasPaperTypes);
                      });
                    
                    // Ne rien afficher s'il n'y a pas de vraies sections additionnelles
                    if (validSections.length === 0) return null;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-100 dark:border-blue-900">
                          <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                            Sections du document ({validSections.length})
                          </h4>
                        </div>

                        {validSections.map((section, sectionIdx) => (
                        <div key={sectionIdx} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
                          {/* En-tête de section */}
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200 dark:border-blue-700">
                            <h5 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                              Section {sectionIdx + 1}: {section.type || 'Intérieur'}
                            </h5>
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                              {section.copies || 1} ex.
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {/* Mode d'impression */}
                            <div>
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Mode:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">
                                {section.mode_impression === 'recto_verso' ? 'Recto-verso' : 'Recto simple'}
                              </span>
                            </div>

                            {/* Nombre d'exemplaires */}
                            <div>
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Exemplaires:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">{section.copies || 1}</span>
                            </div>
                          </div>

                          {/* Types de papier */}
                          {section.paper_types && Array.isArray(section.paper_types) && section.paper_types.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">Papiers:</div>
                              <div className="space-y-2">
                                {section.paper_types.map((paper, paperIdx) => (
                                  <div key={paperIdx} className="bg-white dark:bg-gray-800 rounded p-2 border border-blue-200 dark:border-blue-700 flex items-center justify-between text-xs">
                                    <span className="text-gray-900 dark:text-gray-100">
                                      <span className="font-bold">{paper.format || 'A4'}</span>
                                      {' • '}
                                      <span>{paper.couleur === 'couleur' ? 'Couleur' : 'N&B'}</span>
                                      {paper.grammage && ` • ${paper.grammage}`}
                                    </span>
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">{paper.pages || 1} pages</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Finitions */}
                          {section.finitions && Array.isArray(section.finitions) && section.finitions.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">Finitions:</div>
                              <div className="flex flex-wrap gap-1">
                                {section.finitions.map((fin, finIdx) => (
                                  <span key={finIdx} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                                    {fin}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Façonnage */}
                          {section.faconnage && Array.isArray(section.faconnage) && section.faconnage.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">Façonnage:</div>
                              <div className="flex flex-wrap gap-1">
                                {section.faconnage.map((fac, facIdx) => (
                                  <span key={facIdx} className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                                    {fac}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Section 7: OPTIONS AVANCÉES (Numérotation, Conditionnement, Description) */}
                  {(formData.numerotation || (Array.isArray(formData.conditionnement) && formData.conditionnement.length > 0) || dossier.description) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-indigo-100 dark:border-indigo-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-blue-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Options Avancées
                        </h4>
                      </div>

                      {/* Numérotation */}
                      {formData.numerotation && (
                        <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-3">Numérotation</div>
                          <div className="grid grid-cols-2 gap-4">
                            {formData.debut_numerotation && (
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Début</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formData.debut_numerotation}</div>
                              </div>
                            )}
                            {formData.nombre_chiffres && (
                              <div>
                                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Nombre de chiffres</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formData.nombre_chiffres}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conditionnement */}
                      {Array.isArray(formData.conditionnement) && formData.conditionnement.length > 0 && (
                        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-teal-200 dark:border-teal-800">
                          <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase mb-3">Conditionnement</div>
                          <div className="flex flex-wrap gap-2">
                            {formData.conditionnement.map((cond, idx) => (
                              <div key={idx} className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-lg px-3 py-1.5 shadow-sm">
                                <span className="text-white text-xs font-bold">{cond}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Description du travail */}
                      {dossier.description && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-2">Description du travail</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{dossier.description}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== FORMULAIRE ROLAND - Format A4 Organisé ========== */}
            {isRoland && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* En-tête Machine */}
                <div className="bg-gradient-to-r from-red-600 to-pink-600 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Impression Grand Format Roland
                    </h3>
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold">
                      Grand Format
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Section 1: Support */}
                  {(formData.type_support || formData.type_support_autre) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-violet-100 dark:border-violet-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Support
                        </h4>
                      </div>

                      <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-violet-200 dark:border-violet-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-1">Type de support</div>
                            <div className="text-lg font-black text-gray-900 dark:text-gray-100">
                              {formData.type_support === 'Autre' ? (formData.type_support_autre || 'Autre') : (formData.type_support || formData.type_support_autre)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 2: Dimensions */}
                  {(formData.largeur || formData.hauteur) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-cyan-100 dark:border-cyan-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Dimensions
                        </h4>
                      </div>

                      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-5 border-2 border-cyan-200 dark:border-cyan-800">
                        <div className="flex items-center justify-center gap-6">
                          <div className="text-center">
                            <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase mb-2">Largeur</div>
                            <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{formData.largeur || '?'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.unite || 'cm'}</div>
                          </div>

                          <div className="text-4xl font-bold text-gray-300 dark:text-gray-600">×</div>

                          <div className="text-center">
                            <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase mb-2">Hauteur</div>
                            <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400">{formData.hauteur || '?'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.unite || 'cm'}</div>
                          </div>
                        </div>

                        {/* Surface calculée */}
                        {formData.largeur && formData.hauteur && (
                          <div className="mt-4 pt-4 border-t-2 border-cyan-200 dark:border-cyan-700 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Surface totale:</span>
                              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                {((parseFloat(formData.largeur) * parseFloat(formData.hauteur)) / (formData.unite === 'cm' ? 10000 : 1)).toFixed(2)} m²
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section 3: Quantité */}
                  {formData.nombre_exemplaires && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-100 dark:border-emerald-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-green-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Production
                        </h4>
                      </div>

                      <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Quantité</div>
                            <div className="text-2xl font-black text-gray-900 dark:text-gray-100">{formData.nombre_exemplaires} ex.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 4: Finitions Roland (avec Description du travail) */}
                  {(formData.finition_oeillets || formData.finition_position || dossier.description) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-rose-100 dark:border-rose-900">
                        <div className="w-1 h-5 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                          Finitions
                        </h4>
                      </div>

                      {/* Oeillets et Position */}
                      {(formData.finition_oeillets || formData.finition_position) && (
                        <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-rose-200 dark:border-rose-800">
                          <div className="grid grid-cols-2 gap-4">
                            {formData.finition_oeillets && (
                              <div>
                                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">Oeillets</div>
                                <div className="text-base font-bold text-gray-900 dark:text-gray-100">{formData.finition_oeillets}</div>
                              </div>
                            )}
                            {formData.finition_position && (
                              <div>
                                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">Position</div>
                                <div className="text-base font-bold text-gray-900 dark:text-gray-100">{formData.finition_position}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Description du travail */}
                      {dossier.description && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase mb-2">Description du travail</div>
                          <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{dossier.description}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 5: SUPPORTS ADDITIONNELS (Bâche, Vinyle, etc.) */}
                  {(() => {
                    // ⚠️ IMPORTANT: Les supports additionnels sont DIFFÉRENTS du formulaire principal
                    // Le backend peut avoir converti automatiquement le formulaire principal en supports[0]
                    // lors de la migration. Il faut IGNORER cette conversion et afficher uniquement
                    // les VRAIS supports additionnels créés via le bouton "+"
                    
                    // Si supports.length <= 1, c'est probablement juste la conversion du formulaire principal
                    // Les VRAIS supports additionnels commencent à partir de supports[1] ou quand length >= 2
                    if (!dossier.supports || !Array.isArray(dossier.supports) || dossier.supports.length <= 1) {
                      return null; // Pas de supports additionnels réels
                    }
                    
                    // Si on a 2+ supports, alors supports[1], supports[2], etc. sont les vrais supports additionnels
                    // On ignore supports[0] car c'est le formulaire principal converti
                    const validSupports = dossier.supports
                      .slice(1) // Ignorer le premier support (formulaire principal converti)
                      .filter(support => {
                        if (!support) return false;
                        
                        // Vérifier que c'est un vrai support additionnel avec des données
                        const hasType = support.type_support || support.type_support_autre;
                        const hasDimensions = support.largeur && support.hauteur;
                        
                        // Un support DOIT avoir au minimum un type ET des dimensions
                        return hasType && hasDimensions;
                      });
                    
                    // Ne rien afficher s'il n'y a pas de vrais supports additionnels
                    if (validSupports.length === 0) return null;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b-2 border-green-100 dark:border-green-900">
                          <div className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
                          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                            Supports additionnels ({validSupports.length})
                          </h4>
                        </div>

                        {validSupports.map((support, supportIdx) => (
                        <div key={supportIdx} className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border-2 border-green-200 dark:border-green-700">
                          {/* En-tête de support */}
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-green-200 dark:border-green-700">
                            <h5 className="text-sm font-bold text-green-900 dark:text-green-300">
                              Support {supportIdx + 1}: {support.type_support === 'Autre' ? (support.type_support_autre || 'Autre') : (support.type_support || support.type_support_autre || 'Bâche')}
                            </h5>
                            <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                              {support.nombre_exemplaires || support.exemplaires || 1} ex.
                            </span>
                          </div>

                          {/* Dimensions */}
                          {(support.largeur || support.hauteur) && (
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div>
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">Largeur:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100 font-bold">
                                  {support.largeur} {support.unite || 'cm'}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">Hauteur:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100 font-bold">
                                  {support.hauteur} {support.unite || 'cm'}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">Surface:</span>
                                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                  {((parseFloat(support.largeur) * parseFloat(support.hauteur)) / (support.unite === 'cm' ? 10000 : 1)).toFixed(2)} m²
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Finitions */}
                          {(support.finition_oeillets || support.finition_position) && (
                            <div className="mt-3 bg-white dark:bg-gray-800 rounded p-2 border border-green-200 dark:border-green-700">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {support.finition_oeillets && (
                                  <div>
                                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Oeillets:</span>
                                    <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">{support.finition_oeillets}</span>
                                  </div>
                                )}
                                {support.finition_position && (
                                  <div>
                                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Position:</span>
                                    <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">{support.finition_position}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Message si aucune donnée */}
            {!formData.type_document && !formData.format && !formData.type_support && Object.keys(formData).length === 0 && (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                <svg className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-base font-semibold text-gray-600 dark:text-gray-400">Aucune donnée technique disponible</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Les détails du formulaire n'ont pas été enregistrés</p>
              </div>
            )}
          </div>
        );
      }

      case 'files':
        return (
          <div>
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-emerald-500 border-t-transparent"></div>
                <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Chargement...</span>
              </div>
            ) : files.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {files
                  .filter(file => {
                    if (!file || !file.id) return false;
                    const strId = String(file.id).trim();
                    if (strId === '' || strId === 'null' || strId === 'undefined') return false;
                    return true;
                  })
                  .map(file => {
                    const fileType = file.type_mime || file.mimetype || file.type || '';
                    const fileName = file.nom_original || file.original_filename || file.nom || '';
                    const isImage = fileType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                    const isPdf = fileType.includes('pdf') || fileName.match(/\.pdf$/i);
                    const isDoc = fileName.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i);
                    const canPreview = isImage || isPdf;

                    return (
                      <div
                        key={file.id}
                        className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all duration-200 overflow-hidden"
                      >
                        {/* Miniature grande - 160px de hauteur */}
                        <div
                          className={`relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 overflow-hidden flex items-center justify-center ${canPreview ? 'cursor-pointer' : ''}`}
                          onClick={() => { if (canPreview) { setSelectedFile(file); setShowFileViewer(true); } }}
                        >
                          {/* Badge type */}
                          <div className="absolute top-2 right-2 z-10">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold shadow-lg ${isImage ? 'bg-pink-500 text-white' :
                              isPdf ? 'bg-red-500 text-white' :
                                isDoc ? 'bg-blue-500 text-white' :
                                  'bg-gray-500 text-white'
                              }`}>
                              {isImage ? (
                                <>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                  </svg>
                                  IMG
                                </>
                              ) : isPdf ? (
                                <>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                  </svg>
                                  PDF
                                </>
                              ) : isDoc ? (
                                <>
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                                  </svg>
                                  DOC
                                </>
                              ) : 'FILE'}
                            </span>
                          </div>

                          {/* Contenu miniature */}
                          {isImage ? (
                            <div className="relative w-full h-full">
                              <FileThumbnailImage file={file} />
                              {/* Overlay au survol */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                                <EyeIcon className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                              </div>
                            </div>
                          ) : isPdf ? (
                            <div className="relative w-full h-full">
                              <FileThumbnailPDF file={file} />
                              {/* Overlay au survol */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                                <EyeIcon className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                              </div>
                            </div>
                          ) : isDoc ? (
                            <div className="text-center p-4">
                              <svg className="w-20 h-20 mx-auto text-blue-400 dark:text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                              </svg>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Document</p>
                            </div>
                          ) : (
                            <div className="text-center p-4">
                              <DocumentIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600" />
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Fichier</p>
                            </div>
                          )}

                          {/* Overlay survol pour preview */}
                          {canPreview && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>

                        {/* Informations et actions */}
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                          {/* Nom du fichier */}
                          <h4
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mb-2"
                            title={fileName}
                          >
                            {fileName}
                          </h4>

                          {/* Métadonnées */}
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                            {file.taille && (
                              <span>{(file.taille / 1024).toFixed(1)} Ko</span>
                            )}
                            {file.created_at && (
                              <span>
                                {new Date(file.created_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </span>
                            )}
                          </div>

                          {/* Boutons d'action */}
                          <div className="flex gap-2">
                            {canPreview && (
                              <button
                                onClick={() => { setSelectedFile(file); setShowFileViewer(true); }}
                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs font-medium transition-colors"
                                title="Aperçu"
                              >
                                <EyeIcon className="h-4 w-4" />
                                Aperçu
                              </button>
                            )}

                            <button
                              onClick={() => filesService.downloadFile(file.id)}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-medium transition-colors"
                              title="Télécharger"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              {canPreview ? '' : 'Télécharger'}
                            </button>

                            {user?.role === 'admin' && (
                              <button
                                onClick={() => { setFileToDelete(file); setShowDeleteConfirm(true); }}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                                title="Supprimer"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aucun fichier</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {canUploadFiles() ? 'Cliquez sur "Ajouter" ou glissez-déposez vos fichiers' : 'Aucun fichier joint à ce dossier'}
                </p>
              </div>
            )}
          </div>
        );

      case 'followup':
        return (
          <div>
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Statut actuel</label>
              <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(dossier.status)}
                {/* Badge paiement visible uniquement après livraison */}
                {dossier.status === 'livre' && getPaymentStatusBadge(dossier)}
                {dossier.updated_at && (<span className="text-sm text-neutral-500">Mis à jour le {formatDateTime(dossier.updated_at)}</span>)}
              </div>
            </div>

            {/* Boutons d'action compacts - Masqués pour livreurs */}
            {(() => {
              console.log('🚫 DEBUG Condition livreur:', { 
                userRole: user?.role, 
                isNotLivreur: user?.role !== 'livreur',
                willShowActions: user?.role !== 'livreur'
              });
              return user?.role !== 'livreur';
            })() && (
              <div className="mb-4 flex flex-wrap gap-2">
                {getAvailableActions(user?.role, dossier?.status, dossier).map((action, i) => {
                  const actionConfig = {
                    'Valider': { gradient: 'from-emerald-500 to-green-600', icon: '✓', ring: 'ring-emerald-400/30' },
                    'Revalider': { gradient: 'from-blue-500 to-indigo-600', icon: '✓✓', ring: 'ring-blue-400/30' },
                    'Renvoyer à revoir': { gradient: 'from-red-500 to-pink-600', icon: '⚠️', ring: 'ring-red-400/30' },
                    'Marquer à revoir': { gradient: 'from-orange-500 to-red-600', icon: '⚠️', ring: 'ring-orange-400/30' },
                    'Démarrer impression': { gradient: 'from-purple-500 to-indigo-600', icon: '🖨️', ring: 'ring-purple-400/30' },
                    'Terminer impression': { gradient: 'from-cyan-500 to-blue-600', icon: '✓', ring: 'ring-cyan-400/30' },
                    'Programmer livraison': { gradient: 'from-blue-600 to-indigo-700', icon: '🚚', ring: 'ring-blue-500/30' },
                    'Marquer comme livré': { gradient: 'from-green-600 to-emerald-700', icon: '✅', ring: 'ring-green-500/30' },
                    'Remettre en impression': { gradient: 'from-amber-500 to-orange-600', icon: '🔄', ring: 'ring-amber-400/30' },
                  };
                  const config = actionConfig[action.label] || { gradient: 'from-gray-500 to-gray-600', icon: '→', ring: 'ring-gray-400/30' };

                  return (
                    <button
                      key={i}
                      onClick={() => handleWorkflowAction(action)}
                      disabled={changingStatut}
                      title={action.label}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${config.gradient} text-white font-semibold text-xs rounded-lg shadow hover:shadow-md ring-1 ${config.ring} transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                    >
                      <span className="text-sm">{config.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  );
                })}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleUnlockDossier()}
                    disabled={changingStatut}
                    title="Déverrouiller le dossier (Admin)"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-semibold text-xs rounded-lg shadow hover:shadow-md ring-1 ring-gray-600/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Déverrouiller
                  </button>
                )}

                {/* Bouton Modifier le dossier - RÉSERVÉ ADMIN UNIQUEMENT */}
                {(() => {
                  const canEdit = () => {
                    console.log('🔍 DEBUG Bouton Modifier:', { 
                      userRole: user?.role, 
                      userId: user?.id, 
                      dossierCreatedBy: dossier.created_by,
                      dossierStatus: dossier.status 
                    });
                    // ⚠️ UNIQUEMENT L'ADMIN peut modifier
                    if (user?.role === 'admin') return true;
                    
                    // Tous les autres rôles ne peuvent PAS modifier
                    return false;
                  };

                  const canEditResult = canEdit();
                  console.log('✅ canEdit() result:', canEditResult);
                  if (!canEditResult) return null;

                  return (
                    <button
                      onClick={() => {
                        console.log('📝 Ouverture du mode édition pour le dossier:', dossier);
                        
                        // Préparer les données complètes pour l'édition
                        const dossierForEdit = {
                          ...dossier,
                          id: dossier.id || dossier.folder_id || dossier.dossier_id,
                          // S'assurer que les données du formulaire sont incluses
                          form_data: dossier.data_formulaire || dossier.form_data || {},
                          // Informations client
                          client: dossier.nom_client || dossier.client_nom || dossier.client || '',
                          telephone_client: dossier.telephone_client || '',
                          description: dossier.description_travail || dossier.description || '',
                          urgent: dossier.urgence || dossier.urgent || false,
                          // Informations techniques
                          type: dossier.type_formulaire || dossier.machine || dossier.type || '',
                          // Sections et supports (si présents)
                          sections: dossier.sections || [],
                          supports: dossier.supports || [],
                          amount: dossier.montant_cfa || dossier.amount || null,
                        };

                        console.log('📤 Données préparées pour édition:', dossierForEdit);
                        
                        // NE PAS fermer le modal de détails - il doit rester ouvert pour se recharger après modification
                        // onClose(); ❌ SUPPRIMÉ - causait la perte de l'état
                        
                        // Déclencher l'événement pour ouvrir CreateDossier en mode édition
                        window.dispatchEvent(new CustomEvent('editDossier', { 
                          detail: dossierForEdit 
                        }));
                      }}
                      title="Modifier les informations du dossier"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm rounded-lg shadow-lg hover:shadow-xl ring-2 ring-blue-500/30 transition-all duration-200 hover:scale-105 hover:from-blue-700 hover:to-indigo-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      ✏️ Modifier le dossier
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Timeline de progression améliorée */}
            <div className="mt-8 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h4 className="text-lg font-extrabold text-gray-900">Progression du dossier</h4>
              </div>

              <div className="relative space-y-2">
                {/* Ligne verticale de progression */}
                <div className="absolute left-5 top-8 bottom-8 w-1 bg-gradient-to-b from-blue-300 via-indigo-300 to-gray-200"></div>

                {[
                  { status: 'nouveau', label: 'Nouveau', icon: '🆕', color: 'blue' },
                  { status: 'en_cours', label: 'En préparation', icon: '⚙️', color: 'yellow' },
                  { status: 'pret_impression', label: 'Prêt impression', icon: '✓', color: 'purple' },
                  { status: 'en_impression', label: 'En impression', icon: '🖨️', color: 'orange' },
                  { status: 'imprime', label: 'Imprimé', icon: '📋', color: 'emerald' },
                  { status: 'pret_livraison', label: 'Prêt livraison', icon: '📦', color: 'cyan' },
                  { status: 'en_livraison', label: 'En livraison', icon: '🚚', color: 'indigo' },
                  { status: 'livre', label: 'Livré', icon: '✅', color: 'green' }
                ].map((stage, index, arr) => {
                  const isComplete = statutHistory.some(h => h.nouveau_statut === stage.status || h.statut === stage.status);
                  const isCurrent = dossier.status === stage.status;
                  const completedDate = statutHistory.find(h => h.nouveau_statut === stage.status || h.statut === stage.status)?.created_at;

                  return (
                    <div key={stage.status} className="relative flex items-center gap-4 py-3">
                      {/* Icône de statut */}
                      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg transform transition-all duration-300 ${isCurrent
                        ? `bg-gradient-to-r from-${stage.color}-500 to-${stage.color}-600 text-white ring-4 ring-${stage.color}-200 scale-110 animate-pulse`
                        : isComplete
                          ? `bg-gradient-to-r from-${stage.color}-500 to-${stage.color}-600 text-white`
                          : 'bg-gray-200 text-gray-400'
                        }`}>
                        <span className="text-lg">{isComplete ? '✓' : stage.icon}</span>
                      </div>

                      {/* Informations du statut */}
                      <div className={`flex-1 bg-white rounded-xl p-4 shadow-md transition-all duration-300 ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                        }`}>
                        <div className="flex items-center justify-between">
                          <p className={`font-bold text-sm ${isCurrent ? 'text-blue-600' : isComplete ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                            {stage.label}
                            {isCurrent && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                                En cours
                              </span>
                            )}
                          </p>
                          {completedDate && (
                            <span className="text-xs text-gray-500">
                              {formatDateTime(completedDate)}
                            </span>
                          )}
                        </div>

                        {/* Barre de progression pour l'étape courante */}
                        {isCurrent && (
                          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Indicateur de progression global */}
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Progression globale</span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {Math.round((statutHistory.length / 8) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min((statutHistory.length / 8) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'history': {
        const sortedHistory = [...statutHistory].sort((a, b) => {
          const dateA = new Date(a.changed_at || a.created_at || a.date_changement || 0);
          const dateB = new Date(b.changed_at || b.created_at || b.date_changement || 0);
          return dateB - dateA;
        });

        // Fonction pour formater une date de manière sécurisée
        const formatDateSafe = (dateValue) => {
          console.log('[DossierDetails] formatDateSafe appelé avec:', dateValue);

          if (!dateValue) return { date: '—', time: '—' };

          try {
            const dateObj = new Date(dateValue);
            if (isNaN(dateObj.getTime())) return { date: '—', time: '—' };

            const result = {
              date: dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
              time: dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            };

            console.log('[DossierDetails] formatDateSafe résultat:', result);
            return result;
          } catch (error) {
            console.error('[DossierDetails] formatDateSafe erreur:', error);
            return { date: '—', time: '—' };
          }
        };

        return (
          <div className="relative">
            {sortedHistory.length > 0 ? (
              <div className="space-y-2">
                {sortedHistory
                  .filter((entry) => {
                    // 🔐 FILTRAGE PAR RÔLE: Les modifications (type=activity) sont réservées aux admins
                    if (entry.type === 'activity') {
                      // Si pas admin, masquer toutes les modifications
                      if (user?.role !== 'admin') {
                        return false;
                      }
                      // Si admin, vérifier s'il y a de vrais changements
                      if (entry.details) {
                        const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
                        const hasRealChanges = Object.entries(details).some(([_, change]) => 
                          change && typeof change === 'object' && 'old' in change && 'new' in change && change.old !== change.new
                        );
                        return hasRealChanges;
                      }
                      return false;
                    }
                    
                    // ✅ Pour les changements de statut, afficher pour TOUS les rôles
                    if (entry.type === 'status_change') {
                      const newStat = entry.nouveau_statut || entry.new_status || entry.statut;
                      const oldStat = entry.ancien_statut || entry.old_status;
                      // Afficher si: pas d'ancien statut OU statuts différents OU commentaire présent
                      return !oldStat || oldStat !== newStat || entry.commentaire || entry.comment;
                    }
                    
                    // Fallback pour les anciennes entrées sans type (visible pour tous)
                    return true;
                  })
                  .map((entry, index) => {

                    const isActivity = entry.type === 'activity';
                    const status = entry.nouveau_statut || entry.new_status || entry.statut;
                    const oldStatus = entry.ancien_statut || entry.old_status;
                    const author = entry.user_name || entry.changed_by_name || entry.utilisateur || entry.user || (entry.user_id ? `Utilisateur #${entry.user_id}` : 'Système');
                    const date = entry.changed_at || entry.created_at || entry.date_changement;
                    
                    // Pour les modifications, construire un commentaire à partir des détails
                    let comment = entry.commentaire || entry.comment;
                    if (isActivity && entry.details) {
                      const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
                      const changesList = [];
                      
                      Object.entries(details).forEach(([field, change]) => {
                        if (!change || typeof change !== 'object' || !('old' in change) || !('new' in change)) return;
                        
                        // 🎯 Traitement spécial pour data_formulaire
                        if (field === 'data_formulaire') {
                          const oldForm = change.old || {};
                          const newForm = change.new || {};
                          
                          // Comparer chaque champ du formulaire
                          const formFields = new Set([...Object.keys(oldForm), ...Object.keys(newForm)]);
                          formFields.forEach(formField => {
                            const oldVal = oldForm[formField];
                            const newVal = newForm[formField];
                            if (String(oldVal) !== String(newVal)) {
                              const label = formField === 'nombre_exemplaires' ? 'Quantité' :
                                          formField === 'largeur' ? 'Largeur' :
                                          formField === 'hauteur' ? 'Hauteur' :
                                          formField === 'type_support' ? 'Type de support' :
                                          formField === 'finition_oeillets' ? 'Finition' : formField;
                              changesList.push(`${label}: ${oldVal || '(vide)'} → ${newVal || '(vide)'}`);
                            }
                          });
                        } 
                        // 🎯 Normalisation des types pour comparaison
                        else {
                          const oldVal = String(change.old || '');
                          const newVal = String(change.new || '');
                          if (oldVal !== newVal) {
                            const fieldLabel = field === 'client' ? 'Client' : 
                                             field === 'description' ? 'Description' :
                                             field === 'machine' ? 'Machine' :
                                             field === 'quantite' ? 'Quantité' :
                                             field === 'amount' ? 'Montant' :
                                             field === 'telephone_client' ? 'Téléphone' :
                                             field === 'urgent' ? 'Urgent' : field;
                            changesList.push(`${fieldLabel}: ${change.old || '(vide)'} → ${change.new || '(vide)'}`);
                          }
                        }
                      });
                      
                      comment = changesList.length > 0 ? `✏️ Modifications:\n${changesList.join('\n')}` : null;
                    }
                    const isRecent = index === 0;

                    console.log('[DossierDetails] Date extraite:', date);

                    const { date: formattedDate, time: formattedTime } = formatDateSafe(date);

                    // Fonction pour traduire les codes de statut en français
                    const getStatusLabel = (statusCode) => {
                      const statusLabels = {
                        'nouveau': 'Nouveau',
                        'en_cours': 'En cours',
                        'a_revoir': 'À revoir',
                        'pret_impression': 'Prêt impression',
                        'en_impression': 'En impression',
                        'imprime': 'Imprimé',
                        'pret_livraison': 'Prêt livraison',
                        'en_livraison': 'En livraison',
                        'livre': 'Livré',
                        'termine': 'Terminé'
                      };
                      return statusLabels[statusCode] || statusCode;
                    };

                    // Couleur dynamique selon le statut
                    const getStatusColor = (status) => {
                      const statusLower = (status || '').toLowerCase();
                      if (statusLower.includes('nouveau')) return { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50 dark:bg-blue-900/20' };
                      if (statusLower.includes('en_cours') || statusLower.includes('en cours')) return { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50 dark:bg-yellow-900/20' };
                      if (statusLower.includes('pret') || statusLower.includes('prêt')) return { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50 dark:bg-purple-900/20' };
                      if (statusLower.includes('impression')) return { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50 dark:bg-indigo-900/20' };
                      if (statusLower.includes('imprime') || statusLower.includes('imprimé')) return { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-900/20' };
                      if (statusLower.includes('livraison')) return { bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50 dark:bg-violet-900/20' };
                      if (statusLower.includes('livre') || statusLower.includes('livré')) return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-900/20' };
                      if (statusLower.includes('termine') || statusLower.includes('terminé')) return { bg: 'bg-gray-500', text: 'text-gray-600', light: 'bg-gray-50 dark:bg-gray-900/20' };
                      if (statusLower.includes('revoir')) return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-900/20' };
                      return { bg: 'bg-gray-500', text: 'text-gray-600', light: 'bg-gray-50 dark:bg-gray-900/20' };
                    };

                    const colors = isActivity 
                      ? { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50 dark:bg-orange-900/20' }
                      : getStatusColor(status);

                    return (
                      <div
                        key={index}
                        className={`relative rounded-lg p-3 border transition-all duration-200 hover:shadow-md ${isRecent
                          ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-purple-900/10 border-blue-300 dark:border-blue-700 shadow-sm'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                      >
                        {/* Badge RÉCENT */}
                        {isRecent && (
                          <div className="absolute -top-1.5 -right-1.5 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[9px] font-black rounded-full shadow-md animate-pulse">
                            RÉCENT
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          {/* Icône de statut ou modification */}
                          <div className={`flex-shrink-0 w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center shadow-md`}>
                            {isActivity ? (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>

                          {/* Contenu */}
                          <div className="flex-1 min-w-0">
                            {/* Header: Statut + Date sur même ligne */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-sm font-bold px-2 py-1 rounded ${isActivity ? 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30' : 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30'}`}>
                                  {isActivity ? '✏️ Modification' : getStatusLabel(status)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium">{formattedDate}</span>
                                <span className="text-gray-400 dark:text-gray-500">•</span>
                                <span>{formattedTime}</span>
                              </div>
                            </div>

                            {/* Auteur */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm ${isRecent ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-gray-500 to-gray-700'
                                }`}>
                                {author.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                {author}
                              </span>
                            </div>

                            {/* Commentaire avec détection des modifications */}
                            {comment && (
                              <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-start gap-1.5">
                                  {comment.includes('✏️ Modifications') || comment.includes('→') ? (
                                    <>
                                      <svg className="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      <div className="flex-1 text-[10px] leading-relaxed">
                                        {comment.split('\n').map((line, idx) => {
                                          if (!line.trim()) return null;
                                          
                                          // Ligne de titre
                                          if (line.includes('✏️ Modifications')) {
                                            return (
                                              <div key={idx} className="font-bold text-blue-700 dark:text-blue-400 mb-1.5">
                                                {line}
                                              </div>
                                            );
                                          }
                                          
                                          // Lignes de modifications (avec →)
                                          if (line.includes('•') && line.includes('→')) {
                                            const parts = line.split(':');
                                            if (parts.length >= 2) {
                                              const label = parts[0].trim();
                                              const values = parts[1].trim();
                                              const [oldVal, newVal] = values.split('→').map(v => v.trim());
                                              
                                              return (
                                                <div key={idx} className="flex items-start gap-1.5 py-1 px-2 bg-blue-50 dark:bg-blue-900/20 rounded mb-1">
                                                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                                    {label}
                                                  </span>
                                                  <div className="flex items-center gap-1.5 flex-1">
                                                    <span className="text-red-600 dark:text-red-400 line-through text-[9px] bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                                                      {oldVal}
                                                    </span>
                                                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                    </svg>
                                                    <span className="text-green-600 dark:text-green-400 font-semibold text-[9px] bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                                                      {newVal}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            }
                                          }
                                          
                                          return (
                                            <p key={idx} className="text-gray-600 dark:text-gray-400 mb-0.5">
                                              {line}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                        {comment}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-full mb-3 shadow-inner">
                  <svg className="h-7 w-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Aucun historique</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Les changements de statut apparaîtront ici</p>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <button type="button" aria-label="Fermer la fenêtre" className="fixed inset-0 bg-neutral-500 bg-opacity-75 transition-opacity cursor-pointer" onClick={onClose} />
        <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full border border-neutral-100 dark:border-neutral-700">
          {/* Header amélioré */}
          <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 dark:from-blue-800 dark:via-indigo-800 dark:to-blue-900 px-8 py-8 overflow-hidden">
            {/* Effet de fond animé */}
            <div className="absolute inset-0 bg-grid-white/[0.05] dark:bg-grid-white/[0.02] bg-[size:20px_20px]"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 dark:bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-2xl ring-4 ring-white/30 transform hover:scale-110 transition-transform duration-300">
                  <ClipboardDocumentListIcon className="h-10 w-10 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-2xl">
                      {dossier.numero_commande || dossier.numero}
                    </h3>
                    {dossier.urgence && dossier.status !== 'livre' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg ring-4 ring-red-400/30 animate-pulse">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        URGENT
                      </span>
                    )}
                  </div>
                  {/* ✅ Point vert "actif" + nom client */}
                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="relative">
                      <div className="h-2.5 w-2.5 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                      <div className="absolute inset-0 h-2.5 w-2.5 bg-green-400 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-blue-50 text-lg font-semibold drop-shadow-md">{dossier.client_nom || dossier.client}</p>
                      {dossier.telephone_client && (
                        <a
                          href={`tel:${dossier.telephone_client}`}
                          className="text-blue-100 text-sm hover:text-white transition-colors flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm"
                          title="Appeler le client"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="font-medium">{dossier.telephone_client}</span>
                        </a>
                      )}
                      {(dossier.montant_cfa || dossier.amount) && (
                        <div className="text-blue-100 text-base flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-extrabold text-lg">{parseInt(dossier.montant_cfa || dossier.amount).toLocaleString()} FCFA</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-blue-100 text-sm mt-1.5 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Créé le {formatDateSafe(dossier.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Badge urgent */}
                {dossier.urgent && dossier.status !== 'livre' && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-lg font-bold text-sm shadow-lg animate-pulse">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    URGENT
                  </span>
                )}
                {getStatusBadge(dossier.status)}
                {/* Badge paiement visible uniquement après livraison */}
                {dossier.status === 'livre' && getPaymentStatusBadge(dossier)}

                {/* Bouton fermer */}
                <button
                  onClick={onClose}
                  className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 p-2.5 rounded-xl backdrop-blur-sm ml-auto"
                  title="Fermer"
                >
                  <XMarkIcon className="h-7 w-7" />
                </button>
              </div>
            </div>
          </div>

          {/* 
            ✅ NOUVELLE ORGANISATION (15 oct 2025):
            - En-tête: N° Commande, Client, Date, Statut (source unique de vérité)
            - Gauche: Détails techniques SANS répétitions
            - Droite: Actions (haut) + Historique (bas) - DANS LA MÊME COLONNE
            - Bas pleine largeur: Upload fichiers
            - Supprimé: Répétitions N°/Date/Client/Statut, barres progression dans boutons
          */}
          <div className="p-8 max-h-[80vh] overflow-y-auto">
            {/* Grid principal: Gauche (infos) + Droite (actions + historique) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

              {/* COLONNE GAUCHE: Détails techniques uniquement (2/3 de la largeur) */}
              <div className="lg:col-span-2 space-y-6">

                {/* Détails techniques - Section complète avec toutes les infos */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-purple-100 dark:border-purple-900/50 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className={`px-5 py-3 border-b-2 ${(dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('roland')
                    ? 'bg-gradient-to-r from-red-50 via-pink-50 to-rose-50 dark:from-red-900/30 dark:via-pink-900/30 dark:to-rose-900/30 border-red-200 dark:border-red-800'
                    : (dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('xerox')
                      ? 'bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-50 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-sky-900/30 border-blue-200 dark:border-blue-800'
                      : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-blue-900/30 border-purple-200 dark:border-purple-800'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shadow-lg ${(dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('roland')
                        ? 'bg-gradient-to-br from-red-500 to-pink-600'
                        : (dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('xerox')
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                          : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                        }`}>
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">⚙️ Détails techniques</h3>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-purple-50/20 dark:from-gray-800 dark:to-purple-900/10">{renderTabContentSection('technical')}</div>
                </div>

                {/* Fichiers liés - DESIGN PROFESSIONNEL AVEC DRAG & DROP */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* En-tête simplifié */}
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500 rounded-lg">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Fichiers joints</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {files.length} {files.length > 1 ? 'fichiers' : 'fichier'}
                          </p>
                        </div>
                      </div>

                      {/* Bouton upload compact si autorisé */}
                      {canUploadFiles() && !uploadingFiles && (
                        <button
                          onClick={() => document.getElementById('hidden-dossier-file-input')?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Ajouter
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Zone de contenu avec drag & drop */}
                  <div
                    className={`p-6 relative ${dragActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                    onDragEnter={canUploadFiles() ? handleDrag : undefined}
                    onDragLeave={canUploadFiles() ? handleDrag : undefined}
                    onDragOver={canUploadFiles() ? handleDrag : undefined}
                    onDrop={canUploadFiles() ? handleDrop : undefined}
                  >
                    {/* Overlay drag & drop */}
                    {canUploadFiles() && dragActive && (
                      <div className="absolute inset-0 bg-emerald-500/10 border-4 border-dashed border-emerald-500 rounded-lg flex items-center justify-center z-10 m-2">
                        <div className="text-center">
                          <svg className="w-16 h-16 mx-auto text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            Déposez vos fichiers ici
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Zone d'upload cachée mais fonctionnelle */}
                    {canUploadFiles() && (
                      <input
                        id="hidden-dossier-file-input"
                        type="file"
                        className="hidden"
                        multiple
                        disabled={uploadingFiles}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileUpload(Array.from(e.target.files));
                            e.target.value = null;
                          }
                        }}
                      />
                    )}

                    {/* Barre de progression upload */}
                    {/* Barre de progression upload améliorée */}
                    {uploadingFiles && uploadProgress && (uploadProgress.percent || uploadProgress > 0) && (
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">
                            {uploadProgress.mode === 'chunked' ? '📦 Upload chunked en cours...' : '📤 Upload en cours...'}
                          </span>
                          <span className="text-sm font-bold text-blue-700">
                            {uploadProgress.percent || uploadProgress}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress.percent || uploadProgress}%` }}
                          ></div>
                        </div>
                        {uploadProgress.loaded && uploadProgress.total && (
                          <div className="mt-2 text-xs text-blue-600 flex justify-between">
                            <span>{Math.round(uploadProgress.loaded / 1024 / 1024)} MB / {Math.round(uploadProgress.total / 1024 / 1024)} MB</span>
                            {uploadProgress.speed > 0 && (
                              <span>⚡ {Math.round(uploadProgress.speed / 1024)} KB/s</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Liste des fichiers */}
                    <div>
                      {renderTabContentSection('files')}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLONNE DROITE: Actions (haut) + Historique (bas) */}
              <div className="lg:col-span-1 space-y-6">

                {/* ACTIONS WORKFLOW */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-pink-100 dark:border-pink-900/50 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="px-5 py-3 bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 dark:from-pink-900/30 dark:via-purple-900/30 dark:to-indigo-900/30 border-b-2 border-pink-200 dark:border-pink-800">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-2 rounded-xl shadow-lg">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">🎯 Actions</h3>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-pink-50/20 dark:from-gray-800 dark:to-pink-900/10">
                    {/* Boutons d'action - SANS statut ni progression répétés */}
                    {(() => {
                      const actions = getAvailableActions(user?.role, dossier?.status, dossier);
                      // 🐛 DEBUG: Logs pour identifier pourquoi boutons invisibles
                      console.log('🎯 [DossierDetails] DEBUG Actions:', {
                        userRole: user?.role,
                        dossierStatus: dossier?.status,
                        dossierType: dossier?.type_formulaire || dossier?.machine,
                        normalizedStatus: dossier?.status ? normalizeStatusLabel(dossier.status) : null,
                        actionsCount: actions.length,
                        actions: actions,
                        workflowHasRole: !!WORKFLOW_ACTIONS[user?.role],
                        workflowHasStatus: user?.role && dossier?.status ? !!WORKFLOW_ACTIONS[user?.role]?.[normalizeStatusLabel(dossier.status)] : false,
                      });
                      return null;
                    })()}
                    {user?.role !== 'livreur' && (
                      <div className="space-y-3">
                        {getAvailableActions(user?.role, dossier?.status, dossier).length > 0 ? (
                          getAvailableActions(user?.role, dossier?.status, dossier).map((action, i) => {
                            const actionConfig = {
                              'Marquer prêt pour impression': { gradient: 'from-purple-500 to-indigo-600', icon: '✓', ring: 'ring-purple-400/30' },
                              'Valider': { gradient: 'from-emerald-500 to-green-600', icon: '✓', ring: 'ring-emerald-400/30' },
                              'Revalider': { gradient: 'from-blue-500 to-indigo-600', icon: '✓✓', ring: 'ring-blue-400/30' },
                              'Renvoyer à revoir': { gradient: 'from-red-500 to-pink-600', icon: '⚠️', ring: 'ring-red-400/30' },
                              'Retour en cours': { gradient: 'from-amber-500 to-orange-600', icon: '↩️', ring: 'ring-amber-400/30' },
                              'Marquer à revoir': { gradient: 'from-orange-500 to-red-600', icon: '⚠️', ring: 'ring-orange-400/30' },
                              'Démarrer impression': { gradient: 'from-purple-500 to-indigo-600', icon: '🖨️', ring: 'ring-purple-400/30' },
                              'Marquer comme imprimé': { gradient: 'from-cyan-500 to-blue-600', icon: '✓', ring: 'ring-cyan-400/30' },
                              'Terminer impression': { gradient: 'from-cyan-500 to-blue-600', icon: '✓', ring: 'ring-cyan-400/30' },
                              'Marquer prêt livraison': { gradient: 'from-indigo-500 to-purple-600', icon: '📦', ring: 'ring-indigo-400/30' },
                              'Programmer livraison': { gradient: 'from-blue-600 to-indigo-700', icon: '🚚', ring: 'ring-blue-500/30' },
                              'Démarrer livraison': { gradient: 'from-blue-600 to-indigo-700', icon: '🚚', ring: 'ring-blue-500/30' },
                              'Marquer comme livré': { gradient: 'from-green-600 to-emerald-700', icon: '✅', ring: 'ring-green-500/30' },
                              'Marquer comme terminé': { gradient: 'from-gray-600 to-slate-700', icon: '🏁', ring: 'ring-gray-500/30' },
                              'Remettre en impression': { gradient: 'from-amber-500 to-orange-600', icon: '🔄', ring: 'ring-amber-400/30' },
                            };
                            const config = actionConfig[action.label] || { gradient: 'from-gray-500 to-gray-600', icon: '→', ring: 'ring-gray-400/30' };

                            return (
                              <button
                                key={i}
                                onClick={() => handleWorkflowAction(action)}
                                disabled={changingStatut}
                                aria-label={action.label}
                                title={action.label}
                                className={`group relative w-full inline-flex items-center justify-start gap-2 px-3 py-2 bg-gradient-to-r ${config.gradient} text-white font-semibold text-xs rounded-lg shadow-md ring-2 ${config.ring} transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                              >
                                {changingStatut ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-left flex-1">En cours...</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-base">{config.icon}</span>
                                    <span className="text-left flex-1">{action.label}</span>
                                  </>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                            <svg className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Aucune action disponible
                          </div>
                        )}
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleUnlockDossier()}
                            disabled={changingStatut}
                            aria-label="Déverrouiller le dossier"
                            title="Déverrouiller le dossier (Admin)"
                            className="group relative w-full inline-flex items-center justify-start gap-2 px-3 py-2 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-semibold text-xs rounded-lg shadow-md ring-2 ring-gray-600/30 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            <span className="flex-1 text-left">Déverrouiller</span>
                          </button>
                        )}

                        {/* Bouton Modifier le dossier - ADMIN UNIQUEMENT */}
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => {
                              console.log('📝 Ouverture du mode édition pour le dossier:', dossier);
                              
                              const dossierForEdit = {
                                ...dossier,
                                id: dossier.id || dossier.folder_id || dossier.dossier_id,
                                form_data: dossier.data_formulaire || dossier.form_data || {},
                                client: dossier.nom_client || dossier.client_nom || dossier.client || '',
                                telephone_client: dossier.telephone_client || '',
                                description: dossier.description_travail || dossier.description || '',
                                urgent: dossier.urgence || dossier.urgent || false,
                                type: dossier.type_formulaire || dossier.machine || dossier.type || '',
                                sections: dossier.sections || [],
                                supports: dossier.supports || [],
                                amount: dossier.montant_cfa || dossier.amount || null,
                              };

                              console.log('📤 Données préparées pour édition:', dossierForEdit);
                              // NE PAS fermer - doit rester ouvert pour le rechargement
                              // onClose(); ❌ SUPPRIMÉ
                              window.dispatchEvent(new CustomEvent('editDossier', { detail: dossierForEdit }));
                            }}
                            title="Modifier les informations du dossier"
                            className="group relative w-full inline-flex items-center justify-start gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs rounded-lg shadow-md ring-2 ring-blue-500/30 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="flex-1 text-left">✏️ Modifier le dossier</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION COMMENTAIRES DE RÉVISION - Visible uniquement si statut "a_revoir" et pour imprimeur/préparateur/admin */}
                {dossier?.status === 'a_revoir' && (user?.role === 'admin' || user?.role === 'preparateur' || user?.role?.includes('imprimeur')) && (() => {
                  // Priorité 1: commentaire principal du dossier
                  let reviewComment = dossier?.commentaire;
                  let reviewAuthor = 'Imprimeur';
                  let reviewDate = dossier?.updated_at || dossier?.date_modification;
                  
                  // Si pas de commentaire principal, chercher dans l'historique
                  if (!reviewComment) {
                    const sortedHistory = [...statutHistory].sort((a, b) => new Date(b.created_at || b.date_changement) - new Date(a.created_at || a.date_changement));
                    const lastReviewEntry = sortedHistory.find(entry => {
                      const status = (entry.nouveau_statut || entry.statut || '').toLowerCase();
                      return status.includes('revoir') || status === 'a_revoir';
                    });
                    reviewComment = lastReviewEntry?.commentaire || lastReviewEntry?.comment;
                    reviewAuthor = lastReviewEntry?.user_name || lastReviewEntry?.utilisateur || lastReviewEntry?.user || 'Imprimeur';
                    reviewDate = lastReviewEntry?.created_at || lastReviewEntry?.date_changement;
                  }

                  const formatDateSafe = (dateValue) => {
                    if (!dateValue) return { date: '—', time: '—' };
                    try {
                      const dateObj = new Date(dateValue);
                      if (isNaN(dateObj.getTime())) return { date: '—', time: '—' };
                      return {
                        date: dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
                        time: dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      };
                    } catch (error) {
                      return { date: '—', time: '—' };
                    }
                  };

                  const { date: formattedDate, time: formattedTime } = formatDateSafe(reviewDate);

                  return reviewComment ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/50 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                      <div className="px-5 py-3 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 dark:from-red-900/30 dark:via-orange-900/30 dark:to-amber-900/30 border-b-2 border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-red-500 to-orange-600 p-2 rounded-xl shadow-lg">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">💬 Commentaire de révision</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Demandé par {reviewAuthor}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 bg-gradient-to-br from-white to-red-50/20 dark:from-gray-800 dark:to-red-900/10">
                        {/* Badge urgent */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full text-xs font-bold mb-4 shadow-lg animate-pulse">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>RÉVISION DEMANDÉE</span>
                        </div>

                        {/* Commentaire */}
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4 border-l-4 border-red-500 shadow-inner">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                              {reviewAuthor.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-red-700 dark:text-red-400">{reviewAuthor}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>{formattedDate} • {formattedTime}</span>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
                                {reviewComment}
                              </p>
                            </div>
                          </div>

                          {/* Instructions pour le préparateur */}
                          {user?.role === 'preparateur' && (
                            <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                              <div className="flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold">
                                  Veuillez corriger le(s) fichier(s) selon les instructions ci-dessus, puis cliquez sur "Revalider le dossier".
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* HISTORIQUE - Dans colonne droite sous actions - Visible pour tous, modifications filtrées par rôle */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/50 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="px-5 py-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-pink-900/30 border-b-2 border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">📜 Historique</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {statutHistory.filter(entry => {
                            // Compter uniquement les entrées visibles selon le rôle
                            if (entry.type === 'activity' && user?.role !== 'admin') return false;
                            return true;
                          }).length} événement{statutHistory.filter(entry => {
                            if (entry.type === 'activity' && user?.role !== 'admin') return false;
                            return true;
                          }).length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-indigo-50/20 dark:from-gray-800 dark:to-indigo-900/10 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {renderTabContentSection('history')}
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ Section upload en bas supprimée - Accessible uniquement via bouton dans section "Fichiers" */}
          </div>
        </div>
      </div>

      {/* File Viewer Modal */}
      <FileViewer file={selectedFile} isOpen={showFileViewer} onClose={() => { setShowFileViewer(false); setSelectedFile(null); }} />

      {/* Review Comment Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowReviewModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">💬 Commentaire de révision</h3>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Expliquez les modifications nécessaires..." className="w-full px-4 py-3 border border-neutral-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={4} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 hover:bg-neutral-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-semibold">Annuler</button>
              <button onClick={() => { setShowReviewModal(false); handleStatusChange('a_revoir', reviewComment); }} disabled={changingStatut} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-semibold">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Comment Modal (for reprint) */}
      {showCommentModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowCommentModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">💬 Commentaire (optionnel)</h3>
            <textarea value={commentModalValue} onChange={e => setCommentModalValue(e.target.value)} placeholder="Optionnel : ajouter un commentaire pour l'action" className="w-full px-4 py-3 border border-neutral-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={4} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowCommentModal(false); setPendingAction(null); }} className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-gray-700 text-neutral-700 dark:text-gray-300 hover:bg-neutral-300 dark:hover:bg-gray-600 rounded-lg transition-colors">Annuler</button>
              <button onClick={async () => {
                setShowCommentModal(false);
                if (pendingAction?.type === 'reprint') {
                  await handleReprintDossier(commentModalValue || null);
                }
                setPendingAction(null);
              }} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Force status modal (admin) */}
      {showForceStatusModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowForceStatusModal(false)} />
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🔧 Forcer un statut</h3>
            <input value={forceStatusValue} onChange={e => setForceStatusValue(e.target.value)} placeholder="ex: en_impression" className="w-full px-4 py-3 border border-neutral-300 rounded-lg" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowForceStatusModal(false); setPendingAction(null); }} className="flex-1 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg">Annuler</button>
              <button onClick={async () => {
                setShowForceStatusModal(false);
                if (pendingAction?.type === 'force' && forceStatusValue) {
                  await handleStatusChange(forceStatusValue.trim());
                }
                setPendingAction(null);
              }} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de livraison avec montant */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDeliveryModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-lg">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">✅ Marquer comme livré</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Confirmez la livraison du dossier <span className="font-semibold text-gray-900 dark:text-white">#{dossier?.numero}</span> pour <span className="font-semibold text-gray-900 dark:text-white">{dossier?.client}</span>
              </p>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  💰 Montant collecté (FCFA)
                </label>
                <input
                  type="number"
                  value={deliveryAmount}
                  onChange={(e) => setDeliveryAmount(e.target.value)}
                  placeholder="Entrez le montant collecté"
                  className="w-full px-4 py-3 text-lg font-bold border-2 border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                {dossier?.montant_cfa && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Montant initial du dossier : <span className="font-semibold">{parseInt(dossier.montant_cfa).toLocaleString()} FCFA</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowDeliveryModal(false);
                  setDeliveryAmount('');
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  try {
                    setShowDeliveryModal(false);
                    // Marquer comme livré avec le montant
                    await handleStatusChange('livre', deliveryAmount ? `Montant collecté: ${deliveryAmount} FCFA` : null);
                    notifySuccess('✅ Dossier marqué comme livré');
                    setDeliveryAmount('');
                  } catch (err) {
                    notifyError('Erreur lors de la livraison');
                  }
                }}
                disabled={changingStatut}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingStatut ? 'Traitement...' : '✅ Confirmer la livraison'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete file confirm modal */}
      {showDeleteConfirm && fileToDelete && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => { setShowDeleteConfirm(false); setFileToDelete(null); }} />
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🗑️ Confirmer la suppression</h3>
            <p>Supprimer "{fileToDelete.nom || fileToDelete.original_filename}" ? Cette action est irréversible.</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowDeleteConfirm(false); setFileToDelete(null); }} className="flex-1 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg">Annuler</button>
              <button onClick={async () => {
                try {
                  await filesService.deleteFile(fileToDelete.id);
                  notifySuccess('Fichier supprimé');
                  await loadFiles();
                } catch (err) {
                  notifyError('Erreur suppression fichier');
                } finally {
                  setShowDeleteConfirm(false);
                  setFileToDelete(null);
                }
              }} className="flex-1 px-4 py-2 bg-error-600 text-white rounded-lg">Supprimer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

DossierDetails.propTypes = {
  dossierId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dossier: PropTypes.object,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func,
};

// defaultProps supprimé - utiliser les paramètres par défaut JavaScript à la place

export function DossierDetailsWithViewer(props) {
  return <DossierDetails {...props} />;
}
