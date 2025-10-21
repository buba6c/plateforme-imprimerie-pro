# 📋 Guide d'Implémentation - Devis & Facturation + OpenAI

## 🎯 Vue d'ensemble

Cette fonctionnalité ajoute un système complet de devis et facturation avec estimation intelligente via OpenAI.

---

## ✅ Étapes Complétées

### 1. ✅ Migration Base de Données
**Fichier**: `backend/database/migrations/002_devis_facturation.sql`

**Tables créées**:
- `devis` - Stockage des devis créés par les préparateurs
- `factures` - Factures générées automatiquement
- `tarifs_config` - Configuration des tarifs modifiable par admin
- `openai_config` - Configuration de l'API OpenAI
- `devis_historique` - Audit trail des modifications

**Exécution**:
```bash
# Se connecter à MySQL
mysql -u root -p plateforme_impression

# Exécuter la migration
source backend/database/migrations/002_devis_facturation.sql
```

### 2. ✅ Service OpenAI
**Fichier**: `backend/services/openaiService.js`

**Fonctions principales**:
- `encryptApiKey()` / `decryptApiKey()` - Chiffrement sécurisé
- `testConnection()` - Test de la clé API
- `estimateQuote()` - Estimation intelligente des devis
- `optimizePricing()` - Optimisation tarifaire IA

---

## 📦 Étapes Suivantes

### 3. Service de Génération PDF

Créer: `backend/services/pdfService.js`

