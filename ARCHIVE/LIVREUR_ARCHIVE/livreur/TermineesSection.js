import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FunnelIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import DossierCard from './DossierCard';
import notificationService from '../../services/notificationService';

const TermineesSection = ({ dossiers, onVoirDetails }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    machine: 'all',
    payment: 'all',
    search: '',
  });

  const getPaymentMode = (d) =>
    d.mode_paiement || d.payment_mode || d.paiement || d.modePaiement || '';

  // Filtrage
  const filteredDossiers = dossiers.filter(d => {
    const q = (filters.search || '').toLowerCase();
    const client = (d.client || d.client_nom || '').toLowerCase();
    const numero = (d.numero_commande || d.numero || `${d.id || ''}`).toLowerCase();
    const dateDelivered = new Date(d.date_livraison || d.updated_at || d.created_at);
    const type = (d.type_formulaire || '').toLowerCase();
    const pmode = (getPaymentMode(d) || '').toLowerCase();

    const matchesSearch = !q || client.includes(q) || numero.includes(q);
    const matchesMachine = filters.machine === 'all' || type.includes(filters.machine);
    const matchesPayment = filters.payment === 'all' || pmode === filters.payment.toLowerCase();
    const matchesStart = !filters.startDate || dateDelivered >= new Date(filters.startDate);
    const matchesEnd = !filters.endDate || dateDelivered <= new Date(`${filters.endDate}T23:59:59`);

    return matchesSearch && matchesMachine && matchesPayment && matchesStart && matchesEnd;
  });

  // Export CSV
  const downloadCSV = () => {
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

      const rows = filteredDossiers.map(d => [
        d.numero_commande || d.numero || d.id,
        (d.client || d.client_nom || '').toString().replace(/\n/g, ' '),
        d.type_formulaire || '',
        d.date_livraison_prevue ? new Date(d.date_livraison_prevue).toLocaleString() : '',
        d.date_livraison
          ? new Date(d.date_livraison).toLocaleString()
          : d.updated_at
            ? new Date(d.updated_at).toLocaleString()
            : '',
        getPaymentMode(d),
        d.montant_encaisse || d.montant_cfa || 0,
        (d.adresse_livraison || '').toString().replace(/\n/g, ' '),
      ]);

      const csv = [headers.join(';')]
        .concat(
          rows.map(r =>
            r
              .map(v =>
                typeof v === 'string' && v.includes(';') ? `"${v.replace(/"/g, '""')}"` : v
              )
              .join(';')
          )
        )
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `livraisons_terminees_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notificationService.success('Export CSV téléchargé');
    } catch (e) {
      notificationService.error('Impossible de générer le CSV');
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      machine: 'all',
      payment: 'all',
      search: '',
    });
  };

  const hasActiveFilters =
    filters.startDate ||
    filters.endDate ||
    filters.machine !== 'all' ||
    filters.payment !== 'all' ||
    filters.search;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 border border-neutral-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              ✅ Livraisons terminées
              <span className="text-lg font-normal text-neutral-500 dark:text-neutral-400 ml-3">
                ({filteredDossiers.length})
              </span>
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 mt-2">Historique des livraisons effectuées</p>
          </div>
          <button
            onClick={downloadCSV}
            className="px-6 py-3 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-lg dark:shadow-secondary-900/25 border border-neutral-100">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Filtres</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Date min</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Date max</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Machine</label>
            <select
              value={filters.machine}
              onChange={e => setFilters(prev => ({ ...prev, machine: e.target.value }))}
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
              value={filters.payment}
              onChange={e => setFilters(prev => ({ ...prev, payment: e.target.value }))}
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
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Client ou n° dossier"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">{filteredDossiers.length} résultat(s)</span>
            <button
              onClick={clearFilters}
              className="text-sm text-emerald-600 hover:underline font-medium"
            >
              Effacer filtres
            </button>
          </div>
        )}
      </div>

      {/* Grid de cartes */}
      {filteredDossiers.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-12 shadow-lg dark:shadow-secondary-900/25 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-neutral-600 dark:text-neutral-300 mb-2">
            {hasActiveFilters ? 'Aucun résultat' : 'Aucune livraison terminée'}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400">
            {hasActiveFilters
              ? 'Essayez de modifier vos filtres'
              : 'Aucune livraison finalisée pour le moment'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredDossiers.map((dossier, index) => (
              <DossierCard
                key={dossier.id}
                dossier={dossier}
                index={index}
                onVoirDetails={onVoirDetails}
                type="terminees"
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default TermineesSection;
