import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../../../services/apiAdapter';
import useRealtimeUpdates from '../../../hooks/useRealtimeUpdates';
import { SkeletonGrid } from '../../transitions/SkeletonCard';
import LoadingButton from '../../transitions/LoadingButton';
import DossierCard from '../../DossierCard';
import notificationService from '../../../services/notificationService';

const DossiersTab = ({ user, onNavigate }) => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  const normalizeStatus = (statut) => {
    if (!statut) return 'nouveau';
    const val = String(statut).toLowerCase();
    if (val.includes('cours')) return 'en_cours';
    if (val.includes('revoir')) return 'a_revoir';
    if (val.includes('pret') && val.includes('impression')) return 'pret_impression';
    if (val.includes('impression')) return 'en_impression';
    if (val.includes('pret') && val.includes('livraison')) return 'pret_livraison';
    if (val.includes('livraison')) return 'en_livraison';
    if (val.includes('livre')) return 'livre';
    if (val.includes('termine')) return 'termine';
    return val.replace(/\s/g, '_');
  };

  // Temps réel
  useRealtimeUpdates({
    onDossierCreated: (data) => {
      if (data.dossier) {
        setDossiers(prev => [data.dossier, ...prev]);
        notificationService.success('Nouveau dossier créé');
      }
    },
    onDossierStatusChanged: (data) => {
      setDossiers(prev => prev.map(d => 
        d.id === data.dossierId 
          ? { ...d, statut: data.newStatus, status: data.newStatus }
          : d
      ));
    },
    onDossierDeleted: (data) => {
      setDossiers(prev => prev.filter(d => d.id !== data.dossierId));
    },
  });

  const loadDossiers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dossiersService.getDossiers();
      const allDossiers = response.dossiers || [];
      
      const enrichedDossiers = allDossiers.map(d => ({
        ...d,
        status: normalizeStatus(d.statut || d.status),
      }));

      setDossiers(enrichedDossiers);
      notificationService.success(`${enrichedDossiers.length} dossier(s) chargé(s)`);
    } catch (error) {
      notificationService.error('Erreur lors du chargement des dossiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  // Filtrage et recherche
  const filteredDossiers = dossiers.filter(d => {
    const matchesSearch = searchTerm === '' || 
      (d.numero_dossier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.nom_client || d.client || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Grouper par statut
  const groupedDossiers = {
    nouveau: filteredDossiers.filter(d => d.status === 'nouveau'),
    en_cours: filteredDossiers.filter(d => d.status === 'en_cours' || d.status === 'a_revoir'),
    pret_impression: filteredDossiers.filter(d => d.status === 'pret_impression'),
    en_impression: filteredDossiers.filter(d => d.status === 'en_impression'),
    pret_livraison: filteredDossiers.filter(d => d.status === 'pret_livraison' || d.status === 'imprime'),
    en_livraison: filteredDossiers.filter(d => d.status === 'en_livraison'),
    termine: filteredDossiers.filter(d => d.status === 'livre' || d.status === 'termine'),
  };

  const sections = [
    { id: 'nouveau', label: 'Nouveaux', color: 'blue', dossiers: groupedDossiers.nouveau },
    { id: 'en_cours', label: 'En cours', color: 'yellow', dossiers: groupedDossiers.en_cours },
    { id: 'pret_impression', label: 'Prêt impression', color: 'purple', dossiers: groupedDossiers.pret_impression },
    { id: 'en_impression', label: 'En impression', color: 'indigo', dossiers: groupedDossiers.en_impression },
    { id: 'pret_livraison', label: 'Prêt livraison', color: 'green', dossiers: groupedDossiers.pret_livraison },
    { id: 'en_livraison', label: 'En livraison', color: 'orange', dossiers: groupedDossiers.en_livraison },
    { id: 'termine', label: 'Terminés', color: 'gray', dossiers: groupedDossiers.termine },
  ];

  if (loading) {
    return <SkeletonGrid count={6} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un dossier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Filtres */}
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="nouveau">Nouveaux</option>
              <option value="en_cours">En cours</option>
              <option value="pret_impression">Prêt impression</option>
              <option value="en_impression">En impression</option>
              <option value="pret_livraison">Prêt livraison</option>
              <option value="en_livraison">En livraison</option>
              <option value="termine">Terminés</option>
            </select>

            <LoadingButton
              icon={ArrowPathIcon}
              onClick={loadDossiers}
              variant="secondary"
              title="Actualiser"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>Total: <strong>{filteredDossiers.length}</strong></span>
          <span>•</span>
          <span>Actifs: <strong>{dossiers.filter(d => !['livre', 'termine'].includes(d.status)).length}</strong></span>
        </div>
      </div>

      {/* Sections groupées */}
      {sections.map(section => {
        if (section.dossiers.length === 0 && filterStatus !== 'all' && filterStatus !== section.id) {
          return null;
        }

        return (
          <div key={section.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {section.label}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${section.color}-100 text-${section.color}-800 dark:bg-${section.color}-900 dark:text-${section.color}-200`}>
                {section.dossiers.length}
              </span>
            </div>

            {section.dossiers.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8 bg-white dark:bg-gray-800 rounded-xl">
                Aucun dossier dans cette catégorie
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.dossiers.map((dossier, index) => (
                  <DossierCard
                    key={dossier.id}
                    dossier={dossier}
                    animationDelay={index * 0.05}
                    onView={(d) => {
                      // Implémenter navigation vers détails
                      onNavigate && onNavigate('dossier-details', d.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DossiersTab;