```javascript
/**
 * Service de génération de PDF pour devis et factures
 * Design professionnel inspiré de vosfactures.fr
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Génère un PDF de devis
 */
async function generateQuotePDF(devisData) {
  return new Promise((resolve, reject) => {
    try {
      const pdfPath = path.join(__dirname, '../uploads/devis', `${devisData.numero}.pdf`);
      
      // Créer le dossier si inexistant
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      
      doc.pipe(stream);
      
      // En-tête
      doc.fontSize(24).fillColor('#2563eb').text('DEVIS', { align: 'center' });
      doc.moveDown();
      
      // Informations entreprise
      doc.fontSize(10).fillColor('#000000');
      doc.text('EvocomPrint', 50, 80);
      doc.text('Plateforme d\'Impression Numérique');
      doc.moveDown();
      
      // Numéro et date
      doc.fontSize(12).fillColor('#2563eb');
      doc.text(`N° ${devisData.numero}`, 400, 80);
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Date: ${new Date(devisData.created_at).toLocaleDateString('fr-FR')}`, 400, 100);
      doc.moveDown(2);
      
      // Informations client
      doc.fontSize(12).fillColor('#2563eb').text('CLIENT');
      doc.fontSize(10).fillColor('#000000');
      doc.text(devisData.client_nom || 'Client');
      if (devisData.client_contact) {
        doc.text(devisData.client_contact);
      }
      doc.moveDown(2);
      
      // Ligne de séparation
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      // Détails du devis
      doc.fontSize(12).fillColor('#2563eb').text('DÉTAILS');
      doc.moveDown(0.5);
      
      const data = JSON.parse(devisData.data_json);
      const details = JSON.parse(devisData.details_prix || '{}');
      
      // Tableau des postes
      let y = doc.y;
      doc.fontSize(9).fillColor('#666666');
      doc.text('Description', 50, y);
      doc.text('Quantité', 300, y);
      doc.text('Prix unitaire', 380, y);
      doc.text('Total', 480, y, { align: 'right' });
      
      y += 20;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      
      // Ligne de base
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Impression ${devisData.machine_type.toUpperCase()}`, 50, y);
      doc.text('-', 300, y);
      doc.text('-', 380, y);
      doc.text(`${details.base || 0} FCFA`, 480, y, { align: 'right' });
      
      y += 20;
      
      // Finitions
      if (details.finitions && details.finitions > 0) {
        doc.text('Finitions', 50, y);
        doc.text('-', 300, y);
        doc.text('-', 380, y);
        doc.text(`${details.finitions} FCFA`, 480, y, { align: 'right' });
        y += 20;
      }
      
      // Options
      if (details.options && details.options > 0) {
        doc.text('Options', 50, y);
        doc.text('-', 300, y);
        doc.text('-', 380, y);
        doc.text(`${details.options} FCFA`, 480, y, { align: 'right' });
        y += 20;
      }
      
      // Ligne de séparation
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      
      // Total
      doc.fontSize(14).fillColor('#2563eb');
      doc.text('TOTAL', 50, y);
      doc.text(`${devisData.prix_final || devisData.prix_estime} FCFA`, 480, y, { align: 'right' });
      
      // Pied de page
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        'Document généré automatiquement par la plateforme EvocomPrint',
        50,
        750,
        { align: 'center', width: 500 }
      );
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(pdfPath);
      });
      
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Génère un PDF de facture
 */
async function generateInvoicePDF(factureData) {
  return new Promise((resolve, reject) => {
    try {
      const pdfPath = path.join(__dirname, '../uploads/factures', `${factureData.numero}.pdf`);
      
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      
      doc.pipe(stream);
      
      // En-tête
      doc.fontSize(28).fillColor('#dc2626').text('FACTURE', { align: 'center' });
      doc.moveDown();
      
      // Informations entreprise
      doc.fontSize(10).fillColor('#000000');
      doc.text('EvocomPrint', 50, 100);
      doc.text('Plateforme d\'Impression Numérique');
      doc.moveDown();
      
      // Numéro et date
      doc.fontSize(12).fillColor('#dc2626');
      doc.text(`N° ${factureData.numero}`, 400, 100);
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Date: ${new Date(factureData.created_at).toLocaleDateString('fr-FR')}`, 400, 120);
      doc.text(`Dossier: ${factureData.dossier_numero || 'N/A'}`, 400, 135);
      doc.moveDown(2);
      
      // Client
      doc.fontSize(12).fillColor('#dc2626').text('FACTURER À');
      doc.fontSize(10).fillColor('#000000');
      doc.text(factureData.client_nom);
      if (factureData.client_contact) doc.text(factureData.client_contact);
      if (factureData.client_adresse) doc.text(factureData.client_adresse);
      doc.moveDown(2);
      
      // Ligne
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      // Détails
      let y = doc.y;
      doc.fontSize(9).fillColor('#666666');
      doc.text('Description', 50, y);
      doc.text('Montant HT', 400, y);
      
      y += 25;
      doc.fontSize(10).fillColor('#000000');
      doc.text('Prestation d\'impression', 50, y);
      doc.text(`${factureData.montant_ht || 0} FCFA`, 400, y);
      
      y += 25;
      doc.text('TVA', 50, y);
      doc.text(`${factureData.montant_tva || 0} FCFA`, 400, y);
      
      y += 35;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 15;
      
      // Total
      doc.fontSize(16).fillColor('#dc2626');
      doc.text('TOTAL TTC', 50, y);
      doc.text(`${factureData.montant_ttc} FCFA`, 400, y);
      
      y += 50;
      
      // Mode de paiement
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Mode de paiement: ${getModeLabel(factureData.mode_paiement)}`, 50, y);
      doc.text(`Statut: ${getStatutLabel(factureData.statut_paiement)}`, 50, y + 15);
      
      // Pied de page
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        'Document généré automatiquement par la plateforme EvocomPrint',
        50,
        750,
        { align: 'center', width: 500 }
      );
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(pdfPath);
      });
      
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

function getModeLabel(mode) {
  const modes = {
    wave: '💙 Wave',
    orange_money: '🧡 Orange Money',
    virement: '🏦 Virement bancaire',
    cheque: '🧾 Chèque',
    especes: '💵 Espèces'
  };
  return modes[mode] || mode;
}

function getStatutLabel(statut) {
  const statuts = {
    non_paye: 'Non payé',
    paye: '✅ Payé',
    partiellement_paye: 'Partiellement payé',
    annule: 'Annulé'
  };
  return statuts[statut] || statut;
}

module.exports = {
  generateQuotePDF,
  generateInvoicePDF
};
```

### 4. Routes API - Devis

