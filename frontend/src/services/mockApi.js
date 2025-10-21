// Service API mocké pour le développement frontend
// Utilisé quand le backend n'est pas disponible

// Données mockées
const MOCK_USERS = [
  {
    id: 1,
    prenom: 'Admin',
    nom: 'Principal',
    email: 'admin@evocomprint.com',
    role: 'admin',
    statut: 'actif',
  },
  {
    id: 2,
    prenom: 'Jean',
    nom: 'Preparateur',
    email: 'preparateur@evocomprint.com',
    role: 'preparateur',
    statut: 'actif',
  },
  {
    id: 3,
    prenom: 'Marc',
    nom: 'Roland',
    email: 'roland@evocomprint.com',
    role: 'imprimeur_roland',
    statut: 'actif',
  },
  {
    id: 4,
    prenom: 'Sophie',
    nom: 'Xerox',
    email: 'xerox@evocomprint.com',
    role: 'imprimeur_xerox',
    statut: 'actif',
  },
  {
    id: 5,
    prenom: 'Pierre',
    nom: 'Livreur',
    email: 'livreur@evocomprint.com',
    role: 'livreur',
    statut: 'actif',
  },
];

const MOCK_DOSSIERS = [];

const MOCK_FILES = [
  {
    id: 1,
    dossier_id: 1,
    original_filename: 'brochure_abc_v1.pdf',
    mimetype: 'application/pdf',
    size: 2048000,
    uploaded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    dossier_id: 1,
    original_filename: 'logo_abc.png',
    mimetype: 'image/png',
    size: 152000,
    uploaded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_HISTORY = [
  {
    dossier_id: 2,
    old_status: null,
    new_status: 'en_cours',
    changed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    prenom: 'Jean',
    nom: 'Preparateur',
    role: 'preparateur',
  },
  {
    dossier_id: 2,
    old_status: 'en_cours',
    new_status: 'a_revoir',
    changed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    prenom: 'Marc',
    nom: 'Roland',
    role: 'imprimeur_roland',
    notes: 'Fichier à revoir - qualité insuffisante',
  },
];

// Simulation d'un délai de réponse
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Services mockés
export const mockAuthService = {
  login: async (email, password) => {
    await delay(500);

    const user = MOCK_USERS.find(u => u.email === email);

    // Vérification simple du mot de passe (tous les mots de passe mockés sont 'password')
    if (
      user &&
      (
        password === 'password' ||
        password === 'admin123' ||
        password === 'prep123' ||
        password === 'roland123' ||
        password === 'xerox123' ||
        password === 'livreur123'
      )
    ) {
      const token = 'mock-jwt-token-' + Date.now();
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(user));
      return { user, token };
    }

    throw new Error('Email ou mot de passe incorrect');
  },

  logout: async () => {
    await delay(200);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  },

  getCurrentUser: async () => {
    await delay(300);
    const userData = localStorage.getItem('user_data');
    if (userData) {
      return { user: JSON.parse(userData) };
    }
    throw new Error('Utilisateur non connecté');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('auth_token');
  },

  getUserData: () => {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  },
};

export const mockUsersService = {
  getUsers: async (params = {}) => {
    await delay(300);

    let filteredUsers = [...MOCK_USERS];

    // Simulation de filtrage
    if (params.search) {
      const search = params.search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        user =>
          user.nom.toLowerCase().includes(search) ||
          user.prenom.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
      );
    }

    if (params.role) {
      filteredUsers = filteredUsers.filter(user => user.role === params.role);
    }

    // Simulation de pagination
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 10;
    const offset = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);

    return {
      users: paginatedUsers,
      pagination: {
        current_page: page,
        per_page: limit,
        total_items: filteredUsers.length,
        total_pages: Math.ceil(filteredUsers.length / limit),
      },
    };
  },

  createUser: async userData => {
    await delay(500);

    // Vérifier si l'email existe déjà
    if (MOCK_USERS.find(u => u.email === userData.email)) {
      throw new Error('Cet email est déjà utilisé');
    }

    const newUser = {
      id: Math.max(...MOCK_USERS.map(u => u.id)) + 1,
      ...userData,
      statut: 'actif',
    };

    MOCK_USERS.push(newUser);
    return { user: newUser };
  },

  updateUser: async (id, userData) => {
    await delay(500);

    const index = MOCK_USERS.findIndex(u => u.id === parseInt(id));
    if (index === -1) {
      throw new Error('Utilisateur non trouvé');
    }

    MOCK_USERS[index] = { ...MOCK_USERS[index], ...userData };
    return { user: MOCK_USERS[index] };
  },

  deleteUser: async id => {
    await delay(500);

    const index = MOCK_USERS.findIndex(u => u.id === parseInt(id));
    if (index === -1) {
      throw new Error('Utilisateur non trouvé');
    }

    MOCK_USERS.splice(index, 1);
    return { message: 'Utilisateur supprimé' };
  },
};

