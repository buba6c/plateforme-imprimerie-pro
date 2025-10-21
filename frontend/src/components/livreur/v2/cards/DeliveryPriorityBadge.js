/**
 * ⚡ Badge de priorité
 */

import React from 'react';
import { PRIORITY_CONFIGS } from '../utils/livreurConstants';

const DeliveryPriorityBadge = ({ priority }) => {
  if (!priority) return null;

  const config = PRIORITY_CONFIGS[priority] || PRIORITY_CONFIGS.medium;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${config.bgColor} ${config.textColor} ${config.pulse ? 'animate-pulse' : ''}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export default DeliveryPriorityBadge;