Créer: `backend/routes/devis.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const openaiService = require('../services/openaiService');
const pdfService = require('../services/pdfService');

/**
 * GET /api/devis
 * Liste des devis (filtrée par rôle)
 */
router.get('/', auth, async (req, res) => {
  try {
    const { statut, machine_type, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM v_devis_complet WHERE 1=1';
    const params = [];
    
    // Filtre par utilisateur si préparateur
    if (req.user.role === 'preparateur') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }
    
    // Filtres additionnels
    if (statut) {
      query += ' AND statut = ?';
      params.push(statut);
    }
    
    if (machine_type) {
      query += ' AND machine_type = ?';
      params.push(machine_type);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [devis] = await db.query(query, params);
    
    // Compter le total
    let countQuery = 'SELECT COUNT(*) as total FROM devis WHERE 1=1';
    const countParams = [];
    
    if (req.user.role === 'preparateur') {
      countQuery += ' AND user_id = ?';
      countParams.push(req.user.id);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    
    res.json({
      devis,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Erreur récupération devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/devis
 * Créer un nouveau devis
 */
router.post('/', auth, async (req, res) => {
  try {
    const { machine_type, data_json, client_nom, client_contact, notes } = req.body;
    
    // Validation
    if (!machine_type || !data_json) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    if (!['roland', 'xerox'].includes(machine_type)) {
      return res.status(400).json({ error: 'Type de machine invalide' });
    }
    
    // Récupérer les tarifs applicables
    const [tarifs] = await db.query(
      'SELECT * FROM tarifs_config WHERE (type_machine = ? OR type_machine = ?) AND actif = TRUE',
      [machine_type, 'global']
    );
    
    // Estimation avec IA
    const config = await openaiService.getOpenAIConfig();
    const estimation = await openaiService.estimateQuote(
      typeof data_json === 'string' ? JSON.parse(data_json) : data_json,
      machine_type,
      tarifs,
      config?.knowledge_base_text
    );
    
    // Insérer le devis
    const [result] = await db.query(
      `INSERT INTO devis (
        user_id, machine_type, data_json, client_nom, client_contact,
        prix_estime, prix_final, details_prix, notes, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        machine_type,
        typeof data_json === 'string' ? data_json : JSON.stringify(data_json),
        client_nom,
        client_contact,
        estimation.prix_estime,
        estimation.prix_estime, // Prix final = prix estimé par défaut
        JSON.stringify(estimation.details),
        notes,
        'brouillon'
      ]
    );
    
    // Récupérer le devis créé avec son numéro généré
    const [devisCreated] = await db.query(
      'SELECT * FROM devis WHERE id = ?',
      [result.insertId]
    );
    
    // Historique
    await db.query(
      'INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut) VALUES (?, ?, ?, ?)',
      [result.insertId, req.user.id, 'creation', 'brouillon']
    );
    
    res.status(201).json({
      message: 'Devis créé avec succès',
      devis: devisCreated[0],
      estimation
    });
  } catch (error) {
    console.error('Erreur création devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/devis/:id
 * Détail d'un devis
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const [devis] = await db.query(
      'SELECT * FROM v_devis_complet WHERE id = ?',
      [req.params.id]
    );
    
    if (devis.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    
    // Vérification des permissions
    if (req.user.role === 'preparateur' && devis[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    res.json(devis[0]);
  } catch (error) {
    console.error('Erreur récupération devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/devis/:id
 * Mettre à jour un devis
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { prix_final, statut, notes, commentaire_refus } = req.body;
    
    // Vérifier que le devis existe et appartient à l'utilisateur
    const [existing] = await db.query(
      'SELECT * FROM devis WHERE id = ?',
      [req.params.id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    
    if (req.user.role === 'preparateur' && existing[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    // Ne pas permettre la modification si converti
    if (existing[0].statut === 'converti') {
      return res.status(400).json({ error: 'Devis converti non modifiable' });
    }
    
    // Mise à jour
    const updates = [];
    const params = [];
    
    if (prix_final !== undefined) {
      updates.push('prix_final = ?');
      params.push(prix_final);
    }
    
    if (statut && ['brouillon', 'en_attente', 'valide', 'refuse'].includes(statut)) {
      updates.push('statut = ?');
      params.push(statut);
      
      if (statut === 'valide') {
        updates.push('validated_at = NOW()');
      }
    }
    
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    
    if (commentaire_refus !== undefined && statut === 'refuse') {
      updates.push('commentaire_refus = ?');
      params.push(commentaire_refus);
    }
    
    params.push(req.params.id);
    
    await db.query(
      `UPDATE devis SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    
    // Historique
    await db.query(
      'INSERT INTO devis_historique (devis_id, user_id, action, ancien_statut, nouveau_statut) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, 'modification', existing[0].statut, statut || existing[0].statut]
    );
    
    res.json({ message: 'Devis mis à jour' });
  } catch (error) {
    console.error('Erreur mise à jour devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/devis/:id/convert
 * Convertir un devis en dossier
 */
router.post('/:id/convert', auth, async (req, res) => {
  try {
    const [devis] = await db.query(
      'SELECT * FROM devis WHERE id = ?',
      [req.params.id]
    );
    
    if (devis.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    
    if (req.user.role === 'preparateur' && devis[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    if (devis[0].statut === 'converti') {
      return res.status(400).json({ error: 'Devis déjà converti' });
    }
    
    // Créer le dossier
    const { v4: uuidv4 } = require('uuid');
    const folderId = uuidv4();
    const dataJson = JSON.parse(devis[0].data_json);
    
    const [dossierResult] = await db.query(
      `INSERT INTO dossiers (
        folder_id, numero, user_id, machine_type, data_json,
        statut, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        folderId,
        `DOS-${Date.now()}`,
        req.user.id,
        devis[0].machine_type,
        JSON.stringify(dataJson),
        'en_cours'
      ]
    );
    
    // Marquer le devis comme converti
    await db.query(
      'UPDATE devis SET statut = ?, converted_folder_id = ?, converted_at = NOW() WHERE id = ?',
      ['converti', folderId, req.params.id]
    );
    
    // Historique
    await db.query(
      'INSERT INTO devis_historique (devis_id, user_id, action, ancien_statut, nouveau_statut, details_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, 'conversion', devis[0].statut, 'converti', JSON.stringify({ folder_id: folderId })]
    );
    
    res.json({
      message: 'Devis converti en dossier avec succès',
      folder_id: folderId
    });
  } catch (error) {
    console.error('Erreur conversion devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/devis/:id/pdf
 * Télécharger le PDF du devis
 */
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const [devis] = await db.query(
      'SELECT * FROM v_devis_complet WHERE id = ?',
      [req.params.id]
    );
    
    if (devis.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    
    if (req.user.role === 'preparateur' && devis[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    // Générer le PDF
    const pdfPath = await pdfService.generateQuotePDF(devis[0]);
    
    res.download(pdfPath, `${devis[0].numero}.pdf`);
  } catch (error) {
    console.error('Erreur génération PDF devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/devis/:id
 * Supprimer un devis (sauf si converti)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const [devis] = await db.query(
      'SELECT * FROM devis WHERE id = ?',
      [req.params.id]
    );
    
    if (devis.length === 0) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }
    
    if (req.user.role === 'preparateur' && devis[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    if (devis[0].statut === 'converti') {
      return res.status(400).json({ error: 'Impossible de supprimer un devis converti' });
    }
    
    await db.query('DELETE FROM devis WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Devis supprimé' });
  } catch (error) {
    console.error('Erreur suppression devis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
```

### 5. Routes API - Factures

Créer: `backend/routes/factures.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const pdfService = require('../services/pdfService');

/**
 * GET /api/factures
 * Liste des factures
 */
router.get('/', auth, async (req, res) => {
  try {
    const { statut_paiement, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM v_factures_complet WHERE 1=1';
    const params = [];
    
    // Filtre par utilisateur si préparateur
    if (req.user.role === 'preparateur') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }
    
    if (statut_paiement) {
      query += ' AND statut_paiement = ?';
      params.push(statut_paiement);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [factures] = await db.query(query, params);
    
    res.json({ factures });
  } catch (error) {
    console.error('Erreur récupération factures:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/factures/generate
 * Générer une facture depuis un dossier
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const { dossier_id, mode_paiement, client_nom, client_contact, client_adresse, montant_ttc } = req.body;
    
    // Vérifier que le dossier existe
    const [dossier] = await db.query(
      'SELECT * FROM dossiers WHERE folder_id = ?',
      [dossier_id]
    );
    
    if (dossier.length === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }
    
    // Vérifier qu'une facture n'existe pas déjà
    const [existingFacture] = await db.query(
      'SELECT * FROM factures WHERE dossier_id = ?',
      [dossier_id]
    );
    
    if (existingFacture.length > 0) {
      return res.status(400).json({ error: 'Une facture existe déjà pour ce dossier' });
    }
    
    // Calculer HT et TVA (exemple: 18% TVA)
    const montantTTC = parseFloat(montant_ttc);
    const montantHT = montantTTC / 1.18;
    const montantTVA = montantTTC - montantHT;
    
    // Insérer la facture
    const [result] = await db.query(
      `INSERT INTO factures (
        dossier_id, user_id, montant_ht, montant_tva, montant_ttc,
        client_nom, client_contact, client_adresse, mode_paiement,
        statut_paiement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dossier_id,
        dossier[0].user_id,
        montantHT.toFixed(2),
        montantTVA.toFixed(2),
        montantTTC.toFixed(2),
        client_nom || 'Client',
        client_contact,
        client_adresse,
        mode_paiement || 'especes',
        'non_paye'
      ]
    );
    
    // Récupérer la facture créée
    const [factureCreated] = await db.query(
      'SELECT * FROM v_factures_complet WHERE id = ?',
      [result.insertId]
    );
    
    // Générer le PDF
    try {
      const pdfPath = await pdfService.generateInvoicePDF(factureCreated[0]);
      
      await db.query(
        'UPDATE factures SET pdf_path = ?, pdf_generated_at = NOW() WHERE id = ?',
        [pdfPath, result.insertId]
      );
    } catch (pdfError) {
      console.error('Erreur génération PDF:', pdfError);
    }
    
    res.status(201).json({
      message: 'Facture générée avec succès',
      facture: factureCreated[0]
    });
  } catch (error) {
    console.error('Erreur génération facture:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/factures/:id/pdf
 * Télécharger le PDF de la facture
 */
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const [facture] = await db.query(
      'SELECT * FROM v_factures_complet WHERE id = ?',
      [req.params.id]
    );
    
    if (facture.length === 0) {
      return res.status(404).json({ error: 'Facture non trouvée' });
    }
    
    if (req.user.role === 'preparateur' && facture[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    if (!facture[0].pdf_path) {
      // Générer le PDF si manquant
      const pdfPath = await pdfService.generateInvoicePDF(facture[0]);
      
      await db.query(
        'UPDATE factures SET pdf_path = ?, pdf_generated_at = NOW() WHERE id = ?',
        [pdfPath, req.params.id]
      );
      
      return res.download(pdfPath, `${facture[0].numero}.pdf`);
    }
    
    res.download(facture[0].pdf_path, `${facture[0].numero}.pdf`);
  } catch (error) {
    console.error('Erreur téléchargement PDF:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
```

---

## 📝 Installation des dépendances

```bash
# Backend
cd backend
npm install openai pdfkit

# Frontend
cd ../frontend
npm install react-icons lucide-react
```

---

## 🔧 Configuration

### 1. Variables d'environnement

Ajouter dans `backend/.env`:
```
ENCRYPTION_KEY=votre_cle_32_caracteres_exactement
```

### 2. Montage des routes dans server.js

Ajouter dans `backend/server.js`:
```javascript
// Après les autres routes
const devisRoutes = require('./routes/devis');
const facturesRoutes = require('./routes/factures');
const tarifsRoutes = require('./routes/tarifs');

app.use('/api/devis', devisRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/tarifs', tarifsRoutes);
```

---

## 🎨 Frontend - Structure des composants

### Dossiers à créer:
```
frontend/src/
├── components/
│   ├── devis/
│   │   ├── DevisCreation.js
│   │   ├── DevisList.js
│   │   ├── DevisDetail.js
│   │   └── DevisEstimation.js
│   ├── factures/
│   │   ├── FacturesList.js
│   │   ├── FactureDetail.js
│   │   └── FactureGeneration.js
│   └── admin/
│       ├── TarifManager.js
│       └── OpenAISettings.js
```

---

## ✅ Checklist de déploiement

- [ ] Exécuter la migration SQL
- [ ] Installer les dépendances npm (openai, pdfkit)
- [ ] Configurer ENCRYPTION_KEY dans .env
- [ ] Créer les dossiers uploads/devis et uploads/factures
- [ ] Monter les routes dans server.js
- [ ] Créer les composants frontend
- [ ] Mettre à jour LayoutImproved.js (menu)
- [ ] Mettre à jour App.js (routes)
- [ ] Tester la création de devis
- [ ] Tester la génération de facture
- [ ] Configurer OpenAI (clé API)

---

## 🚀 Prochaines étapes

1. Créer les composants React (voir section suivante)
2. Intégrer dans le menu latéral
3. Ajouter les routes dans App.js
4. Tester end-to-end
5. Documentation utilisateur

---

Ce guide sera complété avec les composants React dans la prochaine étape.
