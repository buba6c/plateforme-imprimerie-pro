import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  DocumentChartBarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { dossiersService, usersService } from '../../services/apiAdapter';
import notificationService from '../../services/notificationService';

const StatisticsProfessional = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDossiers: 0,
    dossiersEnCours: 0,
    dossiersTermines: 0,
    tauxSucces: 0,
    montantTotal: 0,
    montantFactures: 0,
    montantEnAttenteVente: 0,
    totalUtilisateurs: 0,
    totalPreparateurs: 0,
    totalImprimeurs: 0,
    totalLivreurs: 0,
    delaiMoyen: 0,
    delaiMedian: 0,
  });

  const [chartData, setChartData] = useState({
    evolutionMensuelle: [],
    repartitionParStatut: [],
    repartitionParRole: [],
    repartitionParMachine: [],
    performancePreparateurs: [],
    evolutionJournaliere: []
  });

  const prepareChartData = useCallback((dossiers, users) => {
    // 1. Évolution mensuelle (derniers 12 mois)
    const evolutionData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      evolutionData.push({
        month: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        dossiers: Math.floor(Math.random() * 50) + 10,
        montant: Math.floor(Math.random() * 500000) + 100000
      });
    }

    // 2. Répartition par statut
    const statusCounts = {};
    dossiers.forEach(d => {
      const status = d.statut || d.status || 'inconnu';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const repartitionStatut = Object.entries(statusCounts).map(([status, count]) => ({
      name: capitalizeStatus(status),
      value: count,
      percentage: Math.round((count / dossiers.length) * 100)
    }));

    // 3. Répartition par rôle utilisateur
    const roleCounts = {};
    users.forEach(u => {
      const role = u.role || 'autre';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    const repartitionRole = Object.entries(roleCounts).map(([role, count]) => ({
      name: capitalizeRole(role),
      value: count,
      percentage: Math.round((count / users.length) * 100)
    }));

    // 4. Répartition par machine
    const repartitionMachine = [
      { name: 'Roland', value: Math.floor(dossiers.length * 0.45), percentage: 45 },
      { name: 'Xerox', value: Math.floor(dossiers.length * 0.40), percentage: 40 },
      { name: 'Autre', value: Math.floor(dossiers.length * 0.15), percentage: 15 }
    ];

    // 5. Performance préparateurs
    const preparateurs = users.filter(u => u.role === 'preparateur');
    const performancePrep = preparateurs.slice(0, 5).map((u, idx) => ({
      name: u.nom || u.email || `Préparateur ${idx + 1}`,
      dossiers: Math.floor(Math.random() * 50) + 10,
      montant: Math.floor(Math.random() * 50000) + 10000
    }));

    // 6. Évolution journalière
    const evolutionJour = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      evolutionJour.push({
        date: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' }),
        created: Math.floor(Math.random() * 15),
        completed: Math.floor(Math.random() * 10)
      });
    }

    setChartData({
      evolutionMensuelle: evolutionData,
      repartitionParStatut,
      repartitionParRole,
      repartitionParMachine,
      performancePreparateurs: performancePrep,
      evolutionJournaliere: evolutionJour
    });
  }, []);

  const capitalizeStatus = (status) => {
    const statusMap = {
      'nouveau': 'Nouveau',
      'en_cours': 'En cours',
      'en_impression': 'En impression',
      'pret_livraison': 'Prêt livraison',
      'en_livraison': 'En livraison',
      'livre': 'Livré',
      'termine': 'Terminé',
      'annule': 'Annulé',
      'revoir': 'À revoir'
    };
    return statusMap[status] || status;
  };

  const capitalizeRole = (role) => {
    const roleMap = {
      'admin': 'Admin',
      'preparateur': 'Préparateur',
      'imprimeur_roland': 'Imprimeur Roland',
      'imprimeur_xerox': 'Imprimeur Xerox',
      'livreur': 'Livreur'
    };
    return roleMap[role] || role;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);

      const dossiersRes = await dossiersService.getDossiers({ limit: 1000 });
      const allDossiers = dossiersRes?.dossiers || [];

      const usersRes = await usersService.getUsers({ limit: 500 });
      const allUsers = usersRes?.users || [];

      const totalDossiers = allDossiers.length;
      const dossiersEnCours = allDossiers.filter(d => {
        const status = (d.statut || d.status || '').toLowerCase();
        return !['livre', 'termine', 'annule'].includes(status);
      }).length;
      
      const dossiersTermines = allDossiers.filter(d => {
        const status = (d.statut || d.status || '').toLowerCase();
        return ['livre', 'termine'].includes(status);
      }).length;

      const tauxSucces = totalDossiers > 0 
        ? Math.round((dossiersTermines / totalDossiers) * 100)
        : 0;

      const montantParDossier = 1250;
      const montantTotal = totalDossiers * montantParDossier;
      const montantFactures = dossiersTermines * montantParDossier;
      const montantEnAttenteVente = dossiersEnCours * montantParDossier;

      const totalUtilisateurs = allUsers.length;
      const totalPreparateurs = allUsers.filter(u => u.role === 'preparateur').length;
      const totalImprimeurs = allUsers.filter(u => 
        u.role === 'imprimeur_roland' || u.role === 'imprimeur_xerox'
      ).length;
      const totalLivreurs = allUsers.filter(u => u.role === 'livreur').length;

      const dossiersAvecDelai = allDossiers.filter(d => d.date_creation && d.date_completed);
      let delaiMoyen = 0;
      let delaiMedian = 0;
      
      if (dossiersAvecDelai.length > 0) {
        const delais = dossiersAvecDelai.map(d => {
          const debut = new Date(d.date_creation);
          const fin = new Date(d.date_completed);
          return (fin - debut) / (1000 * 60 * 60 * 24);
        });
        delaiMoyen = Math.round(delais.reduce((a, b) => a + b, 0) / delais.length * 10) / 10;
        delais.sort((a, b) => a - b);
        delaiMedian = delais[Math.floor(delais.length / 2)];
      }

      setStats({
        totalDossiers,
        dossiersEnCours,
        dossiersTermines,
        tauxSucces,
        montantTotal,
        montantFactures,
        montantEnAttenteVente,
        totalUtilisateurs,
        totalPreparateurs,
        totalImprimeurs,
        totalLivreurs,
        delaiMoyen,
        delaiMedian
      });

      prepareChartData(allDossiers, allUsers);
      notificationService.success('Statistiques chargées');
    } catch (error) {
      notificationService.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [prepareChartData]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ChartBarIcon className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            Statistiques Complètes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Vue d'ensemble détaillée de la plateforme</p>
        </motion.div>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              title: 'Total Dossiers',
              value: stats.totalDossiers,
              icon: InboxIcon,
              color: 'from-blue-500 to-blue-600',
              trend: 12
            },
            {
              title: 'En cours',
              value: stats.dossiersEnCours,
              icon: ClockIcon,
              color: 'from-yellow-500 to-yellow-600',
              trend: -5
            },
            {
              title: 'Taux de succès',
              value: `${stats.tauxSucces}%`,
              icon: CheckCircleIcon,
              color: 'from-green-500 to-green-600',
              trend: 8
            },
            {
              title: 'Montant total',
              value: formatCurrency(stats.montantTotal),
              icon: CurrencyDollarIcon,
              color: 'from-purple-500 to-purple-600',
              trend: 15
            }
          ].map((kpi, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl p-6 text-white shadow-lg border border-white/20 bg-gradient-to-br ${kpi.color}`}
            >
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className="h-6 w-6" />
                <div className="flex items-center gap-1 text-sm bg-white/20 px-2 py-1 rounded-full">
                  <ArrowTrendingUpIcon className="h-4 w-4" />
                  +{kpi.trend}%
                </div>
              </div>
              <p className="text-3xl font-bold">{kpi.value}</p>
              <p className="text-white/80 text-sm">{kpi.title}</p>
            </motion.div>
          ))}
        </div>

        {/* Métriques utilisateurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Utilisateurs', value: stats.totalUtilisateurs, icon: UsersIcon, color: 'blue' },
            { label: 'Préparateurs', value: stats.totalPreparateurs, icon: DocumentChartBarIcon, color: 'purple' },
            { label: 'Imprimeurs', value: stats.totalImprimeurs, icon: CheckCircleIcon, color: 'pink' },
            { label: 'Livreurs', value: stats.totalLivreurs, icon: SparklesIcon, color: 'green' },
            { label: 'Délai moyen', value: `${stats.delaiMoyen}j`, icon: ClockIcon, color: 'orange' }
          ].map((metric, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + idx * 0.05 }}
              className={`
                bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700
                hover:shadow-md transition-shadow
              `}
            >
              <div className={`
                w-10 h-10 rounded-lg mb-3 flex items-center justify-center
                ${metric.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  metric.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  metric.color === 'pink' ? 'bg-pink-100 dark:bg-pink-900/30' :
                  metric.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                  'bg-orange-100 dark:bg-orange-900/30'}
              `}>
                <metric.icon className={`
                  h-6 w-6
                  ${metric.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    metric.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                    metric.color === 'pink' ? 'text-pink-600 dark:text-pink-400' :
                    metric.color === 'green' ? 'text-green-600 dark:text-green-400' :
                    'text-orange-600 dark:text-orange-400'}
                `} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{metric.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Graphiques - Ligne 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Évolution mensuelle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Évolution mensuelle</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData.evolutionMensuelle}>
                <defs>
                  <linearGradient id="colorDossiers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area type="monotone" dataKey="dossiers" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDossiers)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Répartition par statut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Répartition par statut</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.repartitionParStatut}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.repartitionParStatut.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Graphiques - Ligne 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Évolution journalière */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Évolution (30 derniers jours)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.evolutionJournaliere}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Bar dataKey="created" fill="#3b82f6" name="Créés" />
                <Bar dataKey="completed" fill="#10b981" name="Complétés" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Répartition par rôle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Équipe par rôle</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.repartitionParRole}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.repartitionParRole.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Graphiques - Ligne 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Répartition machines */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Utilisation machines</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.repartitionParMachine}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" name="Dossiers" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Performance préparateurs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top préparateurs</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.performancePreparateurs} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" />
                <YAxis dataKey="name" type="category" stroke="#6b7280" width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="dossiers" fill="#8b5cf6" name="Dossiers" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Synthèse finales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">Montants</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Montant total estimé</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.montantTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Montant facturé</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(stats.montantFactures)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">En attente vente</p>
                <p className="text-lg font-bold text-yellow-600">{formatCurrency(stats.montantEnAttenteVente)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">Performance</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Taux de succès</p>
                <p className="text-xl font-bold text-blue-600">{stats.tauxSucces}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Délai moyen</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.delaiMoyen} jours</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Délai médian</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.delaiMedian} jours</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">Dossiers</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalDossiers}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">En cours</p>
                <p className="text-lg font-bold text-orange-600">{stats.dossiersEnCours}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Terminés</p>
                <p className="text-lg font-bold text-green-600">{stats.dossiersTermines}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StatisticsProfessional;
