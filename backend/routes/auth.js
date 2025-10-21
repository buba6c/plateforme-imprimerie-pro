const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const router = express.Router();

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET || 'imprimerie_jwt_secret_key_2024_super_secure';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ================================
// UTILITAIRES
// ================================

// Générer un token JWT
const generateToken = user => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    nom: user.nom,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Valider le token JWT (middleware)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: "Token d'authentification requis",
      code: 'MISSING_TOKEN',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN',
      });
    }

    req.user = user;
    next();
  });
};

// Vérifier les rôles autorisés
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès refusé - permissions insuffisantes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_roles: roles,
        user_role: req.user.role,
      });
    }
    next();
  };
};

// ================================
// ROUTES D'AUTHENTIFICATION
// ================================

// POST /api/auth/login - Connexion utilisateur
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des champs
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email et mot de passe requis',
        code: 'MISSING_CREDENTIALS',
      });
    }

    // Rechercher l'utilisateur dans la base de données
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const user = userResult.rows[0];

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Vérifier si l'utilisateur est actif
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Compte utilisateur désactivé',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Générer le token
    const token = generateToken(user);

    // Réponse de connexion réussie (sans le mot de passe)
    const { password_hash: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: userWithoutPassword,
      expiresIn: JWT_EXPIRES_IN,
    });

    console.log(`✅ Connexion réussie: ${user.email} (${user.role})`);
  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /api/auth/register - Inscription (admin seulement)
router.post('/register', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { email, password, role, prenom, nom, telephone } = req.body;

    // Validation des champs requis
    if (!email || !password || !role || !prenom || !nom) {
      return res.status(400).json({
        error: 'Tous les champs sont requis (email, password, role, prenom, nom)',
        code: 'MISSING_FIELDS',
      });
    }

    // Validation du rôle
    const validRoles = ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Rôle invalide',
        code: 'INVALID_ROLE',
        valid_roles: validRoles,
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Un utilisateur avec cet email existe déjà',
        code: 'EMAIL_EXISTS',
      });
    }

    // Hasher le mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const newUserResult = await query(
      `INSERT INTO users (email, password_hash, role, nom, is_active, created_at) 
       VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP) 
       RETURNING id, email, role, nom, is_active, created_at`,
      [email.toLowerCase(), hashedPassword, role, `${prenom} ${nom}`]
    );

    const newUser = newUserResult.rows[0];

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: newUser,
    });

    console.log(`✅ Nouvel utilisateur créé: ${newUser.email} (${newUser.role})`);
  } catch (error) {
    console.error("❌ Erreur lors de l'inscription:", error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/auth/me - Informations utilisateur actuel
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Récupérer les informations à jour de l'utilisateur
    const userResult = await query(
      'SELECT id, email, role, nom, is_active, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Compte utilisateur désactivé',
        code: 'ACCOUNT_DISABLED',
      });
    }

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /api/auth/refresh - Rafraîchir le token
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    // Générer un nouveau token avec les mêmes informations
    const newToken = generateToken(req.user);

    res.status(200).json({
      message: 'Token rafraîchi',
      token: newToken,
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (error) {
    console.error('❌ Erreur lors du rafraîchissement du token:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// POST /api/auth/logout - Déconnexion (côté client principalement)
router.post('/logout', authenticateToken, (req, res) => {
  // Dans un système JWT stateless, la déconnexion se fait côté client
  // en supprimant le token. Ici on peut juste confirmer la déconnexion
  res.status(200).json({
    message: 'Déconnexion réussie',
  });

  console.log(`✅ Déconnexion: ${req.user.email}`);
});

// GET /api/auth/roles - Liste des rôles disponibles
router.get('/roles', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const roles = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'preparateur', label: 'Préparateur' },
    { value: 'imprimeur_roland', label: 'Imprimeur Roland' },
    { value: 'imprimeur_xerox', label: 'Imprimeur Xerox' },
    { value: 'livreur', label: 'Livreur' },
  ];

  res.status(200).json({ roles });
});

// ================================
// EXPORT
// ================================

module.exports = router;
