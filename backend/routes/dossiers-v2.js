const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Multer config: upload in /uploads/<dossier_id>/
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dossierId = req.params.id;
    const uploadPath = path.join(__dirname, '../../uploads', dossierId);
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  },
});
const upload = multer({ storage });

// Helper: emit Socket.IO event
function emitEvent(req, event, data) {
  const io = req.app.get('io');
  if (io) io.emit(event, data);
}

// POST /dossiers - Créer un dossier
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { client, machine } = req.body;
    if (!client || !['Roland', 'Xerox'].includes(machine)) {
      return res.status(400).json({ error: 'Client et machine requis.' });
    }
    const userId = req.user.id;
    const result = await db.query(
      'INSERT INTO dossiers (client, machine, created_by) VALUES ($1, $2, $3) RETURNING *',
      [client, machine, userId]
    );
    emitEvent(req, 'dossier_created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dossiers - Liste des dossiers (filtrée par rôle)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM dossiers';
    let params = [];
    if (req.user.role === 'preparateur') {
      query += ' WHERE created_by = $1';
      params = [req.user.id];
    } else if (req.user.role === 'imprimeur_roland') {
      query += " WHERE machine = 'Roland'";
    } else if (req.user.role === 'imprimeur_xerox') {
      query += " WHERE machine = 'Xerox'";
    } else if (req.user.role === 'livreur') {
      query += " WHERE statut = 'Terminé'";
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dossiers/:id - Voir un dossier précis
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM dossiers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ce dossier n\'existe pas.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /dossiers/:id - Changer statut ou ajouter commentaire
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { statut, commentaire } = req.body;
    const updates = [];
    const params = [];
    if (statut) {
      updates.push('statut = $1');
      params.push(statut);
    }
    if (commentaire) {
      updates.push('commentaire = $2');
      params.push(commentaire);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Aucune modification.' });
    params.push(req.params.id);
    const result = await db.query(
      `UPDATE dossiers SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    emitEvent(req, 'dossier_updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /dossiers/:id - Supprimer un dossier et ses fichiers
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM dossiers WHERE id = $1', [req.params.id]);
    emitEvent(req, 'dossier_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /dossiers/:id/fichiers - Uploader fichiers liés au dossier
router.post('/:id/fichiers', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const dossierId = req.params.id;
    const files = req.files || [];
    const inserted = [];
    for (const file of files) {
      const result = await db.query(
        'INSERT INTO fichiers (dossier_id, nom, chemin, type, taille) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [dossierId, file.originalname, file.path, file.mimetype, file.size]
      );
      inserted.push(result.rows[0]);
    }
    emitEvent(req, 'files_uploaded', { dossier_id: dossierId, files: inserted });
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dossiers/:id/fichiers - Voir les fichiers d’un dossier
router.get('/:id/fichiers', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM fichiers WHERE dossier_id = $1', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /fichiers/:id - Supprimer un fichier
router.delete('/fichiers/:id', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM fichiers WHERE id = $1', [req.params.id]);
    emitEvent(req, 'file_deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
