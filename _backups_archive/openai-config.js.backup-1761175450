const express = require('express');
const router = express.Router();
const dbHelper = require("../utils/dbHelper");
const { authenticateToken: auth } = require('../middleware/auth');
const openaiService = require('../services/openaiService');
const multer = require('multer');
const path = require('path');

const upload = multer({
  dest: path.join(__dirname, '../uploads/config/openai'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }
  }
});

router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const config = await openaiService.getOpenAIConfig();
    
    if (!config) {
      return res.json({
        is_active: false,
        has_api_key: false,
        knowledge_base_text: null,
        knowledge_base_pdf_name: null
      });
    }
    
    res.json({
      is_active: config.is_active,
      has_api_key: !!config.api_key_encrypted,
      knowledge_base_text: config.knowledge_base_text,
      knowledge_base_pdf_name: config.knowledge_base_pdf_name,
      knowledge_base_pdf_size: config.knowledge_base_pdf_size,
      total_requests: config.total_requests,
      last_request_at: config.last_request_at,
      last_test_at: config.last_test_at,
      last_test_status: config.last_test_status
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    console.log('📝 Body reçu:', req.body);
    const { api_key, knowledge_base_text, is_active } = req.body;
    const updates = [];
    const params = [];
    
    let paramIndex = 1;
    
    if (api_key) {
      console.log('🔐 Chiffrement de la clé API...');
      const { encrypted, iv } = openaiService.encryptApiKey(api_key);
      updates.push(`api_key_encrypted = $${paramIndex++}`, `api_key_iv = $${paramIndex++}`);
      params.push(encrypted, iv);
    }
    
    if (knowledge_base_text !== undefined) {
      console.log('📚 Mise à jour knowledge base...');
      updates.push(`knowledge_base_text = $${paramIndex++}`);
      params.push(knowledge_base_text);
    }
    
    if (is_active !== undefined) {
      console.log('⚙️ Mise à jour is_active:', is_active);
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }
    
    console.log('🔍 Updates:', updates);
    console.log('🔍 Params:', params);
    
    if (updates.length > 0) {
      const query = `UPDATE openai_config SET ${updates.join(', ')}, updated_at = NOW() WHERE id = 1`;
      console.log('🔍 Query:', query);
      await dbHelper.query(query, params);
      console.log('✅ Mise à jour réussie');
    }
    
    res.json({ message: 'Configuration mise à jour' });
  } catch (error) {
    console.error('❌ Erreur PUT OpenAI:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.post('/test', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const { api_key } = req.body;
    
    if (!api_key) {
      return res.status(400).json({ error: 'Clé API requise' });
    }
    
    const result = await openaiService.testConnection(api_key);
    
    await dbHelper.query(
      'UPDATE openai_config SET last_test_at = NOW(), last_test_status = $1 WHERE id = 1',
      [result.success ? 'success' : 'failed']
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/upload-pdf', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }
    
    await dbHelper.query(
      'UPDATE openai_config SET knowledge_base_pdf_path = $1, knowledge_base_pdf_name = $2, knowledge_base_pdf_size = $3 WHERE id = 1',
      [req.file.path, req.file.originalname, req.file.size]
    );
    
    res.json({
      message: 'Fichier PDF uploadé',
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
