import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CurrencyEuroIcon,
  UserGroupIcon,
  ServerIcon,
  CalendarIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periode, setPeriode] = useState('month');
  const [refreshing, setRefreshing] = useState(false);

  // Helper navigation vers Dossiers avec des filtres initiaux
  // const goToDossiersWith = preset => {
  //   try {
  //     localStorage.setItem('dossiersInitFilters', JSON.stringify(preset));
  //   } catch {}
  //   if (typeof onNavigate === 'function') onNavigate('dossiers');
  // };

  // Périodes disponibles
  const periodes = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'yesterday', label: 'Hier' },
    { value: 'week', label: 'Cette semaine' },
    { value: 'last_week', label: 'Semaine dernière' },
    { value: 'month', label: 'Ce mois' },
    { value: 'last_month', label: 'Mois dernier' },
    { value: 'quarter', label: 'Ce trimestre' },
    { value: 'year', label: 'Cette année' },
    { value: 'last_year', label: 'Année dernière' },
    { value: 'all', label: 'Toute période' },
  ];

  // Récupération des données
  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/statistiques/dashboard?periode=${periode}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      const result = await response.json();
      setDashboardData(result.data);
      setError(null);
    } catch (err) {
      console.error('Erreur lors de la récupération des données:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periode]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleExport = async (type = 'dashboard') => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/statistiques/export?periode=${periode}&type=${type}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Erreur lors de l'export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `statistiques_${type}_${periode}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export:', err);
      alert("Erreur lors de l'export des données");
    }
  };

  // Options de graphiques (respect du thème)
  const getChartOptions = title => ({
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: '#374151' } },
      title: { display: true, text: title, color: '#111827' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#374151' }, grid: { color: '#E5E7EB' } },
      x: { ticks: { color: '#374151' }, grid: { color: '#F3F4F6' } },
    },
  });

  const getDoughnutOptions = title => ({
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#374151' } },
      title: { display: true, text: title, color: '#111827' },
    },
  });

  // Données formatées
  const getEvolutionChartData = () => {
    if (!dashboardData?.evolution_dossiers) return null;
    const data = dashboardData.evolution_dossiers;
    return {
      labels: data.map(item => item.periode),
      datasets: [
        {
          label: 'Dossiers créés',
          data: data.map(item => item.total_crees),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
        },
        {
          label: 'Dossiers livrés',
          data: data.map(item => item.total_livres),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          fill: true,
        },
        {
          label: 'Dossiers urgents',
          data: data.map(item => item.total_urgents),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          fill: true,
        },
      ],
    };
  };

  const getStatusChartData = () => {
    if (!dashboardData?.statistiques_generales) return null;
    const stats = dashboardData.statistiques_generales;
    return {
      labels: ['En cours', 'En impression', 'Terminé', 'À revoir', 'En livraison', 'Livré'],
      datasets: [
        {
          data: [
            stats.en_cours,
            stats.en_impression,
            stats.termine,
            stats.a_revoir,
            stats.en_livraison,
            stats.livre,
          ],
          backgroundColor: ['#6366f1', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#22c55e'],
          borderWidth: 2,
        },
      ],
    };
  };

  const getMachinesChartData = () => {
    if (!dashboardData?.repartition_machines) return null;
    const data = dashboardData.repartition_machines;
    return {
      labels: data.map(item => item.type_impression),
      datasets: [
        {
          label: 'Nombre de dossiers',
          data: data.map(item => item.nombre_dossiers),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(139, 92, 246, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  const getRevenueChartData = () => {
    if (!dashboardData?.evolution_revenus) return null;
    const data = dashboardData.evolution_revenus;
    return {
      labels: data.map(item => item.periode),
      datasets: [
        {
          label: 'Chiffre d&apos;affaires (€)',
          data: data.map(item => item.chiffre_affaires),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Objectif (€)',
          data: data.map(item => item.objectif),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          borderDash: [5, 5],
        },
      ],
    };
  };

  const getUtilisateursChartData = () => {
    if (!dashboardData?.statistiques_utilisateurs) return null;
    const data = dashboardData.statistiques_utilisateurs;
    return {
      labels: ['Admins', 'Préparateurs', 'Clients', 'Inactifs'],
      datasets: [
        {
          data: [
            data.admins || 0,
            data.preparateurs || 0,
            data.clients || 0,
            data.inactifs || 0,
          ],
          backgroundColor: [
            '#ef4444', // Rouge pour admins
            'var(--color-blue-500)', // Bleu pour préparateurs
            '#22c55e', // Vert pour clients
            '#6b7280', // Gris pour inactifs
          ],
          borderWidth: 2,
          borderColor: 'var(--color-neutral-0)',
        },
      ],
    };
  };

  const getPerformanceSystemeData = () => {
    if (!dashboardData?.performance_systeme) return null;
    const data = dashboardData.performance_systeme;
    return {
      labels: data.map(item => item.heure),
      datasets: [
        {
          label: 'CPU (%)',
          data: data.map(item => item.cpu),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          yAxisID: 'y',
        },
        {
          label: 'Mémoire (%)',
          data: data.map(item => item.memoire),
          borderColor: 'rgb(245, 158, 11)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          yAxisID: 'y',
        },
        {
          label: 'Requêtes/min',
          data: data.map(item => item.requetes_par_minute),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          yAxisID: 'y1',
        },
      ],
    };
  };

  if (loading) {
    return (
      <div className="min-h-[200px] bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center text-danger-600 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
            <h3 className="text-lg font-medium">Erreur de chargement</h3>
          </div>
          <p className="text-neutral-700 dark:text-neutral-200 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchDashboardData();
            }}
            className="btn-primary"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.statistiques_generales;
  const alertes = dashboardData?.alertes;
  const performances = dashboardData?.performances_utilisateurs;

  return (
    <div className="space-y-6">
      {/* Barre d'actions */}
      <div className="card">
        <div className="card-body flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Statistiques et analytics</h2>
            <p className="text-neutral-600 dark:text-neutral-300">Vue d&apos;ensemble des performances de la plateforme</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={periode}
              onChange={e => setPeriode(e.target.value)}
              className="form-input w-48"
            >
              {periodes.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center">
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </span>
            </button>
            <button type="button" onClick={() => handleExport('dashboard')} className="btn-primary">
              <span className="inline-flex items-center">
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Exporter CSV
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Dossiers actifs</p>
                  <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                    {stats?.total_actifs || 0}
                  </p>
                </div>
              </div>
              {stats?.evolution_actifs && (
                <div className="flex items-center text-sm">
                  {stats.evolution_actifs > 0 ? (
                    <ArrowTrendingUpIcon className="h-4 w-4 text-success-600" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-4 w-4 text-danger-600" />
                  )}
                  <span className={stats.evolution_actifs > 0 ? 'text-success-600' : 'text-danger-600'}>
                    {Math.abs(stats.evolution_actifs)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyEuroIcon className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Chiffre d&apos;affaires</p>
                  <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                    {stats?.chiffre_affaires ? `${stats.chiffre_affaires.toLocaleString()}€` : '0€'}
                  </p>
                </div>
              </div>
              {stats?.evolution_ca && (
                <div className="flex items-center text-sm">
                  {stats.evolution_ca > 0 ? (
                    <ArrowTrendingUpIcon className="h-4 w-4 text-success-600" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-4 w-4 text-danger-600" />
                  )}
                  <span className={stats.evolution_ca > 0 ? 'text-success-600' : 'text-danger-600'}>
                    {Math.abs(stats.evolution_ca)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Taux de réussite</p>
                  <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                    {stats?.taux_reussite || 0}%
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {stats?.taux_reussite >= 90 ? (
                  <CheckCircleIcon className="h-5 w-5 text-success-600" />
                ) : stats?.taux_reussite >= 70 ? (
                  <ExclamationTriangleIcon className="h-5 w-5 text-warning-600" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-danger-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-info-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Utilisateurs actifs</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {stats?.utilisateurs_actifs || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Métriques secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-warning-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Temps moyen traitement</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {stats?.temps_moyen_traitement_heures || 0}h
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-danger-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Dossiers à revoir</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {alertes?.dossiers_a_revoir || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ServerIcon className="h-6 w-6 text-neutral-600 dark:text-neutral-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Charge système</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {stats?.charge_systeme || 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Délai moyen livraison</p>
                <p className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {stats?.delai_moyen_livraison || 0}j
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {alertes && (alertes.dossiers_urgents_en_retard > 0 || alertes.dossiers_anciens > 0) && (
        <div className="bg-danger-50 border-l-4 border-danger-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-danger-800">Alertes importantes</h3>
              <div className="mt-2 text-sm text-danger-700">
                <ul className="list-disc list-inside space-y-1">
                  {alertes.dossiers_urgents_en_retard > 0 && (
                    <li>{alertes.dossiers_urgents_en_retard} dossiers urgents en retard</li>
                  )}
                  {alertes.dossiers_anciens > 0 && (
                    <li>{alertes.dossiers_anciens} dossiers anciens non traités</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Évolution des dossiers</h3>
          </div>
          <div className="card-body">
            {getEvolutionChartData() && (
              <Line
                data={getEvolutionChartData()}
                options={getChartOptions('Évolution dans le temps')}
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Répartition par statut</h3>
          </div>
          <div className="card-body">
            {getStatusChartData() && (
              <Doughnut
                data={getStatusChartData()}
                options={getDoughnutOptions('Statuts des dossiers')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Évolution du chiffre d'affaires */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Évolution du chiffre d&apos;affaires</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-success-500 rounded-full mr-2"></div>
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Réalisé</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 border-2 border-blue-500 border-dashed rounded-full mr-2"></div>
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Objectif</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {getRevenueChartData() && (
            <Line
              data={getRevenueChartData()}
              options={{
                ...getChartOptions('Évolution du chiffre d&apos;affaires'),
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return value.toLocaleString() + '€';
                      }
                    }
                  }
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Répartition machines & utilisateurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Répartition par machine</h3>
          </div>
          <div className="card-body">
            {getMachinesChartData() && (
              <Bar
                data={getMachinesChartData()}
                options={getChartOptions("Dossiers par type d'impression")}
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Répartition des utilisateurs</h3>
          </div>
          <div className="card-body">
            {getUtilisateursChartData() && (
              <Doughnut
                data={getUtilisateursChartData()}
                options={getDoughnutOptions('Utilisateurs par rôle')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Performance système */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Performance du système</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <ServerIcon className="h-4 w-4 text-neutral-500 mr-1" />
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  Charge actuelle: {stats?.charge_systeme || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {getPerformanceSystemeData() && (
            <Line
              data={getPerformanceSystemeData()}
              options={{
                responsive: true,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                scales: {
                  x: {
                    display: true,
                    title: {
                      display: true,
                      text: 'Heure'
                    }
                  },
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                      display: true,
                      text: 'Utilisation (%)'
                    },
                    max: 100,
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                      display: true,
                      text: 'Requêtes/min'
                    },
                    grid: {
                      drawOnChartArea: false,
                    },
                  },
                },
              }}
            />
          )}
        </div>
      </div>

      {/* Performances équipe détaillées */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Performances de l&apos;équipe</h3>
            <div className="flex items-center space-x-2">
              <EyeIcon className="h-4 w-4 text-neutral-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                {performances?.length || 0} utilisateurs
              </span>
            </div>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-left border border-neutral-200 dark:border-neutral-700">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 uppercase border-b">
                  Utilisateur
                </th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 uppercase border-b">
                  Dossiers traités
                </th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 uppercase border-b">
                  Taux réussite
                </th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 uppercase border-b">
                  Temps moyen
                </th>
                <th className="px-4 py-3 text-xs font-medium text-neutral-600 dark:text-neutral-300 uppercase border-b">
                  Dernière activité
                </th>
              </tr>
            </thead>
            <tbody>
              {performances?.slice(0, 10).map((perf, index) => (
                <tr key={index} className="border-b hover:bg-neutral-50 dark:bg-neutral-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-700">
                            {perf.prenom?.charAt(0)}{perf.nom?.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {perf.prenom} {perf.nom}
                        </div>
                        <div className="text-xs text-neutral-500">{perf.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                    <div className="flex items-center">
                      <span className="font-medium">{perf.dossiers_traites}</span>
                      {perf.evolution_dossiers && (
                        <span className={`ml-2 text-xs ${
                          perf.evolution_dossiers > 0 ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          ({perf.evolution_dossiers > 0 ? '+' : ''}{perf.evolution_dossiers})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        perf.taux_reussite >= 90
                          ? 'bg-success-100 text-success-800'
                          : perf.taux_reussite >= 70
                            ? 'bg-warning-100 text-warning-800'
                            : 'bg-danger-100 text-danger-800'
                      }`}
                    >
                      {perf.taux_reussite}%
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                    {perf.temps_moyen_traitement || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-500">
                    {perf.derniere_activite || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};



export default Dashboard;
