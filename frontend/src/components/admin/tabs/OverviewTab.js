import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UsersIcon,
  FolderIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { usersService, dossiersService } from '../../../services/apiAdapter';
import { SkeletonGrid } from '../../transitions/SkeletonCard';
import LoadingButton from '../../transitions/LoadingButton';

const OverviewTab = ({ user, onNavigate, setStats }) => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    users: { total: 0, active: 0, trend: 0 },
    dossiers: { total: 0, actifs: 0, trend: 0 },
    ca: { mensuel: 0, trend: 0 },
    success: { rate: 0, trend: 0 },
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);

      // Charger utilisateurs
      const usersData = await usersService.getUsers({ limit: 100 });
      const totalUsers = usersData?.users?.length || 0;
      const activeUsers = usersData?.users?.filter(u => u.statut === 'actif' || u.status === 'active').length || 0;

      // Charger dossiers
      const dossiersData = await dossiersService.getDossiers({ limit: 100 });
      const allDossiers = dossiersData?.dossiers || [];
      const activeDossiers = allDossiers.filter(d => {
        const status = (d.statut || d.status || '').toLowerCase();
        return !['livre', 'termine'].includes(status);
      }).length;

      // Calculer CA (simulation basée sur nombre de dossiers)
      const caMensuel = Math.floor((allDossiers.length * 1250) + Math.random() * 10000);

      // Calculer taux de succès
      const completedDossiers = allDossiers.filter(d => {
        const status = (d.statut || d.status || '').toLowerCase();
        return ['livre', 'termine'].includes(status);
      }).length;
      const successRate = allDossiers.length > 0 
        ? Math.floor((completedDossiers / allDossiers.length) * 100)
        : 0;

      setKpis({
        users: { total: totalUsers, active: activeUsers, trend: 2 },
        dossiers: { total: allDossiers.length, actifs: activeDossiers, trend: 8 },
        ca: { mensuel: caMensuel, trend: 12 },
        success: { rate: successRate, trend: 3 },
      });

      // Mettre à jour les stats globales
      setStats({
        users: { total: totalUsers, active: activeUsers },
        dossiers: { total: allDossiers.length, actifs: activeDossiers },
        paiements: { total: completedDossiers, enAttente: 0 },
        devis: { total: 0, valides: 0 },
      });

      // Activité récente (derniers dossiers)
      const recent = allDossiers.slice(0, 5).map(d => ({
        id: d.id,
        type: 'dossier',
        title: `Dossier ${d.numero_dossier || d.numero_commande || `#${d.id.slice(-8)}`}`,
        description: `${d.nom_client || d.client || 'Client'} - ${d.type_formulaire || d.machine || 'Type inconnu'}`,
        time: formatTimeAgo(d.date_creation || d.created_at),
        status: d.statut || d.status,
      }));
      setRecentActivity(recent);

    } catch (error) {
      console.error('Erreur chargement overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Récemment';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins}min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `Il y a ${diffDays}j`;
    } catch {
      return 'Récemment';
    }
  };

  const getStatusColor = (status) => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('nouveau')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (normalized.includes('cours')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (normalized.includes('impression')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    if (normalized.includes('livre') || normalized.includes('termine')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const kpiCards = [
    {
      id: 'users',
      icon: UsersIcon,
      label: 'Utilisateurs actifs',
      value: kpis.users.active,
      total: kpis.users.total,
      trend: kpis.users.trend,
      color: 'blue',
      onClick: () => onNavigate && onNavigate('users'),
    },
    {
      id: 'dossiers',
      icon: FolderIcon,
      label: 'Dossiers en cours',
      value: kpis.dossiers.actifs,
      total: kpis.dossiers.total,
      trend: kpis.dossiers.trend,
      color: 'purple',
      onClick: () => onNavigate && onNavigate('dossiers'),
    },
    {
      id: 'ca',
      icon: CurrencyDollarIcon,
      label: 'CA Mensuel',
      value: `${(kpis.ca.mensuel / 1000).toFixed(1)}k €`,
      trend: kpis.ca.trend,
      color: 'green',
    },
    {
      id: 'success',
      icon: CheckCircleIcon,
      label: 'Taux de succès',
      value: `${kpis.success.rate}%`,
      trend: kpis.success.trend,
      color: 'emerald',
    },
  ];

  if (loading) {
    return <SkeletonGrid count={4} />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend > 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
          
          return (
            <motion.div
              key={kpi.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              onClick={kpi.onClick}
              className={`
                bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700
                ${kpi.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`
                  w-12 h-12 rounded-lg flex items-center justify-center
                  bg-gradient-to-br from-${kpi.color}-500 to-${kpi.color}-600
                `}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className={`
                  flex items-center gap-1 text-sm font-medium
                  ${kpi.trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                `}>
                  <TrendIcon className="h-4 w-4" />
                  {Math.abs(kpi.trend)}%
                </div>
              </div>
              
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {kpi.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {kpi.label}
              </p>
              {kpi.total && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  sur {kpi.total} total
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LoadingButton
          icon={PlusCircleIcon}
          onClick={() => onNavigate && onNavigate('dossiers')}
          variant="primary"
          className="h-16 text-left justify-start"
        >
          <div>
            <p className="font-semibold">Créer un dossier</p>
            <p className="text-xs opacity-80">Nouveau dossier client</p>
          </div>
        </LoadingButton>

        <LoadingButton
          icon={UserPlusIcon}
          onClick={() => onNavigate && onNavigate('users')}
          variant="secondary"
          className="h-16 text-left justify-start"
        >
          <div>
            <p className="font-semibold">Ajouter un utilisateur</p>
            <p className="text-xs opacity-80">Nouveau collaborateur</p>
          </div>
        </LoadingButton>

        <LoadingButton
          icon={ClipboardDocumentListIcon}
          onClick={() => onNavigate && onNavigate('statistics')}
          variant="secondary"
          className="h-16 text-left justify-start"
        >
          <div>
            <p className="font-semibold">Voir les rapports</p>
            <p className="text-xs opacity-80">Statistiques complètes</p>
          </div>
        </LoadingButton>
      </div>

      {/* Activité récente */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activité récente
          </h2>
          <button
            onClick={loadOverviewData}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Actualiser
          </button>
        </div>

        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              Aucune activité récente
            </p>
          ) : (
            recentActivity.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                    {activity.title.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                    {activity.status}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
