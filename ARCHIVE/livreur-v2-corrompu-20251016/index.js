/**
 * 🚚 Interface Livreur V2 - Architecture Modulaire
 * 
 * Structure complètement redesignée avec une approche moderne :
 * - Composants réutilisables et modulaires
 * - Performance optimisée avec React.memo
 * - Design system cohérent
 * - Accessibilité renforcée
 * - UX/UI moderne avec animations fluides
 */

// Dashboard Principal
export { default as LivreurDashboardV2 } from './dashboard/LivreurDashboardV2';
export { default as LivreurHeader } from './dashboard/LivreurHeader';
export { default as LivreurKPICards } from './dashboard/LivreurKPICards';

// Navigation
export { default as LivreurNavigation } from './navigation/LivreurNavigation';
export { default as LivreurFilters } from './navigation/LivreurFilters';
export { default as LivreurSearchBar } from './navigation/LivreurSearchBar';

// Sections de contenu
export { default as ALivrerSectionV2 } from './sections/ALivrerSectionV2';
export { default as ProgrammeesSectionV2 } from './sections/ProgrammeesSectionV2';
export { default as TermineesSectionV2 } from './sections/TermineesSectionV2';

// Cartes et badges modernes
export {
  DeliveryStatusBadge,
  DeliveryPriorityBadge,
  ZoneBadge,
  DeliveryDossierCardV2
} from './cards';

// Cards legacy (à migrer)
export { default as DossierCardV2 } from './cards/DossierCardV2';
export { default as DossierCardActions } from './cards/DossierCardActions';
export { default as DossierCardInfo } from './cards/DossierCardInfo';

// Modales interactives
export { default as ProgrammerModalV2 } from './modals/ProgrammerModalV2';
export { default as ValiderLivraisonModalV2 } from './modals/ValiderLivraisonModalV2';
export { default as DossierDetailsModalV2 } from './modals/DossierDetailsModalV2';
export { default as EchecLivraisonModalV2 } from './modals/EchecLivraisonModalV2';

// Hooks personnalisés
export { default as useLivreurData } from './hooks/useLivreurData';
export { default as useLivreurFilters } from './hooks/useLivreurFilters';
export { default as useLivreurActions } from './hooks/useLivreurActions';

// Utilitaires
export * from './utils/livreurUtils';
export * from './utils/livreurConstants';

/**
 * Point d'entrée principal
 * Export par défaut du dashboard principal
 */
export { default } from './dashboard/LivreurDashboardV2';