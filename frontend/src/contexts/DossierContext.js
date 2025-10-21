import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from './AuthContext';

const DossierContext = createContext();

export const useDossiers = () => {
  const context = useContext(DossierContext);
  if (!context) {
    throw new Error('useDossiers doit être utilisé dans un DossierProvider');
  }
  return context;
};

export const DossierProvider = ({ children }) => {
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState([]);
  const [currentDossier, setCurrentDossier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  // URL de l'API
  const API_URL = process.env.REACT_APP_API_URL || '/api';

  /**
   * Gestion de la synchronisation temps réel avec Socket.IO
   */

  // Callback quand un nouveau dossier est créé
  const handleDossierCreated = useCallback(({ dossier }) => {
    console.log('🆕 Nouveau dossier créé:', dossier);
    setDossiers(prev => [dossier, ...prev]);
  }, []);

  // Callback quand un dossier est mis à jour
  const handleDossierUpdated = useCallback(({ dossier, changes }) => {
    console.log('✏️ Dossier mis à jour:', dossier, 'Changements:', changes);
    setDossiers(prev =>
      prev.map(d => (d.id === dossier.id || d.folder_id === dossier.folder_id ? dossier : d))
    );

    // Mettre à jour le dossier courant si c'est celui-là
    setCurrentDossier(prev => {
      if (prev && (prev.id === dossier.id || prev.folder_id === dossier.folder_id)) {
        return dossier;
      }
      return prev;
    });
  }, []);

  // Callback quand un dossier est supprimé
  const handleDossierDeleted = useCallback(({ folderId }) => {
    console.log('🗑️ Dossier supprimé:', folderId);
    setDossiers(prev => prev.filter(d => d.folder_id !== folderId && d.id !== folderId));

    // Réinitialiser le dossier courant si c'est celui-là
    setCurrentDossier(prev => {
      if (prev && (prev.folder_id === folderId || prev.id === folderId)) {
        return null;
      }
      return prev;
    });
  }, []);

  // Callback quand un statut change
  const handleStatusChanged = useCallback(({ folderId, oldStatus, newStatus, dossier }) => {
    console.log(`📊 Statut changé pour ${folderId}: ${oldStatus} → ${newStatus}`);
    if (dossier) {
      setDossiers(prev =>
        prev.map(d => (d.folder_id === folderId || d.id === folderId ? dossier : d))
      );

      setCurrentDossier(prev => {
        if (prev && (prev.folder_id === folderId || prev.id === folderId)) {
          return dossier;
        }
        return prev;
      });
    }
  }, []);

  // Callback quand un fichier est uploadé
  const handleFileUploaded = useCallback(({ folderId, file }) => {
    console.log('📤 Fichier uploadé:', file, 'Dossier:', folderId);

    // Mettre à jour le dossier courant si c'est celui-là
    setCurrentDossier(prev => {
      if (prev && (prev.folder_id === folderId || prev.id === folderId)) {
        return {
          ...prev,
          fichiers: [...(prev.fichiers || []), file],
        };
      }
      return prev;
    });
  }, []);

  // Callback quand un fichier est supprimé
  const handleFileDeleted = useCallback(({ folderId, fileId }) => {
    console.log('🗑️ Fichier supprimé:', fileId, 'Dossier:', folderId);

    // Mettre à jour le dossier courant si c'est celui-là
    setCurrentDossier(prev => {
      if (prev && (prev.folder_id === folderId || prev.id === folderId)) {
        return {
          ...prev,
          fichiers: (prev.fichiers || []).filter(f => f.id !== fileId),
        };
      }
      return prev;
    });
  }, []);

  // Initialiser Socket.IO avec tous les callbacks
  const { joinAllDossiers, leaveAllDossiers, joinDossier, leaveDossier } = useSocket({
    onDossierCreated: handleDossierCreated,
    onDossierUpdated: handleDossierUpdated,
    onDossierDeleted: handleDossierDeleted,
    onStatusChanged: handleStatusChanged,
    onFileUploaded: handleFileUploaded,
    onFileDeleted: handleFileDeleted,
    enabled: !!user, // Activer Socket.IO seulement si l'utilisateur est connecté
  });

  // Rejoindre la room de tous les dossiers au montage
  useEffect(() => {
    if (user) {
      joinAllDossiers();
      return () => leaveAllDossiers();
    }
  }, [user, joinAllDossiers, leaveAllDossiers]);

  /**
   * Récupérer la liste des dossiers
   */
  const fetchDossiers = useCallback(
    async (filters = {}) => {
      setLoading(true);
      setError(null);

      try {
        const params = {
          page: filters.page || pagination.page,
          limit: filters.limit || pagination.limit,
          ...filters,
        };

        const response = await axios.get(`${API_URL}/dossiers`, {
          params,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (response.data.success) {
          setDossiers(response.data.dossiers || []);
          setPagination(response.data.pagination || pagination);
        } else {
          throw new Error(response.data.message || 'Erreur lors de la récupération des dossiers');
        }
      } catch (err) {
        console.error('Erreur fetchDossiers:', err);
        setError(err.response?.data?.message || err.message || 'Erreur serveur');
      } finally {
        setLoading(false);
      }
    },
    [API_URL, pagination]
  );

  /**
   * Récupérer un dossier par son folder_id (UUID)
   */
  const fetchDossierById = useCallback(
    async folderId => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_URL}/dossiers/${folderId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (response.data.success) {
          const dossier = response.data.dossier;
          setCurrentDossier(dossier);

          // Rejoindre la room Socket.IO de ce dossier
          joinDossier(dossier.folder_id || dossier.id);

          return dossier;
        } else {
          throw new Error(response.data.message || 'Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation pour cette action');
        }
      } catch (err) {
        console.error('Erreur fetchDossierById:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur serveur';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [API_URL, joinDossier]
  );

  /**
   * Créer un nouveau dossier
   */
  const createDossier = useCallback(
    async dossierData => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.post(`${API_URL}/dossiers`, dossierData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.success) {
          const newDossier = response.data.dossier;
          // Socket.IO mettra à jour automatiquement via handleDossierCreated
          return newDossier;
        } else {
          throw new Error(response.data.message || 'Erreur lors de la création du dossier');
        }
      } catch (err) {
        console.error('Erreur createDossier:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur serveur';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [API_URL]
  );

  /**
   * Mettre à jour un dossier
   */
  const updateDossier = useCallback(
    async (folderId, updates) => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.put(`${API_URL}/dossiers/${folderId}`, updates, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.success) {
          const updatedDossier = response.data.dossier;
          // Socket.IO mettra à jour automatiquement via handleDossierUpdated
          return updatedDossier;
        } else {
          throw new Error(response.data.message || 'Erreur lors de la mise à jour du dossier');
        }
      } catch (err) {
        console.error('Erreur updateDossier:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur serveur';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [API_URL]
  );

  /**
   * Supprimer un dossier
   */
  const deleteDossier = useCallback(
    async folderId => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.delete(`${API_URL}/dossiers/${folderId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (response.data.success) {
          // Socket.IO mettra à jour automatiquement via handleDossierDeleted
          return true;
        } else {
          throw new Error(response.data.message || 'Erreur lors de la suppression du dossier');
        }
      } catch (err) {
        console.error('Erreur deleteDossier:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur serveur';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [API_URL]
  );

  /**
   * Changer le statut d'un dossier
   */
  const changeStatus = useCallback(
    async (folderId, newStatus, commentaire = null) => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.put(
          `${API_URL}/dossiers/${folderId}/statut`,
          { nouveau_statut: newStatus, commentaire },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.success) {
          // Socket.IO mettra à jour automatiquement via handleStatusChanged
          return response.data.dossier;
        } else {
          throw new Error(response.data.message || 'Erreur lors du changement de statut');
        }
      } catch (err) {
        console.error('Erreur changeStatus:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur serveur';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [API_URL]
  );

  /**
   * Upload de fichiers
   */
  const uploadFiles = useCallback(
    async (folderId, files) => {
      setLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const response = await axios.post(`${API_URL}/dossiers/${folderId}/fichiers`, formData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          // Socket.IO mettra à jour automatiquement via handleFileUploaded
          return response.data.files;
        } else {
          throw new Error(response.data.message || "Erreur lors de l'upload des fichiers");
        }
      } catch (err) {
        console.error('Erreur uploadFiles:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur serveur';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [API_URL]
  );

  const value = {
    dossiers,
    currentDossier,
    loading,
    error,
    pagination,
    fetchDossiers,
    fetchDossierById,
    createDossier,
    updateDossier,
    deleteDossier,
    changeStatus,
    uploadFiles,
    setCurrentDossier,
    joinDossier,
    leaveDossier,
  };

  return <DossierContext.Provider value={value}>{children}</DossierContext.Provider>;
};

export default DossierContext;
