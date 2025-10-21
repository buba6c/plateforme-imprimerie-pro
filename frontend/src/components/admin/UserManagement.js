import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { usersService } from '../../services/apiAdapter';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtres et recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    loadUsers();
  }, []);

  const filterUsers = useCallback(() => {
    const filtered = users.filter(user => {
      const matchesSearch =
        (user.prenom || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.nom || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.telephone && user.telephone.includes(searchTerm));

      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'inactive' && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [users, searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersService.getUsers({ limit: 100 });
      setUsers(response.users || []);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

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
      admin: 'bg-error-100 text-red-800',
      preparateur: 'bg-blue-100 text-blue-800',
      imprimeur_roland: 'bg-purple-100 text-purple-800',
      imprimeur_xerox: 'bg-green-100 text-green-800',
      livreur: 'bg-yellow-100 text-yellow-800',
    };
    return roleColors[role] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100';
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowCreateModal(true);
  };

  const handleEditUser = user => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeleteUser = user => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await usersService.deleteUser(selectedUser.id);
      setUsers(users.filter(u => u.id !== selectedUser.id));
      setSuccess('Utilisateur supprimé avec succès');
      setShowDeleteModal(false);
    } catch (err) {
      console.error('Erreur suppression utilisateur:', err);
      setError('Erreur lors de la suppression');
    }
  };

  // Calcul pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
          <div className="flex justify-between">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-400" />
              <div className="ml-3">
                <p className="text-sm text-danger-800">{error}</p>
              </div>
            </div>
            <button onClick={clearMessages} className="text-danger-400 hover:text-danger-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-success-50 border border-success-200 rounded-md p-4">
          <div className="flex justify-between">
            <div className="flex">
              <CheckIcon className="h-5 w-5 text-success-400" />
              <div className="ml-3">
                <p className="text-sm text-success-800">{success}</p>
              </div>
            </div>
            <button onClick={clearMessages} className="text-success-400 hover:text-success-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header et actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Gestion des utilisateurs</h2>
          <p className="text-neutral-600 dark:text-neutral-300 mt-1">
            {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
            {users.length !== filteredUsers.length && ` sur ${users.length}`}
          </p>
        </div>

        <button onClick={handleCreateUser} className="btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Filtres et recherche */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Recherche */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="form-input pl-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtre par rôle */}
            <select
              className="form-input"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">Tous les rôles</option>
              <option value="admin">Administrateur</option>
              <option value="preparateur">Préparateur</option>
              <option value="imprimeur_roland">Imprimeur Roland</option>
              <option value="imprimeur_xerox">Imprimeur Xerox</option>
              <option value="livreur">Livreur</option>
            </select>

            {/* Filtre par statut */}
            <select
              className="form-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>

            {/* Reset filtres */}
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('');
                setStatusFilter('');
              }}
              className="btn-secondary"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Effacer
            </button>
          </div>
        </div>
      </div>

      {/* Table des utilisateurs */}
      <div className="card">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Dernière connexion
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-800 divide-y divide-secondary-200">
                {currentUsers.map(user => (
                  <tr key={user.id} className="hover:bg-neutral-50 dark:bg-neutral-900">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                          <span className="text-blue-600 font-semibold text-sm">
                            {user.prenom ? user.prenom.charAt(0).toUpperCase() : ''}
                            {user.nom ? user.nom.charAt(0).toUpperCase() : ''}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">
                            {user.prenom || ''} {user.nom || ''}
                          </div>
                          <div className="text-sm text-neutral-500">{user.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                      {user.telephone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.is_active
                            ? 'bg-success-100 text-success-800'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100'
                        }`}
                      >
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString('fr-FR')
                        : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Modifier"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="text-danger-600 hover:text-danger-900 p-1"
                          title="Supprimer"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* État vide */}
          {currentUsers.length === 0 && (
            <div className="text-center py-12">
              <UserIcon className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">
                {filteredUsers.length === 0
                  ? 'Aucun utilisateur trouvé'
                  : 'Aucun utilisateur sur cette page'}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-700 dark:text-neutral-200">
                Affichage de {indexOfFirstItem + 1} à{' '}
                {Math.min(indexOfLastItem, filteredUsers.length)} sur {filteredUsers.length}{' '}
                résultats
              </p>

              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`btn-sm ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {showCreateModal && (
        <UserFormModal
          user={null}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={newUser => {
            setUsers([newUser, ...users]);
            setSuccess('Utilisateur créé avec succès');
            setShowCreateModal(false);
          }}
          onError={error => setError(error)}
        />
      )}

      {showEditModal && selectedUser && (
        <UserFormModal
          user={selectedUser}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={updatedUser => {
            setUsers(users.map(u => (u.id === updatedUser.id ? updatedUser : u)));
            setSuccess('Utilisateur modifié avec succès');
            setShowEditModal(false);
          }}
          onError={error => setError(error)}
        />
      )}

      {showDeleteModal && selectedUser && (
        <DeleteConfirmModal
          user={selectedUser}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

// Composant modal pour créer/modifier un utilisateur
const UserFormModal = ({ user, isOpen, onClose, onSuccess, onError }) => {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    role: user?.role || 'preparateur',
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    telephone: user?.telephone || '',
    is_active: user?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    // Validation des champs obligatoires
    const requiredFields = ['email', 'prenom', 'nom', 'role'];
    for (const field of requiredFields) {
      if (!formData[field] || formData[field].trim() === '') {
        onError(`Le champ ${field} est obligatoire.`);
        setLoading(false);
        return;
      }
    }

    // Correction : garantir que prenom et nom sont envoyés séparément et non vides
    const updateData = { ...formData };
    updateData.email = updateData.email.trim();
    updateData.prenom = updateData.prenom.trim();
    updateData.nom = updateData.nom.trim();
    updateData.role = updateData.role.trim();

    try {
      if (user) {
        // Modification
        if (!updateData.password) {
          delete updateData.password;
        }
        // Correction : garantir que prenom et nom sont transmis
        if (!updateData.prenom || !updateData.nom) {
          onError('Le prénom et le nom sont obligatoires.');
          setLoading(false);
          return;
        }
        const response = await usersService.updateUser(user.id, updateData);
        onSuccess(response.user);
      } else {
        // Création
        if (!updateData.prenom || !updateData.nom) {
          onError('Le prénom et le nom sont obligatoires.');
          setLoading(false);
          return;
        }
        const response = await usersService.createUser(updateData);
        onSuccess(response.user);
      }
    } catch (err) {
      // Log complet de la réponse d'erreur pour diagnostic
      if (err.response) {
        console.error('Erreur API:', err.response.status, err.response.data);
        onError(err.response.data?.error || `Erreur API (${err.response.status})`);
      } else {
        console.error('Erreur sauvegarde utilisateur:', err);
        onError(err.error || 'Erreur lors de la sauvegarde');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-neutral-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl dark:shadow-secondary-900/30 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-neutral-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-4">
                {user ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
              </h3>

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>

                {/* Mot de passe */}
                <div>
                  <label className="form-label">
                    Mot de passe {user ? '(laisser vide pour ne pas changer)' : '*'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="form-input"
                    required={!user}
                  />
                </div>

                {/* Prénom et Nom */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Prénom *</label>
                    <input
                      type="text"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Nom *</label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                {/* Téléphone */}
                <div>
                  <label className="form-label">Téléphone</label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                {/* Rôle */}
                <div>
                  <label className="form-label">Rôle *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    <option value="preparateur">Préparateur</option>
                    <option value="imprimeur_roland">Imprimeur Roland</option>
                    <option value="imprimeur_xerox">Imprimeur Xerox</option>
                    <option value="livreur">Livreur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>

                {/* Statut */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-600 rounded"
                  />
                  <label className="ml-2 block text-sm text-neutral-900 dark:text-white">Utilisateur actif</label>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary sm:ml-3 w-full sm:w-auto"
              >
                {loading ? 'Sauvegarde...' : user ? 'Modifier' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary mt-3 sm:mt-0 w-full sm:w-auto"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Composant modal de confirmation de suppression
const DeleteConfirmModal = ({ user, isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-neutral-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left overflow-hidden shadow-xl dark:shadow-secondary-900/30 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-neutral-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-danger-100 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationTriangleIcon className="h-6 w-6 text-danger-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-white">
                  Supprimer l'utilisateur
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-neutral-500">
                    Êtes-vous sûr de vouloir supprimer{' '}
                    <strong>
                      {user.prenom} {user.nom}
                    </strong>{' '}
                    ? Cette action est irréversible.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onConfirm}
              className="btn-danger sm:ml-3 w-full sm:w-auto"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary mt-3 sm:mt-0 w-full sm:w-auto"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
