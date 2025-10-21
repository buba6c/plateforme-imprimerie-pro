/**
 * 📦 Composants Cards - Interface Livreur V2
 * 
 * Badges et cartes modernes pour l'affichage des dossiers de livraison
 * - Badges de statut, priorité et zone
 * - Cartes de dossier interactives
 * - Composants réutilisables et accessibles
 */

// Badges modernes
export { default as DeliveryStatusBadge } from './DeliveryStatusBadge';
export { default as DeliveryPriorityBadge } from './DeliveryPriorityBadge';
export { default as ZoneBadge } from './ZoneBadge';

// Cartes principales V2
export { default as DeliveryDossierCardV2 } from './DeliveryDossierCardV2';

// Cards originales (legacy - à migrer progressivement)
// export { default as DeliveryCard } from './DeliveryCard';
// export { default as StatusCard } from './StatusCard';
// export { default as MetricCard } from './MetricCard';
// export { default as DossierListCard } from './DossierListCard';