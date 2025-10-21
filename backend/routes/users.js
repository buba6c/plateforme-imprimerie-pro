const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// ================================
// ROUTES UTILISATEURS
// ================================

// GET /api/users - Liste des utilisateurs (admin seulement)
router.get('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const { role, is_active, page = 1, limit = 20, search = '' } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCounter = 1;

    // Filtres optionnels
    if (role) {
      whereConditions.push(`role = $${paramCounter}`);
      queryParams.push(role);
      paramCounter++;
    }

    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramCounter}`);
      queryParams.push(is_active === 'true');
      paramCounter++;
    }

    // Recherche textuelle
    if (search.trim()) {
      whereConditions.push(`(
        email ILIKE $${paramCounter} OR 
        prenom ILIKE $${paramCounter} OR 
        nom ILIKE $${paramCounter} OR
        telephone ILIKE $${paramCounter}
      )`);
      queryParams.push(`%${search.trim()}%`);
      paramCounter++;
    }

    // Construction de la clause WHERE
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit));
    const limitIndex = paramCounter++;
    queryParams.push(offset);
    const offsetIndex = paramCounter++;

    // Requête principale (sans les mots de passe)
    const usersResult = await query(
      `SELECT 
        id, email, role, nom, created_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      queryParams
    );

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams.slice(0, -2) // Enlever limit et offset
    );

    const users = usersResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      users,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_items: total,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_previous: parseInt(page) > 1,
      },
      filters: {
        role,
        is_active,
        search,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération utilisateurs:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/users/:id - Détails d'un utilisateur (admin seulement)
router.get('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await query(
      `SELECT 
        id, email, role, nom, created_at
      FROM users 
      WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = userResult.rows[0];

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// PUT /api/users/:id - Modifier un utilisateur (admin seulement)
router.put('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, prenom, nom, telephone, is_active } = req.body;

    // Vérifier si l'utilisateur existe
    const existingUserResult = await query('SELECT id FROM users WHERE id = $1', [id]);

    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND',
      });
    }

    // Vérifier l'unicité de l'email si modifié
    if (email) {
      const emailExistsResult = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [
        email.toLowerCase(),
        id,
      ]);

      if (emailExistsResult.rows.length > 0) {
        return res.status(409).json({
          error: 'Cet email est déjà utilisé',
          code: 'EMAIL_EXISTS',
        });
      }
    }

    // Construction dynamique de la requête UPDATE
    let updateFields = [];
    let updateParams = [];
    let paramCounter = 1;

    if (email !== undefined) {
      updateFields.push(`email = $${paramCounter}`);
      updateParams.push(email.toLowerCase());
      paramCounter++;
    }

    if (role !== undefined) {
      const validRoles = ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Rôle invalide',
          code: 'INVALID_ROLE',
          valid_roles: validRoles,
        });
      }
      updateFields.push(`role = $${paramCounter}`);
      updateParams.push(role);
      paramCounter++;
    }

    if (prenom !== undefined) {
      updateFields.push(`prenom = $${paramCounter}`);
      updateParams.push(prenom);
      paramCounter++;
    }

    if (nom !== undefined) {
      updateFields.push(`nom = $${paramCounter}`);
      updateParams.push(nom);
      paramCounter++;
    }

    if (telephone !== undefined) {
      updateFields.push(`telephone = $${paramCounter}`);
      updateParams.push(telephone);
      paramCounter++;
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCounter}`);
      updateParams.push(is_active);
      paramCounter++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Aucun champ à modifier',
        code: 'NO_FIELDS_TO_UPDATE',
      });
    }

    // Ajouter updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Ajouter l'ID pour la clause WHERE
    updateParams.push(id);

    // Exécuter la mise à jour
    const updateResult = await query(
      `UPDATE users 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCounter}
       RETURNING id, email, role, prenom, nom, telephone, is_active, created_at, last_login, updated_at`,
      updateParams
    );

    const updatedUser = updateResult.rows[0];

    res.status(200).json({
      message: 'Utilisateur modifié avec succès',
      user: updatedUser,
    });

    console.log(`✅ Utilisateur modifié: ${updatedUser.email}`);
  } catch (error) {
    console.error('❌ Erreur modification utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// DELETE /api/users/:id - Supprimer un utilisateur (admin seulement)
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur ne se supprime pas lui-même
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        error: 'Impossible de supprimer votre propre compte',
        code: 'CANNOT_DELETE_SELF',
      });
    }

    // Vérifier si l'utilisateur existe
    const existingUserResult = await query('SELECT email FROM users WHERE id = $1', [id]);

    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND',
      });
    }

    const userEmail = existingUserResult.rows[0].email;

    // Supprimer l'utilisateur
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.status(200).json({
      message: 'Utilisateur supprimé avec succès',
    });

    console.log(`✅ Utilisateur supprimé: ${userEmail}`);
  } catch (error) {
    console.error('❌ Erreur suppression utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

// GET /api/users/stats - Statistiques utilisateurs (admin seulement)
router.get('/stats/summary', authorizeRoles('admin'), async (req, res) => {
  try {
    // Statistiques par rôle
    const roleStatsResult = await query(
      `SELECT 
        role, 
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
      FROM users 
      GROUP BY role
      ORDER BY role`
    );

    // Total des utilisateurs
    const totalResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_total,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '30 days' THEN 1 END) as recent_login_count
      FROM users`
    );

    // Dernières connexions
    const recentLoginsResult = await query(
      `SELECT email, prenom, nom, role, last_login
      FROM users 
      WHERE last_login IS NOT NULL
      ORDER BY last_login DESC
      LIMIT 10`
    );

    res.status(200).json({
      role_stats: roleStatsResult.rows,
      total_stats: totalResult.rows[0],
      recent_logins: recentLoginsResult.rows,
    });
  } catch (error) {
    console.error('❌ Erreur récupération statistiques:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'SERVER_ERROR',
    });
  }
});

module.exports = router;
