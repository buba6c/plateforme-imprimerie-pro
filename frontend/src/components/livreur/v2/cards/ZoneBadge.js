/**
 * 🗺️ Badge de zone de livraison
 */

import React from 'react';
import { ZONE_CONFIGS } from '../utils/livreurConstants';

const ZoneBadge = ({ zone }) => {
  if (!zone) return null;

  const config = ZONE_CONFIGS[zone] || ZONE_CONFIGS.autre;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export default ZoneBadge;
