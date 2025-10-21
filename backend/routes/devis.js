const express = require('express');
const router = express.Router();
const dbHelper = require('../utils/dbHelper');
const { authenticateToken: auth } = require('../middleware/auth');
const openaiService = require('../services/openaiService');
const pdfService = require('../services/pdfService');
const conversionService = require('../services/conversionService');
const realtimeEstimationService = require('../services/realtimeEstimationService');
const intelligentAgentService = require('../services/intelligentAgentService');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const aiAgentService = intelligentAgentService;

// ==========================================
// ESTIMATION EN TEMPS RÉEL (sans auth pour performance)
// ==========================================
router.post('/estimate-realtime', async (req, res) => {
  try {
    const { formData, machineType } = req.body;
    
    if (!formData || !machineType) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        required: ['formData', 'machineType']
      });
    }
    
    if (!['roland', 'xerox'].includes(machineType)) {
      return res.status(400).json({ 
        error: 'Type de machine invalide',
        allowed: ['roland', 'xerox']
      });
    }
    
    // Calcul ultra-rapide
    const estimation = await realtimeEstimationService.estimateRealtime(formData, machineType);
    
    res.json(estimation);
    
  } catch (error) {
    console.error('❌ Erreur estimation temps réel:', error);
    res.status(500).json({ 
      error: 'Erreur de calcul',
      prix_estime: 0,
      message: 'Impossible de calculer l\'estimation'
    });
  }
});

