import React from 'react';
import { motion } from 'framer-motion';
import {
  DocumentCheckIcon,
  TruckIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

const LivreurKPIHeader = ({ stats }) => {
  const kpis = [
    {
      label: '📦 À livrer',
      value: stats.aLivrer,
      color: 'blue',
      icon: DocumentCheckIcon,
      description: 'Prêts pour livraison',
    },
    {
      label: '🚚 Programmées',
      value: stats.programmees,
      color: 'amber',
      icon: TruckIcon,
      description: 'En attente',
    },
    {
      label: '✅ Livrées',
      value: stats.livrees,
      color: 'emerald',
      icon: CheckCircleIcon,
      description: 'Terminées',
    },
    {
      label: '💰 Encaissé (mois)',
      value: `${new Intl.NumberFormat('fr-FR').format(stats.encaisseMonth || 0)} CFA`,
      color: 'purple',
      icon: CurrencyDollarIcon,
      description: 'Total ce mois',
      isAmount: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map((kpi, index) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white dark:bg-neutral-800/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white dark:bg-neutral-800/30 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-emerald-100 text-sm font-medium mb-1">{kpi.description}</p>
              <p className={`${kpi.isAmount ? 'text-xl' : 'text-3xl'} font-bold text-white`}>
                {kpi.value}
              </p>
            </div>
            <div className={`p-3 rounded-xl bg-${kpi.color}-500/20`}>
              <kpi.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default LivreurKPIHeader;