export const mockDossiersService = {
  getDossiers: async (params = {}) => {
    await delay(400);

    let filteredDossiers = [...MOCK_DOSSIERS];

    // Simulation de filtrage par statut
    if (params.status) {
      filteredDossiers = filteredDossiers.filter(d => d.status === params.status);
    }

    // Simulation de filtrage par type
    if (params.type) {
      filteredDossiers = filteredDossiers.filter(d => d.type === params.type);
    }

    // Simulation de recherche
    if (params.search) {
      const search = params.search.toLowerCase();
      filteredDossiers = filteredDossiers.filter(
        d =>
          d.numero_commande.toLowerCase().includes(search) ||
          d.client_nom.toLowerCase().includes(search) ||
          d.description.toLowerCase().includes(search)
      );
    }

    // Simulation de pagination
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 12;
    const offset = (page - 1) * limit;
    const paginatedDossiers = filteredDossiers.slice(offset, offset + limit);

    return {
      dossiers: paginatedDossiers,
      pagination: {
        current_page: page,
        per_page: limit,
        total_items: filteredDossiers.length,
        total_pages: Math.ceil(filteredDossiers.length / limit),
      },
    };
  },

  getDossier: async id => {
    await delay(300);

    const dossier = MOCK_DOSSIERS.find(d => d.id === parseInt(id));
    if (!dossier) {
      throw new Error('Ce dossier n\'existe pas ou n\'est pas accessible');
    }

    const files = MOCK_FILES.filter(f => f.dossier_id === parseInt(id));
    const status_history = MOCK_HISTORY.filter(h => h.dossier_id === parseInt(id));

    return {
      dossier,
      files,
      status_history,
    };
  },

  createDossier: async dossierData => {
    await delay(600);

    // Transformer les données du formulaire vers le format des dossiers mock
    const newDossier = {
      id: Math.max(...MOCK_DOSSIERS.map(d => d.id)) + 1,
      numero_commande: dossierData.numero,
      client_nom: dossierData.client,
      client_email: '', // Pas fourni par le formulaire
      client_telephone: '', // Pas fourni par le formulaire
      type: dossierData.type_formulaire,
      status: dossierData.statut || 'en_cours', // Utiliser le statut fourni
      description: `Formulaire ${dossierData.type_formulaire} - ${dossierData.preparateur}`,
      quantite: 1, // Par défaut
      format_papier: 'Custom', // Par défaut
      urgence: false, // Par défaut
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Conserver les données originales du formulaire
      data_formulaire: dossierData.data_formulaire,
      preparateur: dossierData.preparateur,
      type_formulaire: dossierData.type_formulaire,
    };

    MOCK_DOSSIERS.push(newDossier);
    return { dossier: newDossier };
  },

  changeStatus: async (id, newStatus, comment = null) => {
    await delay(400);

    const index = MOCK_DOSSIERS.findIndex(d => d.id === parseInt(id));
    if (index === -1) {
      throw new Error('Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation de modifier son statut');
    }

    // Vérifier que le commentaire est fourni pour le statut "à revoir"
    if (newStatus === 'a_revoir' && (!comment || comment.trim() === '')) {
      throw new Error('Un commentaire est obligatoire pour marquer un dossier à revoir');
    }

    const oldStatus = MOCK_DOSSIERS[index].status;
    MOCK_DOSSIERS[index].status = newStatus;
    MOCK_DOSSIERS[index].updated_at = new Date().toISOString();

    // Ajouter à l'historique
    const historyEntry = {
      dossier_id: parseInt(id),
      old_status: oldStatus,
      new_status: newStatus,
      changed_at: new Date().toISOString(),
      prenom: 'Utilisateur',
      nom: 'Mocké',
      role: 'admin',
    };

    // Ajouter le commentaire s'il est fourni
    if (comment && comment.trim() !== '') {
      historyEntry.notes = comment.trim();
    }

    MOCK_HISTORY.push(historyEntry);

    return {
      dossier: MOCK_DOSSIERS[index],
      old_status: oldStatus,
      new_status: newStatus,
    };
  },

  deleteDossier: async id => {
    await delay(300);
    const index = MOCK_DOSSIERS.findIndex(d => d.id === parseInt(id));
    if (index === -1) {
      throw new Error('Ce dossier n\'existe pas ou vous n\'avez pas l\'autorisation de le supprimer');
    }
    MOCK_DOSSIERS.splice(index, 1);
    return { message: 'Dossier supprimé' };
  },
};

// Fonction pour vérifier si on doit utiliser l'API mockée
export const shouldUseMockApi = () => {
  // Désactive le mode mock si REACT_APP_USE_REAL_API est défini à true
  if (process.env.REACT_APP_USE_REAL_API === 'true') return false;
  return process.env.NODE_ENV === 'development' && !process.env.REACT_APP_USE_REAL_API;
};
