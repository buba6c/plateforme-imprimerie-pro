import React, { useState } from 'react';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

const RolePermissions = () => {
  // Définition des permissions disponibles
  const permissions = [
    {
      id: 'dashboard',
      name: 'Tableau de bord',
      description: 'Accès au tableau de bord principal',
    },
    {
      id: 'users_read',
      name: 'Voir les utilisateurs',
      description: 'Consulter la liste des utilisateurs',
    },
    {
      id: 'users_write',
      name: 'Gérer les utilisateurs',
      description: 'Créer, modifier et supprimer des utilisateurs',
    },
    {
      id: 'dossiers_read',
      name: 'Voir les dossiers',
      description: 'Consulter les dossiers selon le rôle',
    },
    {
      id: 'dossiers_write',
      name: 'Gérer les dossiers',
      description: 'Créer et modifier des dossiers',
    },
    {
      id: 'dossiers_status',
      name: 'Changer le statut des dossiers',
      description: 'Modifier le statut des dossiers selon le workflow',
    },
    {
      id: 'files_read',
      name: 'Voir les fichiers',
      description: 'Consulter et télécharger les fichiers',
    },
    {
      id: 'files_write',
      name: 'Gérer les fichiers',
      description: 'Upload et suppression de fichiers',
    },
    {
      id: 'statistics',
      name: 'Statistiques',
      description: 'Accès aux statistiques et rapports',
    },
    {
      id: 'settings',
      name: 'Paramètres système',
      description: 'Configuration du système',
    },
  ];

  // Configuration des permissions par rôle
  const rolePermissions = {
    admin: [
      'dashboard',
      'users_read',
      'users_write',
      'dossiers_read',
      'dossiers_write',
      'dossiers_status',
      'files_read',
      'files_write',
      'statistics',
      'settings',
    ],
    preparateur: [
      'dashboard',
      'dossiers_read',
      'dossiers_write',
      'dossiers_status',
      'files_read',
      'files_write',
    ],
    imprimeur_roland: ['dashboard', 'dossiers_read', 'dossiers_status', 'files_read'],
    imprimeur_xerox: ['dashboard', 'dossiers_read', 'dossiers_status', 'files_read'],
    livreur: ['dashboard', 'dossiers_read', 'dossiers_status'],
  };

  const [selectedRole, setSelectedRole] = useState('admin');

  const getRoleLabel = role => {
    const roleLabels = {
      admin: 'Administrateur',
      preparateur: 'Préparateur',
      imprimeur_roland: 'Imprimeur Roland',
      imprimeur_xerox: 'Imprimeur Xerox',
      livreur: 'Livreur',
    };
    return roleLabels[role] || role;
  };

  const getRoleColor = role => {
    const roleColors = {
      admin: 'bg-error-100 text-red-800 border-red-200',
      preparateur: 'bg-blue-100 text-blue-800 border-blue-200',
      imprimeur_roland: 'bg-purple-100 text-purple-800 border-purple-200',
      imprimeur_xerox: 'bg-green-100 text-green-800 border-green-200',
      livreur: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return roleColors[role] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700';
  };

  const hasPermission = (role, permission) => {
    return rolePermissions[role]?.includes(permission) || false;
  };

  const getRoleDescription = role => {
    const descriptions = {
      admin:
        'Accès complet à toutes les fonctionnalités de la plateforme. Peut gérer les utilisateurs, voir toutes les statistiques et configurer le système.',
      preparateur:
        'Responsable de la création et préparation des dossiers. Peut uploader les fichiers et faire avancer les dossiers dans le workflow.',
      imprimeur_roland:
        'Accès aux dossiers Roland prêts pour impression. Peut changer le statut des dossiers assignés et consulter les fichiers.',
      imprimeur_xerox:
        'Accès aux dossiers Xerox prêts pour impression. Peut changer le statut des dossiers assignés et consulter les fichiers.',
      livreur:
        'Accès aux dossiers prêts pour livraison. Peut marquer les dossiers comme livrés et suivre les livraisons en cours.',
    };
    return descriptions[role] || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Rôles et Permissions</h2>
          <p className="text-neutral-600 dark:text-neutral-300">Configuration des accès par rôle utilisateur</p>
        </div>
      </div>

      {/* Info générale */}
      <div className="bg-blue-50 border border-primary-200 rounded-md p-4">
        <div className="flex">
          <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-primary-800">
              À propos des rôles et permissions
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Cette interface affiche les permissions actuelles pour chaque rôle. Les permissions
              sont définies dans le code backend et ne peuvent pas être modifiées depuis cette
              interface pour des raisons de sécurité.
            </p>
          </div>
        </div>
      </div>

      {/* Sélecteur de rôle */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Sélectionner un rôle</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.keys(rolePermissions).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`p-4 rounded-lg border-2 text-center transition-all duration-200 ${
                  selectedRole === role
                    ? getRoleColor(role) + ' shadow-md dark:shadow-secondary-900/20'
                    : 'bg-white dark:bg-neutral-800 border-neutral-200 hover:border-neutral-300 text-neutral-700 dark:text-neutral-200'
                }`}
              >
                <UserGroupIcon className="h-8 w-8 mx-auto mb-2" />
                <div className="font-medium">{getRoleLabel(role)}</div>
                <div className="text-xs mt-1">{rolePermissions[role].length} permissions</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Détails du rôle sélectionné */}
      {selectedRole && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Description du rôle */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${getRoleColor(selectedRole)}`}>
                  <UserGroupIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    {getRoleLabel(selectedRole)}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    {rolePermissions[selectedRole].length} permissions accordées
                  </p>
                </div>
              </div>
            </div>
            <div className="card-body">
              <p className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">
                {getRoleDescription(selectedRole)}
              </p>

              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-300">Permissions accordées</span>
                  <span className="font-semibold text-blue-600">
                    {rolePermissions[selectedRole].length}/{permissions.length}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 rounded-full h-2 transition-all duration-300"
                      style={{
                        width: `${(rolePermissions[selectedRole].length / permissions.length) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des permissions */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Permissions détaillées</h3>
              </div>
              <div className="card-body p-0">
                <div className="divide-y divide-secondary-200">
                  {permissions.map(permission => {
                    const hasAccess = hasPermission(selectedRole, permission.id);

                    return (
                      <div key={permission.id} className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {hasAccess ? (
                              <CheckCircleIcon className="h-5 w-5 text-success-600" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 text-neutral-300" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4
                                className={`text-sm font-medium ${
                                  hasAccess ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'
                                }`}
                              >
                                {permission.name}
                              </h4>
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  hasAccess
                                    ? 'bg-success-100 text-success-800'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                                }`}
                              >
                                {hasAccess ? 'Accordée' : 'Refusée'}
                              </span>
                            </div>
                            <p
                              className={`text-sm mt-1 ${
                                hasAccess ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-400'
                              }`}
                            >
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matrice des permissions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Matrice des permissions</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            Vue d'ensemble des permissions pour tous les rôles
          </p>
        </div>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Permission
                  </th>
                  {Object.keys(rolePermissions).map(role => (
                    <th
                      key={role}
                      className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider"
                    >
                      {getRoleLabel(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-800 divide-y divide-secondary-200">
                {permissions.map((permission, index) => (
                  <tr
                    key={permission.id}
                    className={index % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-900'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {permission.name}
                        </div>
                        <div className="text-sm text-neutral-500">{permission.description}</div>
                      </div>
                    </td>
                    {Object.keys(rolePermissions).map(role => (
                      <td key={role} className="px-3 py-4 whitespace-nowrap text-center">
                        {hasPermission(role, permission.id) ? (
                          <CheckCircleIcon className="h-5 w-5 text-success-600 mx-auto" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-neutral-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePermissions;
