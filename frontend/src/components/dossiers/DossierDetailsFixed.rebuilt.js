import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../../services/apiAdapter';
import filesService from '../../services/filesService';
import FileUpload from '../files/FileUpload';
import FileViewer from '../files/FileViewer';
import FileThumbnail from '../files/FileThumbnailSimple';
import { useAuth } from '../../context/AuthContext';
import { normalizeDossier } from '../../services/dossierNormalizer';
import { getAvailableActions } from '../../workflow-adapter/workflowActions';

const DossierDetailsFixed = ({ isOpen, onClose, dossierId, dossier: dossierProp, onStatusChange }) => {
  const { user } = useAuth();
  const [dossier, setDossier] = useState(dossierProp ? normalizeDossier(dossierProp) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [statutHistory, setStatutHistory] = useState([]);
  const [changingStatut, setChangingStatut] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState('Wave');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Helper functions
  const formatDateTime = (dateString) => {
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

  const formatDateSafe = (dateString) => {
    try {
      if (!dateString) return 'Date inconnue';
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'Date invalide';
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      en_cours: '📋',
      a_revoir: '⚠️',
      en_impression: '🖨️',
      pret_livraison: '📦',
      en_livraison: '🚚',
      livre: '✅',
      termine: '✅',
    };
    return icons[status] || '📋';
  };

  const getStatusLabel = (status) => {
    const labels = {
      en_cours: 'En cours',
      a_revoir: 'À revoir',
      en_impression: 'En impression',
      pret_livraison: 'Prêt livraison',
      en_livraison: 'En livraison',
      livre: 'Livré',
      termine: 'Terminé',
    };
    return labels[status] || status;
  };

  const canUploadFiles = () => {
    if (!dossier || !user) return false;
    if (user.role === 'livreur') return false;
    if (user.role === 'admin') return true;
    if (user.role === 'preparateur') {
      const isOwner = dossier.created_by === user.id || dossier.createdById === user.id;
      if (!isOwner) return false;
      const allowedBase = ['en_cours', 'a_revoir'];
      const status = (dossier.status || dossier.statut || '').toLowerCase();
      if (dossier.valide_preparateur || dossier.validated) {
        return status === 'a_revoir';
      }
      return allowedBase.includes(status);
    }
    if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
      const machineType = (dossier.type_formulaire || dossier.machine || '').toLowerCase();
      const required = user.role === 'imprimeur_roland' ? 'roland' : 'xerox';
      if (!machineType.includes(required)) return false;
      const allowed = ['en_impression', 'termine'];
      const status = (dossier.status || dossier.statut || '').toLowerCase();
      return allowed.includes(status);
    }
    return false;
  };

  const loadDossierDetails = useCallback(async () => {
    const effectiveId = dossierId || dossierProp?.folder_id || dossierProp?.id;
    if (!effectiveId) return;
    try {
      setLoading(true);
      setError('');
      const response = await dossiersService.getDossier(effectiveId);
      const raw = response?.dossier || response;
      const normalized = normalizeDossier(raw);
      setDossier(normalized);
      const history = response?.statut_history || raw?.historique || [];
      setStatutHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      setError('Erreur lors du chargement du dossier');
    } finally {
      setLoading(false);
    }
  }, [dossierId, dossierProp]);

  const loadFiles = useCallback(async () => {
    const effectiveId = dossierId || dossierProp?.folder_id || dossierProp?.id;
    if (!effectiveId) return;
    try {
      setLoadingFiles(true);
      const response = await filesService.getFiles(effectiveId);
      const dossierFiles = response.files || response || [];
      setFiles(dossierFiles);
    } catch (err) {
      setError("Erreur chargement des fichiers");
    } finally {
      setLoadingFiles(false);
    }
  }, [dossierId, dossierProp]);

  useEffect(() => {
    if (isOpen) {
      loadDossierDetails();
      loadFiles();
    }
  }, [isOpen, loadDossierDetails, loadFiles]);

  const handleFileUpload = async (selectedFiles) => {
    try {
      setUploadingFiles(true);
      await filesService.uploadFiles(dossierId, selectedFiles);
      await loadFiles();
      setShowUpload(false);
    } catch (err) {
      setError("Erreur lors de l'upload des fichiers");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleStatusChange = async (newStatus, comment = null) => {
    try {
      setChangingStatut(true);
      const effectiveId = dossierId || dossier?.folder_id || dossier?.id;
      await dossiersService.changeStatus(effectiveId, newStatus, comment || undefined);
      await loadDossierDetails();
      if (onStatusChange) onStatusChange(dossierId, dossier.statut, newStatus);
      setShowReviewModal(false);
      setReviewComment('');
    } catch (err) {
      setError(err?.error || err?.message || 'Erreur lors du changement de statut');
    } finally {
      setChangingStatut(false);
    }
  };

  const handleStatusClick = (next) => {
    if ((user?.role === 'imprimeur_roland' || user?.role === 'imprimeur_xerox') && next === 'termine') {
      return handleStatusChange('pret_livraison');
    }
    if (next === 'a_revoir') {
      setShowReviewModal(true);
    } else {
      handleStatusChange(next);
    }
  };

  const handlePreviewFile = (file) => {
    setSelectedFile(file);
    setShowFileViewer(true);
  };

  const handleDownloadFile = (file) => {
    if (file?.url) {
      window.open(file.url, '_blank');
    } else if (filesService?.downloadFile) {
      filesService.downloadFile(file.id);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
          <div className="fixed inset-0 bg-neutral-500 bg-opacity-75"></div>
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-center mt-4 text-neutral-600 dark:text-neutral-300">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dossier || error) {
    const friendlyError = (() => {
      if (!error) return "Ce dossier n'existe pas ou vous n'avez pas l'autorisation";
      if (/non trouv/i.test(error)) return error;
      if (/autorisé|permission|refusé/i.test(error)) return error;
      return error;
    })();
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
          <button
            type="button"
            className="fixed inset-0 bg-neutral-500 bg-opacity-75 cursor-pointer"
            onClick={onClose}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-lg p-8">
            <div className="text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-danger-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                {friendlyError}
              </h3>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setError(''); loadDossierDetails(); }} className="btn-secondary">
                  Réessayer
                </button>
                <button onClick={onClose} className="btn-primary">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Déterminer actions disponibles
  const availableActions = (() => {
    try {
      if (!user || !dossier) return [];
      const job = {
        status: dossier.statut || dossier.status,
        machineType: dossier.type || dossier.machine,
        jobNumber: dossier.numero_commande || dossier.numero,
        createdById: dossier.created_by || dossier.createdById,
      };
      return getAvailableActions({ id: user.id, role: user.role }, job) || [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <button
          type="button"
          className="fixed inset-0 bg-neutral-500 bg-opacity-75 transition-opacity cursor-pointer"
          onClick={onClose}
        />
        <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full border border-neutral-100 dark:border-neutral-700">
          {/* Header Premium */}
          <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-600 px-8 py-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl border border-white/30 shadow-lg">
                  <div className="text-white text-2xl">{getStatusIcon(dossier.status || dossier.statut)}</div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      {dossier.numero_commande || dossier.numero || dossier.id}
                    </h3>
                    {dossier.urgence && (
                      <span className="px-3 py-1 bg-danger-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                        URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-blue-100 text-sm font-medium mt-1.5 flex items-center gap-2">
                    <span className="font-semibold">{dossier.client_nom || dossier.client || 'N/A'}</span>
                    <span className="text-blue-200">•</span>
                    <span className="capitalize text-blue-200">
                      {dossier.type?.charAt(0).toUpperCase() + dossier.type?.slice(1) || 'N/A'}
                    </span>
                  </p>
                  <div className="text-blue-200 text-xs mt-1 flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>Créé le {formatDateSafe(dossier.created_at || dossier.date_creation)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                  {(() => {
                    const status = dossier.status || dossier.statut;
                    const badges = {
                      en_cours: { cl: 'bg-blue-100 text-blue-800 border-blue-300', icon: '📋', label: 'En cours' },
                      a_revoir: { cl: 'bg-orange-100 text-orange-800 border-orange-300', icon: '⚠️', label: 'À revoir' },
                      en_impression: { cl: 'bg-purple-100 text-purple-800 border-purple-300', icon: '🖨️', label: 'En impression' },
                      pret_livraison: { cl: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: '📦', label: 'Prêt livraison' },
                      en_livraison: { cl: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🚚', label: 'En livraison' },
                      livre: { cl: 'bg-green-100 text-green-800 border-green-300', icon: '✅', label: 'Livré' },
                      termine: { cl: 'bg-green-100 text-green-800 border-green-300', icon: '✅', label: 'Terminé' },
                    };
                    const cfg = badges[status] || { cl: 'bg-neutral-100 text-gray-800 border-gray-300', icon: '📋', label: status };
                    return (
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border-2 ${cfg.cl}`}>
                        <span>{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={onClose}
                  className="text-white/90 hover:text-white hover:bg-white/20 transition-all p-2.5 rounded-lg backdrop-blur-sm border border-white/20"
                  title="Fermer"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Body avec layout 2 colonnes */}
          <div className="px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
              {/* Section Infos */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow border-2 border-blue-100 dark:border-neutral-700 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-primary-100/50 border-b-2 border-primary-200">
                  <div className="flex items-center gap-3">
                    <ClipboardDocumentListIcon className="h-5 w-5 text-primary-600" />
                    <h4 className="text-lg font-bold text-blue-900 dark:text-neutral-100">Informations générales</h4>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase">Client</label>
                      <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">{dossier.client_nom || dossier.client || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase">Machine</label>
                      <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">{dossier.type || dossier.machine || 'N/A'}</p>
                    </div>
                    {dossier.quantite && (
                      <div>
                        <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase">Quantité</label>
                        <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">{dossier.quantite}</p>
                      </div>
                    )}
                  </div>
                  {dossier.description && (
                    <div className="pt-3 border-t">
                      <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase">Description</label>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{dossier.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Fichiers */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow border-2 border-success-100 dark:border-neutral-700 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-success-50 to-success-100/50 border-b-2 border-success-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardDocumentListIcon className="h-5 w-5 text-success-600" />
                      <h4 className="text-lg font-bold text-success-900 dark:text-neutral-100">Fichiers ({files.length})</h4>
                    </div>
                    {canUploadFiles() && (
                      <button
                        onClick={() => setShowUpload(!showUpload)}
                        className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 text-sm font-semibold"
                      >
                        {showUpload ? 'Annuler' : 'Ajouter'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  {showUpload && canUploadFiles() && (
                    <div className="mb-4 p-4 border-2 border-dashed border-neutral-300 rounded-lg">
                      <FileUpload
                        onUpload={handleFileUpload}
                        uploading={uploadingFiles}
                        disabled={uploadingFiles}
                      />
                    </div>
                  )}
                  {loadingFiles ? (
                    <div className="text-center py-4 text-neutral-500">Chargement...</div>
                  ) : files.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500">Aucun fichier</div>
                  ) : (
                    <div className="space-y-3">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-gradient-to-br from-white to-success-50/20 border border-success-200 rounded-lg hover:shadow">
                          <FileThumbnail file={file} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">{file.nom || file.filename}</div>
                            <div className="text-xs text-neutral-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handlePreviewFile(file)} className="p-2 hover:bg-success-100 rounded" title="Aperçu">
                              <EyeIcon className="h-4 w-4 text-success-600" />
                            </button>
                            <button onClick={() => handleDownloadFile(file)} className="p-2 hover:bg-blue-100 rounded" title="Télécharger">
                              <ArrowDownTrayIcon className="h-4 w-4 text-blue-600" />
                            </button>
                            {user?.role === 'admin' && (
                              <button onClick={() => { if (window.confirm('Supprimer?')) filesService.deleteFile(file.id).then(() => loadFiles()); }} className="p-2 hover:bg-red-100 rounded" title="Supprimer">
                                <TrashIcon className="h-4 w-4 text-red-600" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Colonne latérale Actions + Historique */}
            <div className="space-y-6">
              {/* Actions disponibles */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow border-2 border-warning-100 dark:border-neutral-700 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-warning-50 to-warning-100/50 border-b-2 border-warning-200">
                  <h4 className="text-lg font-bold text-warning-900 dark:text-neutral-100">Actions disponibles</h4>
                  <p className="text-xs text-warning-700 mt-1">{user?.role?.toUpperCase()} • {getStatusLabel(dossier.status || dossier.statut)}</p>
                </div>
                <div className="p-5 space-y-3">
                  {changingStatut && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-blue-700 text-sm font-medium">Traitement...</span>
                      </div>
                    </div>
                  )}
                  {availableActions.length === 0 ? (
                    <div className="text-center py-6 text-neutral-500">
                      <ExclamationTriangleIcon className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
                      <p className="text-sm">Aucune action disponible</p>
                    </div>
                  ) : (
                    availableActions.map((action) => (
                      <button
                        key={action.status || action.label}
                        onClick={() => handleStatusClick(action.status)}
                        disabled={changingStatut}
                        className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-between disabled:opacity-50"
                      >
                        <span>{action.label}</span>
                        <ArrowRightIcon className="h-4 w-4" />
                      </button>
                    ))
                  )}
                  {user?.role === 'livreur' && ['pret_livraison', 'termine'].includes(dossier.status) && (
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm"
                    >
                      Programmer livraison
                    </button>
                  )}
                  {user?.role === 'livreur' && dossier.status === 'en_livraison' && (
                    <button
                      onClick={() => setShowDeliveryModal(true)}
                      className="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm"
                    >
                      Valider livraison
                    </button>
                  )}
                </div>
              </div>

              {/* Historique Timeline */}
              <div className="bg-white dark:bg-neutral-800 rounded-xl shadow border-2 border-blue-100 dark:border-neutral-700 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-primary-100/50 border-b-2 border-primary-200">
                  <div className="flex items-center gap-3">
                    <ClockIcon className="h-5 w-5 text-primary-600" />
                    <h4 className="text-lg font-bold text-blue-900 dark:text-neutral-100">Historique</h4>
                  </div>
                </div>
                <div className="p-5">
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {statutHistory.length === 0 ? (
                      <div className="text-center py-8 text-neutral-500">
                        <ClockIcon className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
                        <p className="text-sm">Aucun historique</p>
                      </div>
                    ) : (
                      statutHistory.map((h, i) => {
                        const status = h.new_status || h.nouveau_statut || h.status;
                        const colorMap = {
                          en_cours: { bg: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-700' },
                          a_revoir: { bg: 'bg-amber-500', lightBg: 'bg-amber-50', text: 'text-amber-700' },
                          en_impression: { bg: 'bg-purple-500', lightBg: 'bg-purple-50', text: 'text-purple-700' },
                          termine: { bg: 'bg-emerald-600', lightBg: 'bg-emerald-50', text: 'text-emerald-700' },
                          pret_livraison: { bg: 'bg-indigo-500', lightBg: 'bg-indigo-50', text: 'text-indigo-700' },
                          en_livraison: { bg: 'bg-yellow-500', lightBg: 'bg-yellow-50', text: 'text-yellow-700' },
                          livre: { bg: 'bg-green-600', lightBg: 'bg-green-50', text: 'text-green-700' },
                        };
                        const colors = colorMap[status] || { bg: 'bg-neutral-400', lightBg: 'bg-gray-50', text: 'text-gray-700' };
                        return (
                          <div key={i} className={`${colors.lightBg} rounded-lg p-3 border-l-4 ${colors.bg.replace('bg-', 'border-')} shadow-sm`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`h-3 w-3 rounded-full ${colors.bg}`}></span>
                              <span className={`font-bold text-sm ${colors.text}`}>{getStatusLabel(status)}</span>
                            </div>
                            <div className="text-xs text-neutral-600">{formatDateTime(h.changed_at || h.date)}</div>
                            {h.changed_by_name && <div className="text-xs text-neutral-500 mt-1">par {h.changed_by_name}</div>}
                            {h.notes && <div className="mt-2 text-xs text-neutral-600 italic">{h.notes}</div>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-neutral-50 dark:bg-neutral-900 px-8 py-6 flex justify-end rounded-b-2xl border-t border-neutral-100">
            <button
              onClick={onClose}
              className="btn-secondary text-base font-semibold px-6 py-2 rounded-lg shadow transition-all duration-150"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* FileViewer */}
      <FileViewer
        file={selectedFile}
        isOpen={showFileViewer}
        onClose={() => {
          setShowFileViewer(false);
          setSelectedFile(null);
        }}
      />

      {/* Modal Review Comment */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setShowReviewModal(false)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              Marquer à revoir
            </h3>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Décrivez les corrections nécessaires..."
              className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowReviewModal(false); setReviewComment(''); }}
                className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300"
                disabled={changingStatut}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  handleStatusChange('a_revoir', reviewComment);
                  setReviewComment('');
                }}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                disabled={changingStatut || reviewComment.trim() === ''}
              >
                {changingStatut ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Schedule Delivery */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setShowScheduleModal(false)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              Programmer la livraison
            </h3>
            <label htmlFor="scheduleDate" className="block text-sm text-neutral-700 dark:text-neutral-200 mb-1">
              Date de livraison
            </label>
            <input
              id="scheduleDate"
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="form-input w-full border rounded-md px-3 py-2"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  await handleStatusChange('en_livraison');
                  setShowScheduleModal(false);
                }}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Programmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delivery */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setShowDeliveryModal(false)} />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              Valider la livraison
            </h3>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label htmlFor="deliveryDate" className="block text-sm text-neutral-700 dark:text-neutral-200 mb-1">
                  Date de livraison
                </label>
                <input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="form-input w-full border rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="paymentMode" className="block text-sm text-neutral-700 dark:text-neutral-200 mb-1">
                  Mode de paiement
                </label>
                <select
                  id="paymentMode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="form-input w-full border rounded-md px-3 py-2"
                >
                  <option>Wave</option>
                  <option>Orange Money</option>
                  <option>Virement bancaire</option>
                  <option>Chèque</option>
                  <option>Espèces</option>
                </select>
              </div>
              <div>
                <label htmlFor="paymentAmount" className="block text-sm text-neutral-700 dark:text-neutral-200 mb-1">
                  Montant payé (CFA)
                </label>
                <input
                  id="paymentAmount"
                  type="number"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="form-input w-full border rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  try {
                    await dossiersService.confirmDelivery(dossierId, {
                      date_livraison: deliveryDate,
                      mode_paiement: paymentMode,
                      montant_paye: Number(paymentAmount) || 0,
                    });
                    await loadDossierDetails();
                    setShowDeliveryModal(false);
                    setPaymentAmount('');
                  } catch (err) {
                    setError(err?.message || 'Erreur lors de la confirmation de livraison');
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

DossierDetailsFixed.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  dossierId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dossier: PropTypes.object,
  onStatusChange: PropTypes.func,
};

DossierDetailsFixed.defaultProps = {
  dossierId: null,
  dossier: null,
  onStatusChange: null,
};

export default DossierDetailsFixed;
