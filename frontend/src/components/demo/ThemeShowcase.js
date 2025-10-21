import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  UserIcon,
  PrinterIcon,
  TruckIcon
} from '@heroicons/react/24/outline';

/**
 * Composant d'exemple pour démontrer l'utilisation du système de thème unifié
 * 
 * Ce composant utilise les classes CSS du thème global au lieu de Tailwind spécifique
 * pour permettre la personnalisation via l'interface admin
 */
const ThemeShowcase = () => {
  const demoCards = [
    {
      id: 1,
      title: 'Nouveau Dossier',
      description: 'Impression Roland - Format A3',
      status: 'success',
      icon: PrinterIcon,
      gradient: true,
      stats: { files: 5, priority: 'high' }
    },
    {
      id: 2,
      title: 'En Livraison',
      description: 'Livraison prévue aujourd\'hui',
      status: 'warning',
      icon: TruckIcon,
      gradient: false,
      stats: { files: 12, priority: 'medium' }
    },
    {
      id: 3,
      title: 'Dossier Terminé',
      description: 'Impression Xerox - Terminée',
      status: 'completed',
      icon: CheckCircleIcon,
      gradient: true,
      stats: { files: 8, priority: 'low' }
    }
  ];

  const getStatusConfig = (status) => {
    const configs = {
      success: {
        badge: 'badge badge-success',
        icon: CheckCircleIcon,
        color: 'text-success-600'
      },
      warning: {
        badge: 'badge badge-warning',
        icon: ClockIcon,
        color: 'text-warning-600'
      },
      completed: {
        badge: 'badge badge-primary',
        icon: CheckCircleIcon,
        color: 'text-primary-600'
      }
    };
    return configs[status] || configs.success;
  };

  return (
    <div className="space-y-8">
      {/* Header de démonstration */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h1 className="gradient-text text-3xl font-bold mb-4">
          🎨 Démonstration du Thème Unifié
        </h1>
        <p className="text-neutral-600 dark:text-neutral-300">
          Cette interface utilise le système de thème global et s'adapte automatiquement 
          aux couleurs configurées dans les paramètres admin.
        </p>
      </motion.div>

      {/* Boutons de démonstration */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Boutons et Actions</h2>
          <p className="card-subtitle">
            Tous les styles utilisent les variables CSS du thème
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <button className="btn">
            <PrinterIcon className="h-5 w-5" />
            Nouveau Dossier
          </button>
          <button className="btn-outline">
            <UserIcon className="h-5 w-5" />
            Gérer Utilisateurs
          </button>
          <span className="badge badge-primary">En cours</span>
          <span className="badge badge-success">Terminé</span>
          <span className="badge badge-warning">En attente</span>
          <span className="badge badge-error">Erreur</span>
        </div>
      </div>

      {/* Cartes de démonstration */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Cartes Adaptatives
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoCards.map((card, index) => {
            const statusConfig = getStatusConfig(card.status);
            const IconComponent = card.icon;
            
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card hover-lift ${card.gradient ? 'glass-effect' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                    <IconComponent className={`h-6 w-6 ${statusConfig.color}`} />
                  </div>
                  <span className={statusConfig.badge}>
                    {card.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                  {card.title}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-4">
                  {card.description}
                </p>

                <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                  <span>{card.stats.files} fichiers</span>
                  <span className={`font-medium ${
                    card.stats.priority === 'high' ? 'text-error-600' :
                    card.stats.priority === 'medium' ? 'text-warning-600' :
                    'text-success-600'
                  }`}>
                    Priorité {card.stats.priority}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Formulaire de démonstration */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Formulaire Unifié</h2>
          <p className="card-subtitle">
            Les champs utilisent les variables du thème
          </p>
        </div>

        <form className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Nom du client</label>
              <input 
                type="text" 
                className="form-input w-full" 
                placeholder="Entrez le nom du client"
              />
            </div>
            <div>
              <label className="form-label">Type d'impression</label>
              <select className="form-input w-full">
                <option>Roland - Grand Format</option>
                <option>Xerox - Numérique</option>
                <option>Autre</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Description du projet</label>
            <textarea 
              className="form-input w-full h-24" 
              placeholder="Décrivez les détails du projet..."
            ></textarea>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline">
              <XCircleIcon className="h-5 w-5" />
              Annuler
            </button>
            <button type="submit" className="btn">
              <CheckCircleIcon className="h-5 w-5" />
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      {/* Table de démonstration */}
      <div className="table-container">
        <div className="table-header p-4">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            Tableau Unifié
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Dossier
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {['D2025-001', 'D2025-002', 'D2025-003'].map((dossier, index) => (
                <tr key={dossier} className="table-row border-t border-neutral-200 dark:border-neutral-700">
                  <td className="px-4 py-3 text-neutral-900 dark:text-white font-medium">
                    {dossier}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                    Client {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className={index === 0 ? 'badge badge-success' : 
                                   index === 1 ? 'badge badge-warning' : 
                                   'badge badge-primary'}>
                      {index === 0 ? 'Terminé' : index === 1 ? 'En cours' : 'Nouveau'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="btn-outline text-sm py-1 px-3">
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer informatif */}
      <div className="card bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-primary-200 dark:border-primary-700">
        <div className="text-center">
          <h3 className="text-lg font-bold gradient-text mb-2">
            🚀 Thème Entièrement Personnalisable
          </h3>
          <p className="text-neutral-600 dark:text-neutral-300">
            Modifiez les couleurs dans <strong>Admin → Paramètres → Thème</strong> pour voir tous ces éléments s'adapter automatiquement !
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThemeShowcase;