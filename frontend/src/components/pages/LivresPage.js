import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, CheckCircleIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import api from '../../services/api';
import DeliveryCard from '../DeliveryCard';
import DossierDetails from '../dossiers/DossierDetails';
import useRealtimeUpdates from '../../hooks/useRealtimeUpdates';
import { SkeletonGrid } from '../transitions/SkeletonCard';

const LivresPage = () => {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const itemsPerPage = 12;

  // Mise à jour en temps réel
  useRealtimeUpdates({
    onDossierStatusChanged: (data) => {
      setDossiers(prevDossiers => {
        const status = (data.newStatus || '').toLowerCase();
        if (status === 'livre') {
          // Ajouter ou mettre à jour
          const exists = prevDossiers.find(d => d.id === data.dossierId);
          if (exists) {
            return prevDossiers.map(d => 
              d.id === data.dossierId 
                ? { ...d, status: data.newStatus, statut: data.newStatus }
                : d
            );
          } else if (data.dossier) {
            return [data.dossier, ...prevDossiers];
          }
        } else {
          // Retirer si le statut n'est plus "livre"
          return prevDossiers.filter(d => d.id !== data.dossierId);
        }
        return prevDossiers;
      });
    },
    onDossierUpdated: (data) => {
      if (data.dossier) {
        const status = (data.dossier.status || data.dossier.statut || '').toLowerCase();
        if (status === 'livre') {
          setDossiers(prevDossiers => {
            const exists = prevDossiers.find(d => d.id === data.dossierId);
            if (exists) {
              return prevDossiers.map(d => d.id === data.dossierId ? data.dossier : d);
            } else {
              return [data.dossier, ...prevDossiers];
            }
          });
        } else {
          setDossiers(prevDossiers => prevDossiers.filter(d => d.id !== data.dossierId));
        }
      }
    },
  });

  useEffect(() => {
    loadDossiers();
  }, []);

  const loadDossiers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dossiers?status=livre');
      setDossiers(response.data.dossiers || []);
    } catch (error) {
      // Erreur silencieuse
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage
  const filteredDossiers = dossiers.filter(d => {
    const matchSearch = !searchTerm || 
      d.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.numero_dossier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.adresse_livraison?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterPeriod === 'all') return matchSearch;
    
    const dossierDate = d.date_livraison ? new Date(d.date_livraison) : null;
    if (!dossierDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (filterPeriod === 'today') {
      const dosDate = new Date(dossierDate);
      dosDate.setHours(0, 0, 0, 0);
      return matchSearch && dosDate.getTime() === today.getTime();
    }
    
    if (filterPeriod === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return matchSearch && dossierDate >= weekAgo;
    }
    
    if (filterPeriod === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return matchSearch && dossierDate >= monthAgo;
    }
    
    return matchSearch;
  });

  // Tri par date décroissante
  const sortedDossiers = [...filteredDossiers].sort((a, b) => {
    const dateA = a.date_livraison ? new Date(a.date_livraison) : new Date(0);
    const dateB = b.date_livraison ? new Date(b.date_livraison) : new Date(0);
    return dateB - dateA;
  });

  // Pagination
  const totalPages = Math.ceil(sortedDossiers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDossiers = sortedDossiers.slice(startIndex, startIndex + itemsPerPage);

  const openDetails = (dossier) => {
    setSelectedDossier(dossier);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-emerald-200 dark:border-emerald-800 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-green-400/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-teal-400/20 to-emerald-400/20 rounded-full blur-3xl"></div>
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-lg">
                <CheckCircleIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-neutral-800 dark:text-white">
                  Livrés
                </h1>
                <p className="text-neutral-600 dark:text-neutral-300 mt-1">
                  {sortedDossiers.length} dossier{sortedDossiers.length > 1 ? 's' : ''} livré{sortedDossiers.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recherche */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher par client, numéro ou adresse..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:bg-neutral-700 dark:text-white"
            />
          </div>

          {/* Filtre Période */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <select
              value={filterPeriod}
              onChange={(e) => {
                setFilterPeriod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:bg-neutral-700 dark:text-white appearance-none"
            >
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des dossiers */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-300">Chargement...</p>
        </div>
      ) : paginatedDossiers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
          <CheckCircleIcon className="h-16 w-16 mx-auto text-neutral-300 dark:text-neutral-600 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-300">Aucun dossier livré</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {paginatedDossiers.map((dossier) => (
              <DeliveryCard
                key={dossier.id}
                dossier={dossier}
                onOpenDetails={openDetails}
                actions={
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CalendarIcon className="h-4 w-4" />
                    {dossier.date_livraison ? 
                      new Date(dossier.date_livraison).toLocaleDateString('fr-FR') : 
                      'Date non renseignée'
                    }
                  </div>
                }
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-neutral-300 dark:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
              >
                Précédent
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'bg-white dark:bg-gray-800 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-neutral-300 dark:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-gray-700 transition-colors"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Détails */}
      {showDetails && selectedDossier && (
        <DossierDetails
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedDossier(null);
            loadDossiers();
          }}
          dossier={selectedDossier}
          dossierId={selectedDossier.id}
        />
      )}
    </div>
  );
};

export default LivresPage;
