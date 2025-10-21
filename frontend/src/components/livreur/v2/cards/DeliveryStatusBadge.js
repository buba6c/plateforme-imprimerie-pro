/**
 * 🏷️ Badge de statut de livraison
 */

import React from 'react';
import { STATUS_CONFIGS } from '../utils/livreurConstants';

const DeliveryStatusBadge = ({ status }) => {
  const config = STATUS_CONFIGS[status] || {
    label: status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: '📋'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export default DeliveryStatusBadge;
