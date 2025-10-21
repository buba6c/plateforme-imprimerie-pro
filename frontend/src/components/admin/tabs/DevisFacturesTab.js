import React, { useState } from 'react';
import { DocumentTextIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import DevisList from '../../devis/DevisList';
import FacturesList from '../../factures/FacturesList';

const DevisFacturesTab = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState('devis');

  const subTabs = [
    { id: 'devis', label: 'Devis', icon: DocumentTextIcon },
    { id: 'factures', label: 'Factures', icon: BanknotesIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm border border-gray-200 dark:border-gray-700 flex gap-2">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                ${isActive
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div>
        {activeSubTab === 'devis' && <DevisList user={user} />}
        {activeSubTab === 'factures' && <FacturesList user={user} />}
      </div>
    </div>
  );
};

export default DevisFacturesTab;
