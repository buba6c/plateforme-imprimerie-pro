import React from 'react';
import notificationService from '../../services/notificationService';
import { motion } from 'framer-motion';
import {
  DeliveryStatusBadge,
  DeliveryPriorityBadge,
  ZoneBadge,
  DeliveryDossierCardV2
} from '../cards';

/**
 * Composant de démonstration pour les badges et cartes V2
 * Permet de tester et visualiser les nouveaux composants
 */
const BadgesAndCardsDemo = () => {
  // Données d'exemple pour les tests
  const sampleDossiers = [
    {
      id: 'D001',
      displayNumber: 'D-2024-001',
      displayClient: 'Restaurant Le Gourmet',
      displayAdresse: '15 Rue de la Paix, 75001 Paris',
      displayTelephone: '01 42 86 17 89',
      deliveryStatus: 'pret_livraison',
      deliveryZone: 'paris',
      deliveryPriority: 'high',
      isUrgentDelivery: true,
      amount: 125.50,
      estimatedTime: 15,
      distance: 3.2,
      deliveryDate: '2024-01-15',
      comments: 'Livraison en urgence - Client VIP',
      retryCount: 0
    },
    {
      id: 'D002',
      displayNumber: 'D-2024-002',
      displayClient: 'Boulangerie Martin',
      displayAdresse: '42 Avenue des Champs-Élysées, 75008 Paris',
      displayTelephone: '01 45 23 67 89',
      deliveryStatus: 'en_livraison',
      deliveryZone: 'banlieue',
      deliveryPriority: 'medium',
      isUrgentDelivery: false,
      amount: 89.00,
      estimatedTime: 25,
      distance: 8.7,
      deliveryDate: '2024-01-15',
      comments: null,
      retryCount: 1
    },
    {
      id: 'D003',
      displayNumber: 'D-2024-003',
      displayClient: 'Pharmacie Centrale',
      displayAdresse: '28 Rue du Commerce, 92100 Boulogne',
      displayTelephone: '',
      deliveryStatus: 'livre',
      deliveryZone: 'petite_couronne',
      deliveryPriority: 'low',
      isUrgentDelivery: false,
      amount: null,
      estimatedTime: null,
      distance: 12.4,
      deliveryDate: '2024-01-14',
      comments: 'Livraison effectuée avec succès',
      retryCount: 0
    }
  ];

  // Handlers pour les actions (demo)
  const handleStartDelivery = (dossier) => {
    notificationService.info(`Démarrage de la livraison pour ${dossier.displayNumber}`);
  };

  const handleShowDetails = (dossier) => {
    notificationService.info(`Détails du dossier ${dossier.displayNumber}`);
  };

  const handleNavigateToAddress = (dossier) => {
    notificationService.info(`Navigation vers ${dossier.displayAdresse}`);
  };

  const handleCallClient = (dossier) => {
    notificationService.info(`Appel vers ${dossier.displayClient}: ${dossier.displayTelephone}`);
  };

  const handleMarkComplete = (dossier) => {
    notificationService.success(`Dossier ${dossier.displayNumber} marqué comme livré`);
  };

  const handleMarkFailed = (dossier) => {
    notificationService.error(`Dossier ${dossier.displayNumber} marqué en échec`);
  };

  const handleReschedule = (dossier) => {
    notificationService.info(`Livraison reportée pour ${dossier.displayNumber}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🚚 Interface Livreur V2 - Demo
          </h1>
          <p className="text-gray-600">
            Démonstration des nouveaux composants badges et cartes
          </p>
        </motion.div>

        {/* Section Badges */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📱 Badges Modernes
          </h2>
          
          <div className="space-y-8">
            {/* Badges de statut */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Statuts de livraison
              </h3>
              <div className="flex flex-wrap gap-3">
                {[
                  'imprime', 'pret_livraison', 'en_livraison', 
                  'livre', 'retour', 'echec_livraison', 'reporte', 'annule'
                ].map(status => (
                  <DeliveryStatusBadge key={status} status={status} />
                ))}
              </div>
            </div>

            {/* Badges de priorité */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Priorités avec détails
              </h3>
              <div className="flex flex-wrap gap-6">
                <DeliveryPriorityBadge 
                  priority="urgent" 
                  estimatedTime={15} 
                  distance={3.2} 
                />
                <DeliveryPriorityBadge 
                  priority="high" 
                  estimatedTime={25} 
                  distance={8.7} 
                />
                <DeliveryPriorityBadge 
                  priority="medium" 
                  estimatedTime={35} 
                  distance={12.4} 
                />
                <DeliveryPriorityBadge 
                  priority="low" 
                  estimatedTime={45} 
                  distance={18.9} 
                />
              </div>
            </div>

            {/* Badges de zone */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Zones géographiques
              </h3>
              <div className="flex flex-wrap gap-3">
                {[
                  'paris', 'banlieue', 'petite_couronne', 
                  'grande_couronne', 'idf', 'province', 'autre'
                ].map(zone => (
                  <ZoneBadge key={zone} zone={zone} />
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section Cartes */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            🃏 Cartes de Dossier V2
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {sampleDossiers.map((dossier, index) => (
              <DeliveryDossierCardV2
                key={dossier.id}
                dossier={dossier}
                index={index}
                onStartDelivery={handleStartDelivery}
                onShowDetails={handleShowDetails}
                onNavigateToAddress={handleNavigateToAddress}
                onCallClient={handleCallClient}
                onMarkComplete={handleMarkComplete}
                onMarkFailed={handleMarkFailed}
                onReschedule={handleReschedule}
                showActions={true}
                showMetadata={true}
              />
            ))}
          </div>
        </motion.section>

        {/* Section Variantes */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl shadow-sm p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            🎨 Variantes et Options
          </h2>
          
          <div className="space-y-8">
            {/* Différentes tailles de badges */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Tailles de badges
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <DeliveryStatusBadge status="pret_livraison" size="xs" />
                <DeliveryStatusBadge status="pret_livraison" size="sm" />
                <DeliveryStatusBadge status="pret_livraison" size="md" />
                <DeliveryStatusBadge status="pret_livraison" size="lg" />
              </div>
            </div>

            {/* Variantes de zones */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Variantes de zones
              </h3>
              <div className="flex flex-wrap gap-4">
                <ZoneBadge zone="paris" variant="default" />
                <ZoneBadge zone="paris" variant="outlined" />
                <ZoneBadge zone="paris" variant="subtle" />
              </div>
            </div>

            {/* Carte compacte */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Carte sans actions ni métadonnées
              </h3>
              <div className="max-w-md">
                <DeliveryDossierCardV2
                  dossier={sampleDossiers[0]}
                  showActions={false}
                  showMetadata={false}
                  layout="compact"
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Instructions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-blue-50 rounded-xl p-8"
        >
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            📋 Instructions d'utilisation
          </h2>
          <div className="prose prose-blue max-w-none">
            <p className="text-blue-800">
              Ces nouveaux composants remplacent les anciens badges et cartes du fichier LivreurDashboard.js.
              Ils offrent :
            </p>
            <ul className="text-blue-700 space-y-1">
              <li>• Design moderne avec support du thème sombre</li>
              <li>• Animations fluides et interactions avancées</li>
              <li>• Accessibilité améliorée (ARIA labels, tooltips)</li>
              <li>• Props flexibles pour différents cas d'usage</li>
              <li>• Performance optimisée avec React.memo</li>
              <li>• API cohérente et intuitive</li>
            </ul>
            <p className="text-blue-800 mt-4">
              Cliquez sur les boutons des cartes pour tester les interactions !
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default BadgesAndCardsDemo;