// Route pour obtenir les stats du cache (admin uniquement)
router.get('/estimate-stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    const stats = realtimeEstimationService.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour vider le cache (admin uniquement)
router.post('/clear-cache', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    
    realtimeEstimationService.clearEstimationsCache();
    realtimeEstimationService.clearTarifsCache();
    
    res.json({ message: 'Cache vidé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==========================================
// ANALYSE IA POUR CRÉATION PAR DESCRIPTION
// ==========================================
router.post('/analyze-description', auth, async (req, res) => {
  try {
    const { description, client_name, contact } = req.body;
    
    if (!description || !description.trim()) {
      return res.status(400).json({ 
        message: 'La description est requise' 
      });
    }
    
    if (!client_name || !client_name.trim()) {
      return res.status(400).json({ 
        message: 'Le nom du client est requis' 
      });
    }

    // Charger les tarifs disponibles pour le contexte
    const tarifXerox = await db.query('SELECT id, CONCAT(format, \' \', couleur) as description, prix_par_page as prix_unitaire FROM tarifs_xerox LIMIT 10');
    const tarifRoland = await db.query('SELECT id, CONCAT(taille, \' \', couleur) as description, prix_unitaire FROM tarifs_roland LIMIT 10');
    const finitions = await db.query('SELECT id, nom, prix_unitaire FROM finitions LIMIT 10');

    const tarifContext = `
Tarifs Xerox disponibles:
${tarifXerox.rows.map((t, i) => `${i+1}. ${t.description}: ${t.prix_unitaire} XOF`).join('\n')}

Tarifs Roland disponibles:
${tarifRoland.rows.map((t, i) => `${i+1}. ${t.description}: ${t.prix_unitaire} XOF`).join('\n')}

Finitions disponibles:
${finitions.rows.map((f, i) => `${i+1}. ${f.nom}: ${f.prix_unitaire} XOF`).join('\n')}
`;
    
    // Utiliser le service d'IA intelligent pour l'analyse complète
    const aiAnalysis = await aiAgentService.reflectiveAnalysis(
      description,
      {}
    );

    // Transformer la réponse IA en structure devis
    let analysisResult = {
      product_type: 'Produit personnalisé',
      machine_recommended: 'xerox',
      details: description,
      items: [],
      total_ht: 0,
      notes: `Confiance: ${aiAnalysis.confidence_score || 0}%`,
      ai_confidence: aiAnalysis.confidence_score || 0,
      ai_analysis: aiAnalysis
    };

    // Extraire les informations de la première recommandation
    if (aiAnalysis.proposals && aiAnalysis.proposals.length > 0) {
      const primaryProposal = aiAnalysis.proposals[0];
      
      analysisResult.product_type = primaryProposal.machine === 'roland' ? 'Grand format (Roland)' : 'Document standard (Xerox)';
      analysisResult.machine_recommended = primaryProposal.machine || 'xerox';
      
      // Créer un article à partir de la recommandation
      analysisResult.items.push({
        description: `${analysisResult.product_type} - ${description}`,
        quantity: 1,
        unit_price: primaryProposal.estimated_price || primaryProposal.price || 5000,
        notes: primaryProposal.reasoning || 'Estimation basée sur l\'IA intelligente'
      });
      
      analysisResult.total_ht = analysisResult.items[0].unit_price;
    } else {
      // Fallback: créer un article par défaut
      analysisResult.items.push({
        description: `Service d'impression - ${description}`,
        quantity: 1,
        unit_price: 5000,
        notes: 'À estimer avec le formulaire détaillé'
      });
      analysisResult.total_ht = 5000;
    }

    // Loguer l'analyse
    await db.query(
      'INSERT INTO ai_analysis_log (user_id, user_input, ai_output, confidence_score) VALUES ($1, $2, $3, $4)',
      [req.user.id, description, JSON.stringify(analysisResult), analysisResult.ai_confidence]
    ).catch(err => console.warn('⚠️  Logging error (non-critical):', err.message));
    
    res.json(analysisResult);
    
  } catch (error) {
    console.error('❌ Erreur analyse IA:', error);
    res.status(500).json({ 
      message: error.message || 'Erreur lors de l\'analyse IA',
      error: error.message 
    });
  }
});

// ==========================================
// ROUTES PRINCIPALES
// ==========================================
router.get('/', auth, async (req, res) => {
  try {
    const { statut, machine_type, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM v_devis_complet WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (req.user.role === 'preparateur') {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(req.user.id);
    }
    if (statut) {
      query += ` AND statut = $${paramIndex++}`;
      params.push(statut);
    }
    if (machine_type) {
      query += ` AND machine_type = $${paramIndex++}`;
      params.push(machine_type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const [devis] = await dbHelper.query(query, params);
    res.json({ devis });
  } catch (error) {
    console.error('Erreur récupération devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    console.log('🆕 Création nouveau devis:', { machine_type: req.body.machine_type, client_nom: req.body.client_nom });
    const { machine_type, data_json, client_nom, client_contact, notes } = req.body;
    
    if (!machine_type || !data_json) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    // Récupérer les tarifs avec PostgreSQL
    const [tarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE (type_machine = $1 OR type_machine = $2) AND actif = TRUE',
      [machine_type, 'global']
    );
    console.log(`📊 ${tarifs.length} tarifs trouvés pour ${machine_type}`);
    
    // Faire l'estimation avec OpenAI
    console.log('🤖 Démarrage estimation OpenAI...');
    const config = await openaiService.getOpenAIConfig();
    const parsedData = typeof data_json === 'string' ? JSON.parse(data_json) : data_json;
    
    const estimation = await openaiService.estimateQuote(
      parsedData,
      machine_type,
      tarifs,
      config?.knowledge_base_text
    );
    
    console.log(`💰 Estimation terminée: ${estimation.prix_estime} FCFA (IA: ${estimation.ia_used ? 'OUI' : 'NON'})`);
    
    // Générer un numéro de devis
    const numero = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    
    // Insérer le devis avec PostgreSQL
    const [result] = await dbHelper.query(
      `INSERT INTO devis (numero, user_id, machine_type, data_json, client_nom, client_contact, prix_estime, prix_final, details_prix, notes, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [numero, req.user.id, machine_type, JSON.stringify(parsedData),
       client_nom, client_contact, estimation.prix_estime, estimation.prix_estime, 
       JSON.stringify({...estimation.details, ia_used: estimation.ia_used, model: estimation.model}), 
       notes, 'brouillon']
    );
    
    const insertId = result[0].id;
    console.log(`✅ Devis créé avec ID: ${insertId}, numéro: ${numero}`);
    
    // Récupérer le devis créé
    const [devisCreated] = await dbHelper.query('SELECT * FROM devis WHERE id = $1', [insertId]);
    
    // Ajouter à l'historique
    await dbHelper.query(
      'INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut) VALUES ($1, $2, $3, $4)',
      [insertId, req.user.id, 'creation', 'brouillon']
    );
    
    res.status(201).json({ 
      message: 'Devis créé avec succès', 
      devis: devisCreated[0], 
      estimation: {
        prix_estime: estimation.prix_estime,
        ia_used: estimation.ia_used,
        model: estimation.model,
        explanation: estimation.explanation
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur création devis:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
  const [devis] = await dbHelper.query('SELECT * FROM v_devis_complet WHERE id = $1', [req.params.id]);
    if (devis.length === 0) return res.status(404).json({ error: 'Devis non trouvé' });
    if (req.user.role === 'preparateur' && devis[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    res.json(devis[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { prix_final, statut, notes } = req.body;
    const [existing] = await dbHelper.query('SELECT * FROM devis WHERE id = $1', [req.params.id]);
    
    if (existing.length === 0) return res.status(404).json({ error: 'Devis non trouvé' });
    if (req.user.role === 'preparateur' && existing[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    if (existing[0].statut === 'converti') {
      return res.status(400).json({ error: 'Devis converti non modifiable' });
    }
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (prix_final !== undefined) { updates.push(`prix_final = $${paramIndex++}`); params.push(prix_final); }
    if (statut) { updates.push(`statut = $${paramIndex++}`); params.push(statut); }
    if (notes !== undefined) { updates.push(`notes = $${paramIndex++}`); params.push(notes); }
    params.push(req.params.id);
    
    await dbHelper.query(`UPDATE devis SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`, params);
    res.json({ message: 'Devis mis à jour' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de conversion devis → dossier (utilise le service)
router.post('/:id/convert', auth, async (req, res) => {
  try {
    const devisId = parseInt(req.params.id);
    
    if (isNaN(devisId)) {
      return res.status(400).json({ error: 'ID de devis invalide' });
    }
    
    console.log(`🔄 Demande de conversion devis #${devisId} par ${req.user.email}`);
    
    // Vérifier les permissions
    const canConvert = await conversionService.canConvert(devisId, req.user);
    if (!canConvert.canConvert) {
      return res.status(403).json({ 
        error: canConvert.reason 
      });
    }
    
    // Effectuer la conversion
    const result = await conversionService.convertDevisToDossier(devisId, req.user);
    
    // Notifier via socket si disponible
    if (global.io) {
      global.io.emit('devis_converted', {
        devisId: devisId,
        folderId: result.dossier.folder_id,
        numeroDossier: result.dossier.numero,
        userId: req.user.id
      });
    }
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Erreur conversion devis:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la conversion du devis',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Route pour vérifier si un devis peut être converti
router.get('/:id/can-convert', auth, async (req, res) => {
  try {
    const devisId = parseInt(req.params.id);
    const result = await conversionService.canConvert(devisId, req.user);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour récupérer l'historique de conversion
router.get('/:id/conversion-history', auth, async (req, res) => {
  try {
    const devisId = parseInt(req.params.id);
    const history = await conversionService.getConversionHistory(devisId);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de conversion devis → dossier (alias simplifié)
router.post('/:id/convert-to-dossier', auth, async (req, res) => {
  try {
    const devisId = parseInt(req.params.id);
    
    if (isNaN(devisId)) {
      return res.status(400).json({ error: 'ID de devis invalide' });
    }
    
    console.log(`🔄 Conversion devis→dossier #${devisId}`);
    
    // Vérifier les permissions
    const canConvert = await conversionService.canConvert(devisId, req.user);
    if (!canConvert.canConvert) {
      return res.status(403).json({ error: canConvert.reason });
    }
    
    // Effectuer la conversion
    const result = await conversionService.convertDevisToDossier(devisId, req.user);
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Erreur conversion devis→dossier:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la conversion' });
  }
});

// Route de conversion devis → facture
router.post('/:id/convert-to-facture', auth, async (req, res) => {
  try {
    const devisId = parseInt(req.params.id);
    
    if (isNaN(devisId)) {
      return res.status(400).json({ error: 'ID de devis invalide' });
    }
    
    console.log(`🔄 Conversion devis→facture #${devisId}`);
    
    // Récupérer le devis
    const [devis] = await dbHelper.query('SELECT * FROM devis WHERE id = $1', [devisId]);
    
    if (devis.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    
    // Vérifier permissions
    if (req.user.role === 'preparateur' && devis[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    if (devis[0].statut === 'converti') {
      return res.status(400).json({ error: 'Ce devis a déjà été converti' });
    }
    
    // Créer la facture
    const prixFinal = devis[0].prix_final || devis[0].prix_estime || 0;
    const montantTTC = parseFloat(prixFinal);
    const montantHT = montantTTC / 1.18;
    const montantTVA = montantTTC - montantHT;
    
    const [result] = await dbHelper.query(
      `INSERT INTO factures 
       (devis_id, user_id, montant_ht, montant_tva, montant_ttc, client_nom, client_contact, mode_paiement, statut_paiement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        devisId,
        devis[0].user_id || req.user.id,
        montantHT.toFixed(2),
        montantTVA.toFixed(2),
        montantTTC.toFixed(2),
        devis[0].client_nom || 'Client',
        devis[0].client_contact || null,
        'especes',
        'non_paye'
      ]
    );
    
    const insertId = dbHelper.getInsertId(result);
    
    // Marquer le devis comme converti
    await dbHelper.query(
      `UPDATE devis SET statut = 'converti', updated_at = NOW() WHERE id = $1`,
      [devisId]
    );
    
    // Récupérer la facture créée
    const [facture] = await dbHelper.query('SELECT * FROM v_factures_complet WHERE id = $1', [insertId]);
    
    res.status(201).json({ 
      message: 'Facture générée avec succès',
      facture: facture[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur conversion devis→facture:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la génération' });
  }
});

router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const [devis] = await dbHelper.query('SELECT * FROM v_devis_complet WHERE id = $1', [req.params.id]);
    if (devis.length === 0) return res.status(404).json({ error: 'Devis non trouvé' });
    
    const pdfPath = await pdfService.generateQuotePDF(devis[0]);
    res.download(pdfPath, `${devis[0].numero}.pdf`);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const [devis] = await dbHelper.query('SELECT * FROM devis WHERE id = $1', [req.params.id]);
    if (devis.length === 0) return res.status(404).json({ error: 'Devis non trouvé' });
    if (devis[0].statut === 'converti') return res.status(400).json({ error: 'Impossible de supprimer' });
    
    await dbHelper.query('DELETE FROM devis WHERE id = $1', [req.params.id]);
    res.json({ message: 'Devis supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==========================================
// CRÉATION DEVIS (Standard + IA)
// ==========================================
router.post('/create', auth, async (req, res) => {
  try {
    const {
      client_nom,
      client_contact,
      client_email,
      machine_type,
      product_type,
      details,
      items,
      total_ht,
      source,
      status
    } = req.body;

    // Validation
    if (!client_nom || !client_nom.trim()) {
      return res.status(400).json({ message: 'Nom du client requis' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Au moins un article requis' });
    }

    if (total_ht === undefined || total_ht < 0) {
      return res.status(400).json({ message: 'Montant invalide' });
    }

    // Générer numéro de devis
    const [lastDevis] = await dbHelper.query(
      `SELECT numero_devis FROM devis ORDER BY id DESC LIMIT 1`
    );
    
    const lastNum = lastDevis.length > 0 ? parseInt(lastDevis[0].numero_devis?.split('-')[1] || 0) : 0;
    const newNum = String(lastNum + 1).padStart(5, '0');
    const numeroDevis = `DEV-${newNum}`;

    // Créer le devis
    const [result] = await dbHelper.query(
      `INSERT INTO devis (
        numero_devis,
        user_id,
        client_nom,
        client_contact,
        client_email,
        machine_type,
        product_type,
        details,
        items_json,
        prix_estime,
        statut,
        source,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING id`,
      [
        numeroDevis,
        req.user.id,
        client_nom.trim(),
        client_contact?.trim() || null,
        client_email?.trim() || null,
        machine_type?.toUpperCase() || null,
        product_type || null,
        details || null,
        JSON.stringify(items),
        total_ht || 0,
        status || 'brouillon',
        source || 'manual'
      ]
    );

    const devisId = dbHelper.getInsertId(result);

    // Récupérer le devis créé
    const [newDevis] = await dbHelper.query(
      `SELECT * FROM v_devis_complet WHERE id = $1`,
      [devisId]
    );

    res.status(201).json({
      message: 'Devis créé avec succès',
      devis: newDevis[0] || {
        id: devisId,
        numero_devis: numeroDevis,
        client_nom,
        client_contact,
        prix_estime: total_ht,
        status: status || 'brouillon'
      }
    });

  } catch (error) {
    console.error('❌ Erreur création devis:', error);
    res.status(500).json({
      message: error.message || 'Erreur lors de la création du devis',
      error: error.message
    });
  }
});

module.exports = router;
