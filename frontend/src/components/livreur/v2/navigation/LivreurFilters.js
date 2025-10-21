/**
 * 🔍 LivreurFilters - Composant de filtres
 * Interface de filtrage et recherche pour les dossiers
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

const LivreurFilters = memo(({
  filters = {},
  onFiltersChange,
  resultCount = 0,
  totalCount = 0,
  onClose
}) => {

  const handleSearchChange = (value) => {
    onFiltersChange({ ...filters, searchTerm: value });
  };

  const handleStatusChange = (value) => {
    onFiltersChange({ ...filters, filterStatus: value });
  };

  const handleZoneChange = (value) => {
    onFiltersChange({ ...filters, filterZone: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      searchTerm: '',
      filterStatus: 'all',
      filterZone: 'all'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FunnelIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Filtres avancés</h3>
            <p className="text-xs text-gray-600">
              {resultCount} résultat{resultCount > 1 ? 's' : ''} sur {totalCount}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
        >
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Recherche */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={filters.searchTerm || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
        </div>

        {/* Filtre par statut */}
        <select
          value={filters.filterStatus || 'all'}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
        >
          <option value="all">Tous les statuts</option>
          <option value="imprime">Imprimé</option>
          <option value="pret_livraison">Prêt à livrer</option>
          <option value="en_livraison">En livraison</option>
          <option value="livre">Livré</option>
        </select>

        {/* Filtre par zone */}
        <select
          value={filters.filterZone || 'all'}
          onChange={(e) => handleZoneChange(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
        >
          <option value="all">Toutes les zones</option>
          <option value="paris">Paris</option>
          <option value="banlieue">Banlieue</option>
          <option value="idf">Île-de-France</option>
          <option value="autre">Autre région</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-600 font-medium">
          {resultCount} dossier{resultCount > 1 ? 's' : ''} correspond{resultCount > 1 ? 'ent' : ''} aux critères
        </div>
        <button
          onClick={clearFilters}
          className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 font-semibold"
        >
          Effacer les filtres
        </button>
      </div>
    </motion.div>
  );
});

LivreurFilters.displayName = 'LivreurFilters';

export default LivreurFilters;
