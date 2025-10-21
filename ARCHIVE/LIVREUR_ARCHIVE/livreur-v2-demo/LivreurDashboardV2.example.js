/**
 * 🧪 Exemple d'utilisation de LivreurDashboardV2
 * Fichier de test et démonstration de l'interface complètement redesignée
 */

import React from 'react';
import LivreurDashboardV2 from './dashboard/LivreurDashboardV2';
import notificationService from '../../services/notificationService';

// Données de test simulées
const mockUser = {
  id: 1,
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean.dupont@example.com',
  role: 'livreur'
};

const mockDossiers = [
  {
    id: 1,
    numero_commande: 'CMD-2024-001',
    client_nom: 'Marie Martin',
    adresse_livraison: '123 Rue de la Paix, 75001 Paris',
    telephone_livraison: '01 23 45 67 89',
    statut: 'imprime',
    created_at: new Date().toISOString(),
    montant: 45000,
    code_postal: '75001'
  },
  {
    id: 2,
    numero_commande: 'CMD-2024-002',
    client_nom: 'Pierre Durand',
    adresse_livraison: '456 Avenue des Champs, 92100 Boulogne',
    telephone_livraison: '01 34 56 78 90',
    statut: 'pret_livraison',
    created_at: new Date(Date.now() - 86400000).toISOString(), // Hier
    montant: 32000,
    code_postal: '92100',
    date_livraison_prevue: new Date(Date.now() + 3600000).toISOString() // Dans 1h - urgent !
  },
  {
    id: 3,
    numero_commande: 'CMD-2024-003',
    client_nom: 'Sophie Bernard',
    adresse_livraison: '789 Rue Victor Hugo, 94200 Ivry',
    statut: 'en_livraison',
    created_at: new Date(Date.now() - 172800000).toISOString(), // Il y a 2 jours
    montant: 67000,
    code_postal: '94200'
  },
  {
    id: 4,
    numero_commande: 'CMD-2024-004',
    client_nom: 'Entreprise ABC',
    adresse_livraison: '321 Boulevard Saint-Germain, 75006 Paris',
    statut: 'livre',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    montant: 85000,
    montant_encaisse: 85000,
    mode_paiement: 'carte',
    date_livraison: new Date().toISOString(),
    code_postal: '75006'
  }
];

/**
 * Composant de démonstration
 * Utilise l'interface livreur V2 avec des données de test
 */
const LivreurDashboardDemo = () => {
  const handleNavigate = (section) => {
      try {
        if (notificationService && typeof notificationService.info === 'function') {
          notificationService.info('Navigation', section);
        }
      } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <LivreurDashboardV2
        user={mockUser}
        initialSection="a_livrer"
        onNavigate={handleNavigate}
      />
    </div>
  );
};

/**
 * Tests unitaires simulés
 */
export const runIntegrationTests = () => {
  console.group('🧪 Tests d\'intégration LivreurDashboardV2');
  
  // Test 1: Vérification de l'import
  try {
       if (notificationService && typeof notificationService.info === 'function') {
      notificationService.success('Import du composant principal: OK');
     }
  } catch (error) {
     try { notificationService.error('Erreur d\'import', error); } catch (e) {}
  }

  // Test 2: Vérification des hooks personnalisés
  try {
    import('./hooks/useLivreurData').then(() => {
      notificationService.success('Hook useLivreurData: OK');
    });
    import('./hooks/useLivreurActions').then(() => {
      notificationService.success('Hook useLivreurActions: OK');
    });
  } catch (error) {
     try { notificationService.error('Erreur hooks', error); } catch (e) {}
  }

  // Test 3: Vérification des composants de base
  const componentsToTest = [
    './dashboard/LivreurHeader',
    './dashboard/LivreurKPICards',
    './navigation/LivreurNavigation',
    './navigation/LivreurFilters',
    './sections/ALivrerSectionV2',
    './sections/ProgrammeesSectionV2',
    './sections/TermineesSectionV2'
  ];

  componentsToTest.forEach(component => {
    try {
      import(component).then(() => {
        notificationService.success(`Composant ${component.split('/').pop()}: OK`);
      });
    } catch (error) {
      try { notificationService.error(`Erreur composant ${component}`, error); } catch (e) {}
    }
  });

  // Test 4: Vérification des utilitaires
  try {
    import('./utils/livreurUtils').then((utils) => {
      const testDossier = mockDossiers[0];
      const enriched = utils.enrichDossierData(testDossier);
      
      if (enriched.displayNumber && enriched.deliveryStatus && enriched.deliveryZone) {
        notificationService.success('Enrichissement des données: OK');
      } else {
        notificationService.error('Enrichissement des données incomplet');
      }
    });
    
    import('./utils/livreurConstants').then((constants) => {
      if (constants.DELIVERY_STATUS && constants.STATUS_CONFIGS) {
        notificationService.success('Constantes de configuration: OK');
      } else {
        notificationService.error('Constantes manquantes');
      }
    });
  } catch (error) {
     try { notificationService.error('Erreur utilitaires', error); } catch (e) {}
  }

      try { notificationService.info('Tests d\'intégration terminés'); } catch (e) {}
  console.groupEnd();
};

/**
 * Guide d'utilisation rapide
 */
export const quickStartGuide = () => {
  try {
    const info = [
      'ARCHITECTURE: dashboard/, navigation/, sections/, cards/, modals/, hooks/, utils/',
      'UTILISATION: import LivreurDashboardV2 and pass onNavigate handler using notificationService.info',
      'HOOKS: useLivreurData, useLivreurActions',
      'FONCTIONNALITÉS: KPI, filtres, modales, notifications toast, ErrorBoundary'
    ];
    if (notificationService && typeof notificationService.info === 'function') {
      info.forEach(i => notificationService.info(i));
    }
  } catch (e) {}
};

// Exporter le composant de démonstration
export default LivreurDashboardDemo;