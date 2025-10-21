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
import filesService from '../../services/filesService';
import notificationService from '../../services/notificationService';
import FileUpload from '../files/FileUpload';
import FileViewer from '../files/FileViewer';
import FileThumbnail from '../files/FileThumbnailSimple';
import { useAuth } from '../../context/AuthContext';
import { normalizeDossier } from '../../services/dossierNormalizer';
import { getAvailableActions } from '../../workflow-adapter/workflowActions';
import { filterValidFiles } from '../../utils/fileValidation';

export default function DossierDetails({ 
  dossier: dossierProp = null, 
  dossierId = null, 
  isOpen = false, 
  onClose, 
  onStatusChange = () => {} 
}) {
  const { user } = useAuth();
  // Initialiser avec dossierProp seulement s'il est vraiment fourni et valide
  const [dossier, setDossier] = useState(() => {
    if (dossierProp && typeof dossierProp === 'object' && Object.keys(dossierProp).length > 0) {
      return normalizeDossier(dossierProp);
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
  const [showUpload, setShowUpload] = useState(false);
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

  // Extraire l'ID - utiliser un state pour le garder stable
  const [effectiveId, setEffectiveId] = useState(null);
  const previousIsOpen = useRef(isOpen);
  
  // Mettre à jour l'ID uniquement quand le modal s'ouvre (transition false -> true)
  useEffect(() => {
    if (isOpen && !previousIsOpen.current) {
      // Modal vient de s'ouvrir, extraire l'ID
      const extractValidId = (value) => {
        if (!value || value === null || value === undefined) return null;
        const strValue = String(value).trim();
        if (strValue === '' || strValue === 'null' || strValue === 'undefined') return null;
        return value;
      };
      
      // Priorité: dossierId explicite > propriétés de dossierProp
      // Vérifier d'abord si dossierId est fourni directement
      let id = extractValidId(dossierId);
      
      // Si pas d'ID direct et que dossierProp existe, chercher dans ses propriétés
      if (!id && dossierProp && typeof dossierProp === 'object') {
        id = extractValidId(dossierProp.folder_id) || 
             extractValidId(dossierProp.id) || 
             extractValidId(dossierProp.dossier_id) ||
             extractValidId(dossierProp.numero_dossier) ||
             extractValidId(dossierProp.numero);
      }
      
      setEffectiveId(id);
      
      // DEBUG: Afficher l'ID résolu UNIQUEMENT au moment de l'extraction
      if (process.env.NODE_ENV === 'development') {
        notificationService.debug && notificationService.debug('[DossierDetails] ID Resolution:', {
          dossierId,
          'dossierProp?.folder_id': dossierProp?.folder_id,
          'dossierProp?.id': dossierProp?.id,
          'dossierProp?.dossier_id': dossierProp?.dossier_id,
          extractedId: id,
          dossierProp: dossierProp ? Object.keys(dossierProp) : null,
          dossierPropIsValid: dossierProp && typeof dossierProp === 'object' && Object.keys(dossierProp).length > 0
        });
      }
    }
    previousIsOpen.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Ne dépendre QUE de isOpen pour éviter re-extractions inutiles

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
        gradient: 'bg-gradient-to-r from-blue-400 to-blue-600', 
        icon: '🆕', 
        label: 'Nouveau',
        ring: 'ring-blue-400/30'
      },
      en_cours: { 
        gradient: 'bg-gradient-to-r from-amber-400 to-yellow-500', 
        icon: '⚙️', 
        label: 'En préparation',
        ring: 'ring-yellow-400/30'
      },
      a_revoir: { 
        gradient: 'bg-gradient-to-r from-red-500 to-pink-600', 
        icon: '⚠️', 
        label: 'À revoir',
        ring: 'ring-red-400/30',
        animate: 'animate-pulse'
      },
      pret_impression: { 
        gradient: 'bg-gradient-to-r from-purple-500 to-indigo-600', 
        icon: '✓', 
        label: 'Prêt impression',
        ring: 'ring-purple-400/30'
      },
      en_impression: { 
        gradient: 'bg-gradient-to-r from-orange-500 to-amber-600', 
        icon: '🖨️', 
        label: 'En impression',
        ring: 'ring-orange-400/30'
      },
      imprime: { 
        gradient: 'bg-gradient-to-r from-emerald-500 to-green-600', 
        icon: '📋', 
        label: 'Imprimé',
        ring: 'ring-emerald-400/30'
      },
      pret_livraison: { 
        gradient: 'bg-gradient-to-r from-cyan-500 to-blue-600', 
        icon: '📦', 
        label: 'Prêt livraison',
        ring: 'ring-cyan-400/30'
      },
      en_livraison: { 
        gradient: 'bg-gradient-to-r from-blue-600 to-indigo-700', 
        icon: '🚚', 
        label: 'En livraison',
        ring: 'ring-blue-500/30'
      },
      livre: { 
        gradient: 'bg-gradient-to-r from-green-600 to-emerald-700', 
        icon: '✅', 
        label: 'Livré',
        ring: 'ring-green-500/30'
      },
      termine: { 
        gradient: 'bg-gradient-to-r from-teal-600 to-green-700', 
        icon: '🎉', 
        label: 'Terminé',
        ring: 'ring-teal-500/30'
      },
    };

    const config = statusConfig[status] || { 
      gradient: 'bg-gradient-to-r from-gray-400 to-gray-600', 
      icon: '📋', 
      label: status,
      ring: 'ring-gray-400/30'
    };

    return (
      <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white ${config.gradient} shadow-lg ring-4 ${config.ring} transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${config.animate || ''}`}>
        <span className="text-lg">{config.icon}</span>
        <span className="tracking-wide">{config.label}</span>
      </span>
    );
  };

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
      
      const response = await dossiersService.getDossier(id);
      const raw = response?.dossier || response;
      
      if (!raw) {
        throw new Error('Aucune donnée de dossier reçue');
      }
      
      const normalized = normalizeDossier(raw);

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
      
      const history = response.statut_history || raw?.historique || [];
      
      // Batch tous les setState ensemble pour éviter multiples re-renders
      setDossier(normalized);
      setFiles(validFiles);
      setStatutHistory(history);
      setError('');
      setLoading(false);
      
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
        notificationService.debug && notificationService.debug('[DossierDetails] ERREUR ID invalide:', errMsg, {dossierId, dossierProp});
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

  const handleFileUpload = async selected => {
    try {
      setUploadingFiles(true);
      await filesService.uploadFiles(effectiveId, selected);
      setTimeout(async () => {
        await loadFiles();
      }, 500);
      setShowUpload(false);
    } catch (err) {
      notificationService.error("Erreur lors de l'upload des fichiers");
      setError(err?.error || "Erreur lors de l'upload des fichiers");
    } finally {
      setUploadingFiles(false);
    }
  };

  const canUploadFiles = () => {
    if (!dossier || !user) return false;
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

    if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
      const machineType = (dossier.type_formulaire || dossier.machine || '').toLowerCase();
      const requiredMachine = user.role === 'imprimeur_roland' ? 'roland' : 'xerox';
      if (machineType.includes(requiredMachine)) {
        const allowedStatuses = ['en_impression', 'termine', 'en_cours'];
        return allowedStatuses.includes(dossier.status || dossier.statut);
      }
      return false;
    }

    if (user.role === 'livreur') {
      const allowedStatuses = ['pret_livraison', 'en_livraison', 'livre', 'termine'];
      const status = (dossier.status || dossier.statut || '').toLowerCase().replace(/\s/g, '_');
      return allowedStatuses.includes(status);
    }

    return false;
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
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
      <div className="fixed inset-0 z-50 overflow-y-auto">
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
      <div className="flex items-center justify-between py-2.5 px-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-md transition-all">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider ${colors[colorClass] || colors.violet} shadow-sm`}>
          {label}
        </span>
        <span className="text-sm font-semibold text-gray-900">{value}</span>
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
        
        // ✅ MODE COMPACT INSPIRÉ DE L'IMAGE : Badges inline avec label + valeur
        
        return (
          <div className="space-y-2">
            {/* Description si présente */}
            {dossier.description && (
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-3 border border-amber-200 mb-3">
                <label className="text-xs font-bold text-amber-800 uppercase flex items-center gap-2 mb-2">
                  <DocumentIcon className="h-3.5 w-3.5" />
                  Instructions
                </label>
                <p className="text-xs text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {dossier.description}
                </p>
              </div>
            )}

            {/* ✅ SECTIONS COMPACTES - Style image de référence */}
            {formData.type_document && renderCompactBadge('DOCUMENT', formData.type_document, 'violet')}
            {formData.format && renderCompactBadge('FORMAT', formData.format, 'violet')}
            {formData.mode_impression && renderCompactBadge('IMPRESSION', `${formData.mode_impression}${formData.couleur_impression ? ' • ' + formData.couleur_impression : ''}`, 'cyan')}
            {formData.nombre_exemplaires && renderCompactBadge('PRODUCTION', `${formData.nombre_exemplaires} exemplaires`, 'green')}
            {formData.grammage && renderCompactBadge('PAPIER', formData.grammage, 'orange')}
            {Array.isArray(formData.finition) && formData.finition.length > 0 && renderCompactBadge('FINITIONS', formData.finition.join(', '), 'rose')}
            {typeof formData.numerotation !== 'undefined' && renderCompactBadge('NUMÉROTATION', formData.numerotation ? '✓ Oui' : '✗ Non', 'gray')}
            
            {/* Support Roland */}
            {isRoland && formData.type_support && renderCompactBadge('SUPPORT', formData.type_support, 'violet')}
            {isRoland && (formData.largeur || formData.hauteur) && renderCompactBadge('DIMENSIONS', `${formData.largeur || '?'} × ${formData.hauteur || '?'} ${formData.unite || 'cm'}`, 'cyan')}
            {isRoland && formData.finition_oeillets && renderCompactBadge('FINITION', formData.finition_oeillets, 'rose')}

            {/* Message si aucune donnée */}
            {!formData.type_document && !formData.format && !formData.type_support && Object.keys(formData).length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Aucune donnée technique disponible</p>
              </div>
            )}
          </div>
        );
      }

      case 'files':
        return (
          <div>
            {/* Upload déplacé en bas en section pleine largeur - Suppression d'ici pour éviter duplication */}
            
            {files.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {files
                  .filter(file => {
                    // Garde supplémentaire: ne rendre QUE les fichiers avec ID valide
                    if (!file || !file.id) return false;
                    const strId = String(file.id).trim();
                    if (strId === '' || strId === 'null' || strId === 'undefined') return false;
                    return true;
                  })
                  .map(file => {
                  const isImage = file.type?.includes('image') || file.nom?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                  const isPdf = file.type?.includes('pdf') || file.nom?.match(/\.pdf$/i);
                  const canPreview = isImage || isPdf;

                  return (
                    <div key={file.id} className="group relative bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 border-2 border-gray-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                {/* Badge de type de fichier */}
                <div className="absolute top-2 right-2 z-10">
                  {isImage && (
                    <span className="px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-600 text-white text-xs font-bold rounded-full shadow-lg">
                      IMAGE
                    </span>
                  )}
                  {isPdf && (
                    <span className="px-2 py-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-bold rounded-full shadow-lg">
                      PDF
                    </span>
                  )}
                </div>
                
                <div className="text-center mb-3 cursor-pointer" onClick={() => { if (canPreview) { setSelectedFile(file); setShowFileViewer(true); } }}>
                  <FileThumbnail file={file} size={80} />
                </div>
                
                <p className="text-xs font-bold text-gray-900 truncate mb-3 text-center group-hover:text-blue-600 transition-colors" title={file.original_filename || file.nom || 'Fichier'}>
                  {file.original_filename || file.nom || 'Fichier'}
                </p>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => filesService.downloadFile(file.id)} 
                    className="group/btn relative flex-1 p-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transform hover:scale-110 transition-all duration-200" 
                    title="Télécharger"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mx-auto" />
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Télécharger
                    </span>
                  </button>
                  
                  {canPreview && (
                    <button 
                      onClick={() => { setSelectedFile(file); setShowFileViewer(true); }} 
                      className="group/btn relative flex-1 p-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:shadow-lg transform hover:scale-110 transition-all duration-200" 
                      title="Aperçu"
                    >
                      <EyeIcon className="h-4 w-4 mx-auto" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Aperçu
                      </span>
                    </button>
                  )}
                  
                  {user?.role === 'admin' && (
                    <button 
                      onClick={() => { setFileToDelete(file); setShowDeleteConfirm(true); }} 
                      className="group/btn relative flex-1 p-2.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:shadow-lg transform hover:scale-110 transition-all duration-200" 
                      title="Supprimer"
                    >
                      <TrashIcon className="h-4 w-4 mx-auto" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Supprimer
                      </span>
                    </button>
                  )}
                </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
                  <span className="text-3xl">📁</span>
                </div>
                <p className="text-gray-600 mb-4">Aucun fichier disponible</p>
                {canUploadFiles() && (<button onClick={() => setShowUpload(true)} className="btn-primary">Ajouter des fichiers</button>)}
              </div>
            )}

            {loadingFiles && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Chargement des fichiers...</span>
              </div>
            )}
          </div>
        );

      case 'followup':
        return (
          <div>
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Statut actuel</label>
              <div className="flex items-center gap-3">
                {getStatusBadge(dossier.status)}
                {dossier.updated_at && (<span className="text-sm text-neutral-500">Mis à jour le {formatDateTime(dossier.updated_at)}</span>)}
              </div>
            </div>

            {/* Boutons d'action compacts */}
            <div className="mb-4 flex flex-wrap gap-2">
              {getAvailableActions(user?.role, dossier?.status).map((action, i) => {
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
            </div>

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
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg transform transition-all duration-300 ${ 
                  isCurrent 
                    ? `bg-gradient-to-r from-${stage.color}-500 to-${stage.color}-600 text-white ring-4 ring-${stage.color}-200 scale-110 animate-pulse` 
                    : isComplete 
                    ? `bg-gradient-to-r from-${stage.color}-500 to-${stage.color}-600 text-white` 
                    : 'bg-gray-200 text-gray-400' 
                }`}>
                  <span className="text-lg">{isComplete ? '✓' : stage.icon}</span>
                </div>
                
                {/* Informations du statut */}
                <div className={`flex-1 bg-white rounded-xl p-4 shadow-md transition-all duration-300 ${
                  isCurrent ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <p className={`font-bold text-sm ${
                      isCurrent ? 'text-blue-600' : isComplete ? 'text-gray-900' : 'text-gray-400'
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
              <div className="mt-6 pt-6 border-t border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Progression globale</span>
                  <span className="text-sm font-bold text-blue-600">
                    {Math.round((statutHistory.length / 8) * 100)}%
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
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
        const sortedHistory = [...statutHistory].sort((a, b) => new Date(b.created_at || b.date_changement) - new Date(a.created_at || a.date_changement));
        return (
          <div className="space-y-2">
            {sortedHistory.length > 0 ? (
              sortedHistory.map((entry, index) => {
                const status = entry.nouveau_statut || entry.statut;
                const author = entry.user_name || entry.utilisateur || entry.user || 'Système';
                const date = entry.created_at || entry.date_changement;
                const comment = entry.commentaire || entry.comment;
                const isRecent = index === 0;

                return (
                  <div 
                    key={index} 
                    className={`relative rounded-md p-2 border transition-all duration-150 ${
                isRecent 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {/* Badge récent */}
                    {isRecent && (
                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[9px] font-bold rounded-full shadow">
                  NOUVEAU
                </div>
                    )}
                    
                    {/* Ligne compacte : statut + date */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {getStatusBadge(status)}
                </div>
                <span className="text-[10px] text-gray-500 font-medium flex-shrink-0">{formatDateTime(date)}</span>
                    </div>
                    
                    {/* Auteur compact */}
                    <div className="flex items-center gap-1.5 mb-1">
                <div className="w-4 h-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-bold">{author.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-[10px] text-gray-600 font-medium">{author}</span>
                    </div>
                    
                    {/* Commentaire si présent */}
                    {comment && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                  <p className="text-[10px] text-gray-700 leading-relaxed">💬 {comment}</p>
                </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-2">
                  <span className="text-xl">🕰️</span>
                </div>
                <p className="text-xs text-gray-600 font-medium">Aucun historique</p>
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <button type="button" aria-label="Fermer la fenêtre" className="fixed inset-0 bg-neutral-500 bg-opacity-75 transition-opacity cursor-pointer" onClick={onClose} />
        <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full border border-neutral-100 dark:border-neutral-700">
          {/* Header amélioré */}
          <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 px-8 py-8 overflow-hidden">
            {/* Effet de fond animé */}
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            
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
                    {dossier.urgence && (
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
                    <p className="text-blue-50 text-lg font-semibold drop-shadow-md">{dossier.client_nom || dossier.client}</p>
                  </div>
                  <div className="text-blue-100 text-sm mt-1.5 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Créé le {formatDateSafe(dossier.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(dossier.status)}
                <button 
                  onClick={onClose} 
                  className="text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 p-2.5 rounded-xl backdrop-blur-sm" 
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
                <div className="bg-white rounded-2xl shadow-xl border border-purple-100 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className={`px-6 py-4 border-b-2 ${ 
                    (dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('roland') 
                ? 'bg-gradient-to-r from-red-50 via-pink-50 to-rose-50 border-red-200' 
                : (dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('xerox')
                ? 'bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-50 border-blue-200'
                : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-purple-200'
                  }`}>
                    <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl shadow-lg ${
                  (dossier.type_formulaire || dossier.machine || '').toLowerCase().includes('roland')
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
                <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">⚙️ Détails techniques</h3>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-purple-50/20">{renderTabContentSection('technical')}</div>
                </div>

                {/* Fichiers liés */}
                <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b-2 border-emerald-200">
                    <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2 rounded-xl shadow-lg">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">📁 Fichiers</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{files.length} fichier{files.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-emerald-50/20 max-h-80 overflow-y-auto">{renderTabContentSection('files')}</div>
                </div>
              </div>
              
              {/* COLONNE DROITE: Actions (haut) + Historique (bas) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* ACTIONS WORKFLOW */}
                <div className="bg-white rounded-2xl shadow-xl border border-pink-100 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="px-6 py-4 bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 border-b-2 border-pink-200">
                    <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-2 rounded-xl shadow-lg">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">🎯 Actions</h3>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-pink-50/20">
                    {/* Boutons d'action - SANS statut ni progression répétés */}
                    {(() => {
                      return null;
                    })()}
                    <div className="space-y-3">
                {getAvailableActions(user?.role, dossier?.status).length > 0 ? (
                  getAvailableActions(user?.role, dossier?.status).map((action, i) => {
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
                        className={`group relative w-full inline-flex items-center justify-start gap-3 px-4 py-3 bg-gradient-to-r ${config.gradient} text-white font-bold text-sm rounded-xl shadow-lg ring-2 ${config.ring} transform transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                      >
                        {changingStatut ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-left flex-1">En cours...</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">{config.icon}</span>
                            <span className="text-left flex-1">{action.label}</span>
                          </>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="group relative w-full inline-flex items-center justify-start gap-3 px-4 py-3 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-bold text-sm rounded-xl shadow-lg ring-2 ring-gray-600/30 transform transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span className="flex-1 text-left">Déverrouiller</span>
                  </button>
                )}
                    </div>
                  </div>
                </div>

                {/* HISTORIQUE - Dans colonne droite sous actions */}
                <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b-2 border-indigo-200">
                    <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">📜 Historique</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{statutHistory.length} événement{statutHistory.length > 1 ? 's' : ''}</p>
                </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-indigo-50/20 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {renderTabContentSection('history')}
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ Section upload en bas supprimée - Accessible uniquement via bouton dans section "Fichiers" */}
          </div>
        </div>
      </div>

      {/* Modal Upload de fichiers */}
      {showUpload && canUploadFiles() && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowUpload(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b-2 border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2 rounded-xl shadow-lg">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">📤 Ajouter des fichiers</h3>
                </div>
                <button 
                  onClick={() => setShowUpload(false)} 
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <FileUpload 
                onUpload={handleFileUpload}
                uploading={uploadingFiles}
                disabled={uploadingFiles}
                maxFileSize={50 * 1024 * 1024}
                multiple={true}
                maxFiles={10}
              />
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      <FileViewer file={selectedFile} isOpen={showFileViewer} onClose={() => { setShowFileViewer(false); setSelectedFile(null); }} />

      {/* Review Comment Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowReviewModal(false)} />
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">💬 Commentaire de révision</h3>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Expliquez les modifications nécessaires..." className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={4} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 font-semibold">Annuler</button>
              <button onClick={() => { setShowReviewModal(false); handleStatusChange('a_revoir', reviewComment); }} disabled={changingStatut} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 font-semibold">Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Comment Modal (for reprint) */}
      {showCommentModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowCommentModal(false)} />
          <div className="relative bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">💬 Commentaire (optionnel)</h3>
            <textarea value={commentModalValue} onChange={e => setCommentModalValue(e.target.value)} placeholder="Optionnel : ajouter un commentaire pour l'action" className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={4} />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowCommentModal(false); setPendingAction(null); }} className="flex-1 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg">Annuler</button>
              <button onClick={async () => {
                setShowCommentModal(false);
                if (pendingAction?.type === 'reprint') {
                  await handleReprintDossier(commentModalValue || null);
                }
                setPendingAction(null);
              }} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg">Envoyer</button>
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
