import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  FolderIcon,
  DocumentIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useDossier } from '../../hooks/useDossierSync';
import { useFiles } from '../../hooks/useFiles';
import FileUploadImproved from '../files/FileUploadImproved';
import FileManagerImproved from '../files/FileManagerImproved';
import { DossierIdResolver } from '../../services/dossierIdResolver';
import { errorHandler } from '../../services/errorHandlerService';

/**
 * Composant complet de gestion de dossier avec fichiers intégrés
 * Utilise le nouveau système unifié de synchronisation
 */
const DossierWithFilesManager = ({ 
  dossierLike,
  userRole = 'user',
  allowFileUpload = true,
  allowFileDownload = true,
  allowFileDelete = false,
  showFileStats = true,
  onDossierUpdate
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Résolution de l'identifiant dossier
  const dossierId = DossierIdResolver.resolve(dossierLike);

  // Hooks pour la gestion du dossier et des fichiers
  const { 
    dossier, 
    loading: dossierLoading, 
    error: dossierError, 
    refresh: refreshDossier 
  } = useDossier(dossierId);
  
  const { 
    files, 
    loading: filesLoading, 
    error: filesError, 
    refresh: refreshFiles 
  } = useFiles(dossier);

  // Gestion des erreurs combinées
  const hasErrors = dossierError || filesError;
  const isLoading = dossierLoading || filesLoading;

  // Vérification des permissions
  const canUpload = React.useMemo(() => {
    if (!allowFileUpload || !dossier) return false;
    
    try {
      errorHandler.validateDossierAccess(dossier, 'upload', userRole);
      return true;
    } catch {
      return false;
    }
  }, [allowFileUpload, dossier, userRole]);

  const canDelete = React.useMemo(() => {
    if (!allowFileDelete || !dossier) return false;
    
    try {
      errorHandler.validateDossierAccess(dossier, 'delete', userRole);
      return true;
    } catch {
      return false;
    }
  }, [allowFileDelete, dossier, userRole]);

  // Gestionnaires d'événements
  const handleFileUpload = async (uploadedFiles) => {
    console.log('Fichiers uploadés:', uploadedFiles);
    
    // Actualiser les données
    await Promise.all([
      refreshDossier(),
      refreshFiles()
    ]);
    
    // Callback parent
    if (onDossierUpdate) {
      onDossierUpdate(dossier, 'files_uploaded', uploadedFiles);
    }
    
    setShowUploadModal(false);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshDossier(),
      refreshFiles()
    ]);
  };

  // Statistiques du dossier
  const dossierStats = React.useMemo(() => {
    if (!dossier || !files) return null;
    
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const recentFiles = files.filter(file => {
      if (!file.created_at) return false;
      const fileDate = new Date(file.created_at);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return fileDate > dayAgo;
    }).length;

    return {
      totalFiles,
      totalSize,
      recentFiles,
      status: dossier.statut,
      canModify: canUpload || canDelete
    };
  }, [dossier, files, canUpload, canDelete]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    const colors = {
      'nouveau': 'blue',
      'en_preparation': 'yellow',
      'valide': 'green',
      'en_impression': 'purple',
      'termine': 'green',
      'pret_livraison': 'indigo',
      'livre': 'emerald',
      'a_revoir': 'red'
    };
    return colors[status] || 'gray';
  };

  if (!dossierId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-6 w-6 text-orange-500 mr-3" />
          <div>
            <h3 className="font-medium text-yellow-800">Identifiant dossier requis</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Veuillez fournir un dossier valide pour accéder à cette fonctionnalité.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      
      {/* En-tête du dossier */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FolderIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                {dossier?.numero_commande || dossier?.nom || `Dossier ${dossierId}`}
              </h2>
              <div className="flex items-center mt-1 space-x-4">
                {dossier?.statut && (
                  <span className={`
                    px-3 py-1 rounded-full text-sm font-medium
                    bg-${getStatusColor(dossier.statut)}-100 
                    text-${getStatusColor(dossier.statut)}-800
                  `}>
                    {dossier.statut.replace(/_/g, ' ')}
                  </span>
                )}
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  ID: {dossierId}
                </span>
                {dossier?.created_at && (
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">
                    Créé: {new Date(dossier.created_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefreshAll}
              disabled={isLoading}
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-white dark:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
              title="Actualiser"
            >
              🔄
            </button>
            
            {canUpload && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                Ajouter fichiers
              </button>
            )}
          </div>
        </div>

        {/* Statistiques rapides */}
        {dossierStats && (
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{dossierStats.totalFiles}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-300">Fichiers</div>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-success-600">
                {formatFileSize(dossierStats.totalSize)}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-300">Taille totale</div>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-purple-600">{dossierStats.recentFiles}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-300">Récents (24h)</div>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-center shadow-sm">
              <div className="flex items-center justify-center">
                {dossierStats.canModify ? (
                  <CheckCircleIcon className="h-6 w-6 text-success-500" />
                ) : (
                  <XCircleIcon className="h-6 w-6 text-error-500" />
                )}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-300">Modification</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation par onglets */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('overview')}
            className={`
              px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:border-neutral-600'
              }
            `}
          >
            <InformationCircleIcon className="h-4 w-4 inline mr-2" />
            Vue d&apos;ensemble
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`
              px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'files'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:border-neutral-600'
              }
            `}
          >
            <DocumentIcon className="h-4 w-4 inline mr-2" />
            Fichiers ({files?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`
              px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:border-neutral-600'
              }
            `}
          >
            <Cog6ToothIcon className="h-4 w-4 inline mr-2" />
            Paramètres
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="p-6">
        
        {/* Gestion des erreurs */}
        {hasErrors && (
          <div className="mb-6 bg-error-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-error-500 mr-2" />
              <div>
                <h4 className="font-medium text-red-800">Erreurs détectées</h4>
                <div className="text-sm text-error-700 mt-1 space-y-1">
                  {dossierError && <div>Dossier: {dossierError}</div>}
                  {filesError && <div>Fichiers: {filesError}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-neutral-600 dark:text-neutral-300">Chargement des données...</span>
          </div>
        )}

        {/* Onglet Vue d'ensemble */}
        {activeTab === 'overview' && !isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Informations du dossier */}
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
                <h3 className="font-medium text-neutral-900 dark:text-white mb-3">Informations du dossier</h3>
                <div className="space-y-2 text-sm">
                  {dossier?.numero_commande && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300">N° Commande:</span>
                      <span className="font-medium">{dossier.numero_commande}</span>
                    </div>
                  )}
                  {dossier?.client_nom && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300">Client:</span>
                      <span className="font-medium">{dossier.client_nom}</span>
                    </div>
                  )}
                  {dossier?.type_impression && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300">Type:</span>
                      <span className="font-medium">{dossier.type_impression}</span>
                    </div>
                  )}
                  {dossier?.quantite && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300">Quantité:</span>
                      <span className="font-medium">{dossier.quantite}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistiques des fichiers */}
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
                <h3 className="font-medium text-neutral-900 dark:text-white mb-3">Statistiques des fichiers</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">Nombre de fichiers:</span>
                    <span className="font-medium">{files?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">Taille totale:</span>
                    <span className="font-medium">
                      {dossierStats ? formatFileSize(dossierStats.totalSize) : '0 B'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-300">Fichiers récents:</span>
                    <span className="font-medium">{dossierStats?.recentFiles || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-neutral-900 dark:text-white mb-3">Actions rapides</h3>
              <div className="flex flex-wrap gap-2">
                {canUpload && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ajouter fichiers
                  </button>
                )}
                <button
                  onClick={handleRefreshAll}
                  className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
                >
                  Actualiser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Fichiers */}
        {activeTab === 'files' && !isLoading && (
          <div>
            <FileManagerImproved
              dossier={dossier}
              onUpload={canUpload ? () => setShowUploadModal(true) : null}
              onFileSelect={handleFileSelect}
              allowDelete={canDelete}
              allowDownload={allowFileDownload}
              showStats={showFileStats}
            />
          </div>
        )}

        {/* Onglet Paramètres */}
        {activeTab === 'settings' && !isLoading && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-neutral-900 dark:text-white mb-3">Permissions utilisateur</h3>
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Rôle utilisateur:</span>
                  <span className="font-medium">{userRole}</span>
                </div>
                <div className="flex justify-between">
                  <span>Upload de fichiers:</span>
                  <span className={canUpload ? 'text-success-600' : 'text-error-600'}>
                    {canUpload ? 'Autorisé' : 'Non autorisé'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Suppression de fichiers:</span>
                  <span className={canDelete ? 'text-success-600' : 'text-error-600'}>
                    {canDelete ? 'Autorisé' : 'Non autorisé'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Téléchargement de fichiers:</span>
                  <span className={allowFileDownload ? 'text-success-600' : 'text-error-600'}>
                    {allowFileDownload ? 'Autorisé' : 'Non autorisé'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal d'upload */}
      {showUploadModal && (
        <FileUploadImproved
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleFileUpload}
          dossier={dossier}
          autoClose={true}
        />
      )}
    </div>
  );
};

DossierWithFilesManager.propTypes = {
  dossierLike: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.object
  ]).isRequired,
  userRole: PropTypes.string,
  allowFileUpload: PropTypes.bool,
  allowFileDownload: PropTypes.bool,
  allowFileDelete: PropTypes.bool,
  showFileStats: PropTypes.bool,
  onDossierUpdate: PropTypes.func
};

export default DossierWithFilesManager;