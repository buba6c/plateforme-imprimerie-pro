/**
 * Système de couleurs unifié pour les statuts de dossiers
 * Utilisé dans DossierDetails, DossierCard et tous les dashboards
 */

export const getStatusColor = (status) => {
  const statusLower = (status || '').toLowerCase();
  
  if (statusLower.includes('nouveau')) {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      light: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-700',
    };
  }
  
  if (statusLower.includes('en_cours') || statusLower.includes('en cours')) {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      light: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-700',
    };
  }
  
  if (statusLower.includes('pret') || statusLower.includes('prêt')) {
    return {
      bg: 'bg-purple-500',
      text: 'text-purple-600',
      light: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-700',
    };
  }
  
  if (statusLower.includes('impression')) {
    return {
      bg: 'bg-indigo-500',
      text: 'text-indigo-600',
      light: 'bg-indigo-50 dark:bg-indigo-900/20',
      border: 'border-indigo-200 dark:border-indigo-700',
    };
  }
  
  if (statusLower.includes('imprime') || statusLower.includes('imprimé')) {
    return {
      bg: 'bg-cyan-500',
      text: 'text-cyan-600',
      light: 'bg-cyan-50 dark:bg-cyan-900/20',
      border: 'border-cyan-200 dark:border-cyan-700',
    };
  }
  
  if (statusLower.includes('livraison')) {
    return {
      bg: 'bg-violet-500',
      text: 'text-violet-600',
      light: 'bg-violet-50 dark:bg-violet-900/20',
      border: 'border-violet-200 dark:border-violet-700',
    };
  }
  
  if (statusLower.includes('livre') || statusLower.includes('livré')) {
    return {
      bg: 'bg-green-500',
      text: 'text-green-600',
      light: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-700',
    };
  }
  
  if (statusLower.includes('termine') || statusLower.includes('terminé')) {
    return {
      bg: 'bg-gray-500',
      text: 'text-gray-600',
      light: 'bg-gray-50 dark:bg-gray-900/20',
      border: 'border-gray-200 dark:border-gray-700',
    };
  }
  
  if (statusLower.includes('revoir')) {
    return {
      bg: 'bg-red-500',
      text: 'text-red-600',
      light: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-700',
    };
  }
  
  // Statut par défaut
  return {
    bg: 'bg-gray-500',
    text: 'text-gray-600',
    light: 'bg-gray-50 dark:bg-gray-900/20',
    border: 'border-gray-200 dark:border-gray-700',
  };
};

/**
 * Retourne le badge de statut avec les couleurs uniformisées
 */
export const getStatusBadge = (status) => {
  const colors = getStatusColor(status);
  return `${colors.light} ${colors.text} ${colors.border}`;
};

/**
 * Labels de statuts traduits
 */
export const getStatusLabel = (status) => {
  const statusLabels = {
    nouveau: 'Nouveau',
    en_cours: 'En cours',
    pret_impression: 'Prêt impression',
    en_impression: 'En impression',
    imprime: 'Imprimé',
    en_livraison: 'En livraison',
    livre: 'Livré',
    termine: 'Terminé',
    a_revoir: 'À revoir',
  };
  
  return statusLabels[status] || status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Inconnu';
};
