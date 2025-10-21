import React from 'react';
import {
  DocumentCheckIcon,
  TruckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const LivreurNavTabs = ({ activeTab, setActiveTab, stats }) => {
  const tabs = [
    {
      id: 'a_livrer',
      label: '📦 À livrer',
      icon: DocumentCheckIcon,
      count: stats.aLivrer,
    },
    {
      id: 'programmees',
      label: '🚚 Programmées',
      icon: TruckIcon,
      count: stats.programmees,
    },
    {
      id: 'terminees',
      label: '✅ Terminées',
      icon: CheckCircleIcon,
      count: stats.livrees,
    },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-white dark:bg-neutral-800 text-emerald-600 shadow-lg dark:shadow-secondary-900/25'
              : 'text-emerald-100 hover:bg-white dark:bg-neutral-800/20'
          }`}
        >
          <tab.icon className="h-5 w-5" />
          {tab.label}
          {tab.count > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-white dark:bg-neutral-800/20 text-white'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default LivreurNavTabs;
