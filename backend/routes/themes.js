const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/**
 * Routes API pour la gestion des thèmes
 * 
 * Endpoints:
 * - GET /api/themes - Liste tous les thèmes
 * - GET /api/themes/custom - Liste thèmes personnalisés uniquement
 * - GET /api/themes/:id - Détails d'un thème
 * - POST /api/themes - Créer un thème (admin)
 * - PUT /api/themes/:id - Modifier un thème (admin)
 * - DELETE /api/themes/:id - Supprimer un thème (admin)
 * - GET /api/users/:userId/theme - Préférence thème utilisateur
 * - PUT /api/users/:userId/theme - Sauvegarder préférence
 */

// GET /api/themes/public - Liste publique des thèmes (sans auth)
router.get('/public', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, display_name, colors, is_custom
       FROM themes 
       WHERE is_active = true
       ORDER BY is_custom ASC, created_at DESC`
    );

    res.json({ 
      success: true,
      themes: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors du chargement des thèmes',
      message: error.message 
    });
  }
});

// GET /api/themes - Liste tous les thèmes actifs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, display_name, colors, is_custom, is_active, 
              created_by, created_at, updated_at
       FROM themes 
       WHERE is_active = true
       ORDER BY is_custom ASC, created_at DESC`
    );

    res.json({ 
      success: true,
      themes: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors du chargement des thèmes',
      message: error.message 
    });
  }
});

// GET /api/themes/custom - Liste uniquement les thèmes personnalisés
router.get('/custom', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.display_name, t.colors, t.is_custom, 
              t.created_by, t.created_at, t.updated_at,
              u.nom as creator_name, u.prenom as creator_firstname
       FROM themes t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.is_custom = true AND t.is_active = true
       ORDER BY t.created_at DESC`
    );

    res.json({ 
      success: true,
      themes: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching custom themes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors du chargement des thèmes personnalisés',
      message: error.message 
    });
  }
});

// GET /api/themes/:id - Détails d'un thème spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT t.*, u.nom as creator_name, u.prenom as creator_firstname
       FROM themes t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1 AND t.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Thème non trouvé' 
      });
    }

    res.json({ 
      success: true,
      theme: result.rows[0] 
    });
  } catch (error) {
    console.error('Error fetching theme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors du chargement du thème',
      message: error.message 
    });
  }
});

// POST /api/themes - Créer un nouveau thème (admin seulement)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, displayName, colors } = req.body;
    
    // Validation
    if (!name || !displayName || !colors) {
      return res.status(400).json({ 
        success: false,
        error: 'Nom, nom d\'affichage et couleurs sont requis' 
      });
    }

    // Vérifier que le nom n'existe pas déjà
    const existingTheme = await pool.query(
      'SELECT id FROM themes WHERE name = $1',
      [name]
    );

    if (existingTheme.rows.length > 0) {
      return res.status(409).json({ 
        success: false,
        error: 'Un thème avec ce nom existe déjà' 
      });
    }

    // Créer le thème
    const result = await pool.query(
      `INSERT INTO themes (name, display_name, colors, is_custom, created_by)
       VALUES ($1, $2, $3, true, $4)
       RETURNING *`,
      [name, displayName, JSON.stringify(colors), req.user.id]
    );

    res.status(201).json({ 
      success: true,
      message: 'Thème créé avec succès',
      theme: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating theme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la création du thème',
      message: error.message 
    });
  }
});

// PUT /api/themes/:id - Modifier un thème existant (admin seulement)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, colors } = req.body;

    // Validation
    if (!displayName || !colors) {
      return res.status(400).json({ 
        success: false,
        error: 'Nom d\'affichage et couleurs sont requis' 
      });
    }

    // Vérifier que le thème existe et est personnalisé
    const checkTheme = await pool.query(
      'SELECT is_custom FROM themes WHERE id = $1',
      [id]
    );

    if (checkTheme.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Thème non trouvé' 
      });
    }

    if (!checkTheme.rows[0].is_custom) {
      return res.status(403).json({ 
        success: false,
        error: 'Les thèmes par défaut ne peuvent pas être modifiés' 
      });
    }

    // Mettre à jour le thème
    const result = await pool.query(
      `UPDATE themes 
       SET display_name = $1, colors = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND is_custom = true
       RETURNING *`,
      [displayName, JSON.stringify(colors), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Thème non trouvé ou non modifiable' 
      });
    }

    res.json({ 
      success: true,
      message: 'Thème modifié avec succès',
      theme: result.rows[0] 
    });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la modification du thème',
      message: error.message 
    });
  }
});

// DELETE /api/themes/:id - Supprimer un thème (admin seulement)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le thème existe et est personnalisé
    const checkTheme = await pool.query(
      'SELECT is_custom FROM themes WHERE id = $1',
      [id]
    );

    if (checkTheme.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Thème non trouvé' 
      });
    }

    if (!checkTheme.rows[0].is_custom) {
      return res.status(403).json({ 
        success: false,
        error: 'Les thèmes par défaut ne peuvent pas être supprimés' 
      });
    }

    // Soft delete (désactiver au lieu de supprimer)
    const result = await pool.query(
      `UPDATE themes 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_custom = true
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Thème non trouvé ou non supprimable' 
      });
    }

    res.json({ 
      success: true,
      message: 'Thème supprimé avec succès' 
    });
  } catch (error) {
    console.error('Error deleting theme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la suppression du thème',
      message: error.message 
    });
  }
});

// GET /api/themes/users/:userId - Récupérer la préférence de thème d'un utilisateur
router.get('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Vérifier que l'utilisateur demande son propre thème ou est admin
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Accès non autorisé' 
      });
    }

    const result = await pool.query(
      'SELECT theme_name FROM user_theme_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        success: true,
        theme: 'system' // Thème par défaut
      });
    }

    res.json({ 
      success: true,
      theme: result.rows[0].theme_name 
    });
  } catch (error) {
    console.error('Error fetching user theme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors du chargement de la préférence',
      message: error.message 
    });
  }
});

// PUT /api/themes/users/:userId - Sauvegarder la préférence de thème
router.put('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { theme } = req.body;

    // Vérifier que l'utilisateur modifie son propre thème ou est admin
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        error: 'Accès non autorisé' 
      });
    }

    if (!theme) {
      return res.status(400).json({ 
        success: false,
        error: 'Le nom du thème est requis' 
      });
    }

    // Upsert (insert ou update)
    const result = await pool.query(
      `INSERT INTO user_theme_preferences (user_id, theme_name)
       VALUES ($1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET theme_name = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, theme]
    );

    res.json({ 
      success: true,
      message: 'Préférence de thème sauvegardée',
      preference: result.rows[0] 
    });
  } catch (error) {
    console.error('Error saving user theme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la sauvegarde de la préférence',
      message: error.message 
    });
  }
});

module.exports = router;
