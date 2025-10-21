/**
 * 📊 LivreurKPICards - Cartes d'indicateurs de performance
 * Affichage des KPI principaux avec animations et états interactifs
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  TruckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { formatCurrency, formatDuration } from '../utils/livreurUtils';

const LivreurKPICards = memo(({ 
  stats = {}, 
  urgentCount = 0, 
  loading = false 
}) => {
  // Configuration des cartes KPI
  const kpiCards = [
    {
      id: 'a_livrer',
      title: 'À Livrer',
      value: stats.aLivrer || 0,
      icon: TruckIcon,
      color: 'blue',
      description: 'Dossiers prêts',
      trend: null, // Peut être ajouté plus tard
      bgGradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      id: 'programmees',
      title: 'Programmées',
      value: stats.programmees || 0,
      icon: ClockIcon,
      color: 'orange',
      description: 'En cours de livraison',
      bgGradient: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    {
      id: 'livrees',
      title: 'Livrées',
      value: stats.livreesAujourdhui || 0,
      icon: CheckCircleIcon,
      color: 'green',
      description: 'Aujourd\\'hui',
      bgGradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      id: 'urgent',
      title: 'Urgentes',
      value: urgentCount,
      icon: ExclamationTriangleIcon,
      color: 'red',
      description: 'Priorité haute',
      bgGradient: 'from-red-500 to-red-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      pulse: urgentCount > 0
    }
  ];

  // Cartes KPI secondaires (informations complémentaires)
  const secondaryKpis = [
    {
      id: 'encaisse_jour',
      title: 'Encaissé',
      value: formatCurrency(stats.encaisseAujourdhui || 0),
      icon: CurrencyDollarIcon,
      color: 'purple',
      description: 'Aujourd\\'hui',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    {
      id: 'taux_reussite',
      title: 'Taux de réussite',
      value: `${stats.tauxReussite || 100}%`,
      icon: ChartBarIcon,
      color: 'indigo',
      description: 'Performance',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600'
    },
    {
      id: 'km_estime',
      title: 'Distance',
      value: `${Math.round(stats.estimatedKmTotal || 0)} km`,
      icon: MapPinIcon,
      color: 'cyan',
      description: 'À parcourir',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600'
    },
    {
      id: 'temps_estime',
      title: 'Temps estimé',
      value: formatDuration(stats.estimatedTimeTotal || 0),
      icon: ClockIcon,
      color: 'teal',
      description: 'Livraisons restantes',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600'
    }
  ];

  // Composant de carte KPI principale
  const KPICard = ({ kpi, index, isPrimary = true }) => (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.05,
        duration: 0.3,
        ease: "easeOut"
      }}
      className={`bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 transition-all duration-200 overflow-hidden group ${
        kpi.pulse ? 'ring-2 ring-red-200 border-red-200' : ''
      }`}
    >
      <div className={`p-${isPrimary ? '5' : '4'}`}>
        <div className="flex items-start justify-between mb-4">
          {/* Icône et titre */}
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <div className={`p-2.5 ${kpi.iconBg} rounded-lg`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  {kpi.title}
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  {kpi.description}
                </p>
              </div>
            </div>
          </div>

          {/* Indicateur de tendance (si disponible) */}
          {kpi.trend && (
            <div className=\"flex items-center space-x-1\">
              <ArrowTrendingUpIcon className=\"h-4 w-4 text-green-500\" />
              <span className=\"text-sm font-medium text-green-600\">
                +{kpi.trend}%
              </span>
            </div>
          )}
        </div>

        {/* Valeur principale */}
        <div className="flex items-center justify-between">
          <div>
            {loading ? (
              <div className="animate-pulse">
                <div className="bg-gray-200 rounded h-8 w-16 mb-2" />
              </div>
            ) : (
              <motion.p
                key={kpi.value}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={`font-bold ${
                  isPrimary ? 'text-3xl' : 'text-2xl'
                } ${kpi.pulse ? 'text-red-600' : 'text-gray-900'}`}
              >
                {kpi.value}
              </motion.p>
            )}
          </div>

          {/* Badge urgent si applicable */}
          {kpi.id === 'urgent' && kpi.value > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
              className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold"
            >
              🚨 URGENT
            </motion.div>
          )}
        </div>

        {/* Barre de progression (optionnelle) */}
        {kpi.id === 'taux_reussite' && !loading && (
          <div className=\"mt-3\">
            <div className=\"flex items-center justify-between text-xs text-gray-500 mb-1\">
              <span>Performance</span>
              <span>{kpi.value}</span>
            </div>
            <div className=\"w-full bg-gray-200 rounded-full h-2\">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.tauxReussite || 100}%` }}
                transition={{ delay: 1, duration: 1 }}
                className=\"bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full\"
              />
            </div>
          </div>
        )}
      </div>

    </motion.div>
  );

  if (loading) {
    return (
      <div className=\"space-y-6\">
        {/* KPI principales - skeleton */}
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6\">
          {[...Array(4)].map((_, index) => (
            <div key={index} className=\"bg-white rounded-2xl shadow-lg p-6 animate-pulse\">
              <div className=\"flex items-center space-x-3 mb-4\">
                <div className=\"w-12 h-12 bg-gray-200 rounded-xl\" />
                <div className=\"flex-1\">
                  <div className=\"h-4 bg-gray-200 rounded w-20 mb-2\" />
                  <div className=\"h-3 bg-gray-200 rounded w-16\" />
                </div>
              </div>
              <div className=\"h-8 bg-gray-200 rounded w-12\" />
            </div>
          ))}
        </div>

        {/* KPI secondaires - skeleton */}
        <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4\">
          {[...Array(4)].map((_, index) => (
            <div key={index} className=\"bg-white rounded-xl shadow-sm p-4 animate-pulse\">
              <div className=\"flex items-center space-x-2 mb-3\">
                <div className=\"w-8 h-8 bg-gray-200 rounded-lg\" />
                <div className=\"flex-1\">
                  <div className=\"h-3 bg-gray-200 rounded w-16 mb-1\" />
                  <div className=\"h-2 bg-gray-200 rounded w-12\" />
                </div>
              </div>
              <div className=\"h-6 bg-gray-200 rounded w-16\" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <KPICard
            key={kpi.id}
            kpi={kpi}
            index={index}
            isPrimary={true}
          />
        ))}
      </div>

      {/* KPI secondaires */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4\"
      >
        {secondaryKpis.map((kpi, index) => (
          <KPICard
            key={kpi.id}
            kpi={kpi}
            index={index}
            isPrimary={false}
          />
        ))}
      </motion.div>

      {/* Alerte urgente si nécessaire */}
      {urgentCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="bg-red-50 border-l-4 border-red-500 text-red-900 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm">
                {urgentCount} livraison{urgentCount > 1 ? 's' : ''} urgente{urgentCount > 1 ? 's' : ''}
              </h3>
              <p className="text-red-700 text-xs mt-0.5">
                Ces livraisons nécessitent votre attention immédiate
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
});

LivreurKPICards.displayName = 'LivreurKPICards';

export default LivreurKPICards;