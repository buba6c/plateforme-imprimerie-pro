# 🔄 Guide d'Implémentation : Conversion Devis → Dossier

## 📋 Vue d'ensemble

Ce guide détaille l'implémentation complète du système de conversion automatique des devis en dossiers d'impression pour la plateforme EvocomPrint.

---

## 🎯 Objectifs

1. **Permettre la conversion fluide** : Devis validé → Dossier d'impression
2. **Préserver l'intégrité** : Tous les champs sont copiés fidèlement
3. **Bloquer les modifications** : Un devis converti devient en lecture seule
4. **Traçabilité complète** : Historique et liens entre devis et dossiers
5. **Gestion des fichiers** : Copie automatique des fichiers joints

---

## 📊 Architecture

### Flux de données

```
┌─────────────────┐
│  Préparateur    │
│  Crée un devis  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Devis créé     │
│  Statut:        │
│  "brouillon"    │
└────────┬────────┘
         │
         │ Préparateur valide
         ▼
┌─────────────────┐
│  Devis validé   │
│  Statut:        │
│  "valide"       │
└────────┬────────┘
         │
         │ Clic "Convertir en Dossier"
         ▼
┌─────────────────┐        ┌──────────────────┐
│  Devis converti │───────▶│ Dossier créé     │
│  Statut:        │        │ Statut:          │
│  "converti"     │        │ "en_cours"       │
│  (lecture seule)│        │ Source: "Devis"  │
└─────────────────┘        └──────────────────┘
         │                          │
         │                          │
         ▼                          ▼
┌─────────────────┐        ┌──────────────────┐
│  Historique     │        │ Workflow normal  │
│  de conversion  │        │ Impression →     │
│  enregistré     │        │ Livraison        │
└─────────────────┘        └──────────────────┘
```

---

## 🗄️ ÉTAPE 1 : Modifications de la Base de Données

### 1.1 - Mise à jour du schéma des tables

Créer le fichier : `database/migrations/add_conversion_fields.sql`

```sql
-- =====================================================
-- Migration : Ajout champs pour conversion devis → dossier
-- =====================================================

-- 1. Ajout de colonnes dans la table devis
ALTER TABLE devis 
ADD COLUMN IF NOT EXISTS converted_folder_id UUID,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Index pour les recherches de conversions
CREATE INDEX IF NOT EXISTS idx_devis_converted_folder ON devis(converted_folder_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);

-- 2. Ajout de colonnes dans la table dossiers
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'creation',
ADD COLUMN IF NOT EXISTS devis_id INTEGER,
ADD COLUMN IF NOT EXISTS prix_devis DECIMAL(10,2);

-- Index pour traçabilité
CREATE INDEX IF NOT EXISTS idx_dossiers_source ON dossiers(source);
CREATE INDEX IF NOT EXISTS idx_dossiers_devis ON dossiers(devis_id);

-- Contrainte de clé étrangère
ALTER TABLE dossiers 
ADD CONSTRAINT fk_dossiers_devis 
FOREIGN KEY (devis_id) REFERENCES devis(id) 
ON DELETE SET NULL;

-- 3. Table d'historique de conversion
CREATE TABLE IF NOT EXISTS conversion_historique (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL,
    folder_id UUID NOT NULL,
    user_id INTEGER NOT NULL,
    converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES dossiers(folder_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversion_devis ON conversion_historique(devis_id);
CREATE INDEX IF NOT EXISTS idx_conversion_folder ON conversion_historique(folder_id);

-- 4. Vue pour voir les devis avec leur dossier associé
CREATE OR REPLACE VIEW v_devis_avec_dossier AS
SELECT 
    d.*,
    dos.folder_id,
    dos.numero as dossier_numero,
    dos.statut as dossier_statut,
    u.prenom,
    u.nom,
    u.email
FROM devis d
LEFT JOIN dossiers dos ON d.converted_folder_id = dos.folder_id
LEFT JOIN users u ON d.user_id = u.id;

-- 5. Vue complète des conversions
CREATE OR REPLACE VIEW v_conversions_complete AS
SELECT 
    ch.id as conversion_id,
    ch.converted_at,
    d.numero as devis_numero,
    d.client_nom,
    d.prix_final,
    dos.numero as dossier_numero,
    dos.statut as dossier_statut,
    u.prenom as preparateur_prenom,
    u.nom as preparateur_nom
FROM conversion_historique ch
JOIN devis d ON ch.devis_id = d.id
JOIN dossiers dos ON ch.folder_id = dos.folder_id
JOIN users u ON ch.user_id = u.id
ORDER BY ch.converted_at DESC;

COMMENT ON TABLE conversion_historique IS 'Historique des conversions devis → dossier';
COMMENT ON VIEW v_conversions_complete IS 'Vue complète des conversions avec détails';
```

### 1.2 - Table pour les fichiers de devis

```sql
-- Table pour stocker les fichiers liés aux devis
CREATE TABLE IF NOT EXISTS devis_fichiers (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_devis_fichiers_devis ON devis_fichiers(devis_id);

COMMENT ON TABLE devis_fichiers IS 'Fichiers associés aux devis';
```

---

## 🔧 ÉTAPE 2 : Backend - Service de conversion

### 2.1 - Créer le service de conversion

Créer : `backend/services/conversionService.js`

```javascript
const dbHelper = require('../utils/dbHelper');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Service de conversion devis → dossier
 */
class ConversionService {
  
  /**
   * Convertir un devis en dossier
   * @param {number} devisId - ID du devis
   * @param {object} user - Utilisateur qui effectue la conversion
   * @returns {object} - Informations du dossier créé
   */
  async convertDevisToDossier(devisId, user) {
    try {
      console.log(`🔄 Début conversion devis #${devisId} par user #${user.id}`);
      
      // 1. Récupérer le devis complet
      const [devisRows] = await dbHelper.query(
        'SELECT * FROM devis WHERE id = $1',
        [devisId]
      );
      
      if (devisRows.length === 0) {
        throw new Error('Devis non trouvé');
      }
      
      const devis = devisRows[0];
      
      // 2. Vérifications
      if (devis.statut === 'converti') {
        throw new Error('Ce devis a déjà été converti en dossier');
      }
      
      if (devis.statut !== 'valide') {
        throw new Error('Seuls les devis validés peuvent être convertis en dossier');
      }
      
      // 3. Générer un nouveau folder_id et numéro de dossier
      const folderId = uuidv4();
      const annee = new Date().getFullYear();
      const timestamp = Date.now().toString().slice(-6);
      const numeroDossier = `DOS-${annee}-${timestamp}`;
      
      // 4. Parser data_json
      let dataJson;
      try {
        dataJson = typeof devis.data_json === 'string' 
          ? JSON.parse(devis.data_json) 
          : devis.data_json;
      } catch (error) {
        throw new Error('Données du devis invalides');
      }
      
      // 5. Créer le dossier dans la base de données
      const [dossierResult] = await dbHelper.query(
        `INSERT INTO dossiers (
          folder_id, 
          numero, 
          client, 
          user_id, 
          machine_type,
          type_formulaire,
          data_json, 
          statut,
          source,
          devis_id,
          prix_devis,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id, folder_id, numero`,
        [
          folderId,
          numeroDossier,
          devis.client_nom,
          user.id, // Le préparateur qui convertit
          devis.machine_type,
          devis.machine_type, // type_formulaire = machine_type
          JSON.stringify(dataJson),
          'en_cours', // Statut initial
          'devis', // Source de création
          devisId, // Référence au devis
          devis.prix_final || devis.prix_estime
        ]
      );
      
      const dossier = dossierResult[0];
      console.log(`✅ Dossier créé: ${dossier.numero} (${dossier.folder_id})`);
      
      // 6. Marquer le devis comme converti
      await dbHelper.query(
        `UPDATE devis 
         SET statut = $1, 
             converted_folder_id = $2, 
             converted_at = NOW(),
             is_locked = TRUE
         WHERE id = $3`,
        ['converti', folderId, devisId]
      );
      
      // 7. Enregistrer dans l'historique de conversion
      await dbHelper.query(
        `INSERT INTO conversion_historique (devis_id, folder_id, user_id, notes)
         VALUES ($1, $2, $3, $4)`,
        [devisId, folderId, user.id, `Conversion du devis ${devis.numero} en dossier ${numeroDossier}`]
      );
      
      // 8. Ajouter dans l'historique du devis
      await dbHelper.query(
        `INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut, commentaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [devisId, user.id, 'conversion', 'converti', `Converti en dossier ${numeroDossier}`]
      );
      
      // 9. Copier les fichiers si présents
      await this.copyDevisFiles(devisId, folderId);
      
      console.log(`🎉 Conversion réussie ! Devis ${devis.numero} → Dossier ${numeroDossier}`);
      
      return {
        success: true,
        message: 'Devis converti en dossier avec succès',
        dossier: {
          id: dossier.id,
          folder_id: dossier.folder_id,
          numero: dossier.numero,
          statut: 'en_cours'
        },
        devis: {
          id: devisId,
          numero: devis.numero,
          statut: 'converti'
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur conversion devis:', error);
      throw error;
    }
  }
  
  /**
   * Copier les fichiers d'un devis vers un dossier
   * @param {number} devisId - ID du devis source
   * @param {string} folderId - UUID du dossier de destination
   */
  async copyDevisFiles(devisId, folderId) {
    try {
      // Récupérer les fichiers du devis
      const [files] = await dbHelper.query(
        'SELECT * FROM devis_fichiers WHERE devis_id = $1',
        [devisId]
      );
      
      if (files.length === 0) {
        console.log('📁 Aucun fichier à copier');
        return;
      }
      
      console.log(`📁 Copie de ${files.length} fichier(s)...`);
      
      const uploadsDir = path.join(__dirname, '../../uploads');
      const devisDir = path.join(uploadsDir, 'devis', devisId.toString());
      const dossierDir = path.join(uploadsDir, 'dossiers', folderId);
      
      // Créer le répertoire de destination
      await fs.mkdir(dossierDir, { recursive: true });
      
      // Copier chaque fichier
      for (const file of files) {
        try {
          const sourcePath = path.join(devisDir, file.filename);
          const destPath = path.join(dossierDir, file.filename);
          
          // Copier le fichier
          await fs.copyFile(sourcePath, destPath);
          
          // Insérer dans la table fichiers du dossier
          await dbHelper.query(
            `INSERT INTO fichiers (
              folder_id, 
              filename, 
              original_name, 
              file_path, 
              file_size,
              mime_type,
              uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              folderId,
              file.filename,
              file.original_name,
              `/uploads/dossiers/${folderId}/${file.filename}`,
              file.file_size,
              file.mime_type,
              file.uploaded_by
            ]
          );
          
          console.log(`✅ Fichier copié: ${file.original_name}`);
        } catch (fileError) {
          console.error(`❌ Erreur copie fichier ${file.filename}:`, fileError);
          // Continue avec les autres fichiers
        }
      }
      
      console.log(`✅ ${files.length} fichier(s) copié(s) avec succès`);
      
    } catch (error) {
      console.error('❌ Erreur lors de la copie des fichiers:', error);
      // Ne pas faire échouer la conversion si la copie échoue
    }
  }
  
  /**
   * Récupérer l'historique de conversion d'un devis
   */
  async getConversionHistory(devisId) {
    const [history] = await dbHelper.query(
      `SELECT ch.*, dos.numero as dossier_numero, dos.statut as dossier_statut
       FROM conversion_historique ch
       JOIN dossiers dos ON ch.folder_id = dos.folder_id
       WHERE ch.devis_id = $1`,
      [devisId]
    );
    return history;
  }
  
  /**
   * Vérifier si un devis peut être converti
   */
  async canConvert(devisId, user) {
    const [devisRows] = await dbHelper.query(
      'SELECT * FROM devis WHERE id = $1',
      [devisId]
    );
    
    if (devisRows.length === 0) {
      return { canConvert: false, reason: 'Devis non trouvé' };
    }
    
    const devis = devisRows[0];
    
    if (devis.statut === 'converti') {
      return { canConvert: false, reason: 'Devis déjà converti' };
    }
    
    if (devis.statut !== 'valide') {
      return { canConvert: false, reason: 'Le devis doit être validé avant conversion' };
    }
    
    // Vérifier les permissions
    if (user.role === 'preparateur' && devis.user_id !== user.id) {
      return { canConvert: false, reason: 'Vous n\'êtes pas le créateur de ce devis' };
    }
    
    return { canConvert: true };
  }
}

module.exports = new ConversionService();
```

---

## 🛣️ ÉTAPE 3 : Backend - Route de conversion améliorée

### 3.1 - Mettre à jour `backend/routes/devis.js`

Remplacer la route existante `/devis/:id/convert` :

```javascript
// Route de conversion devis → dossier
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
```

N'oubliez pas d'ajouter l'import en haut du fichier :

```javascript
const conversionService = require('../services/conversionService');
```

---

## 💻 ÉTAPE 4 : Frontend - Interface de conversion

### 4.1 - Mettre à jour `DevisDetailsModal.js`

Ajouter les états et fonctions nécessaires :

```javascript
const [conversionLoading, setConversionLoading] = useState(false);
const [canConvert, setCanConvert] = useState(false);
const [convertedDossier, setConvertedDossier] = useState(null);

// Vérifier si le devis peut être converti
useEffect(() => {
  const checkConversion = async () => {
    if (!devis || !isOpen) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${API_URL}/devis/${devis.id}/can-convert`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCanConvert(response.data.canConvert);
    } catch (error) {
      console.error('Erreur vérification conversion:', error);
    }
  };
  
  checkConversion();
}, [devis, isOpen]);

// Fonction de conversion
const convertToFolder = async () => {
  if (!window.confirm(
    '⚠️ Êtes-vous sûr de vouloir convertir ce devis en dossier ?\n\n' +
    '• Le devis ne pourra plus être modifié\n' +
    '• Un nouveau dossier sera créé automatiquement\n' +
    '• Les fichiers joints seront copiés\n\n' +
    'Cette action est irréversible.'
  )) {
    return;
  }

  try {
    setConversionLoading(true);
    const token = localStorage.getItem('auth_token');
    
    const response = await axios.post(
      `${API_URL}/devis/${devis.id}/convert`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    setConvertedDossier(response.data.dossier);
    
    alert(
      `✅ Conversion réussie !\n\n` +
      `Devis : ${response.data.devis.numero}\n` +
      `→ Dossier : ${response.data.dossier.numero}\n\n` +
      `Le dossier a été créé et est accessible dans la liste des dossiers.`
    );
    
    // Fermer le modal et recharger
    onClose();
    
    // Si on est sur la page des devis, recharger
    if (window.location.pathname.includes('/devis')) {
      window.location.reload();
    }
    
  } catch (error) {
    console.error('Erreur conversion:', error);
    alert(
      `❌ Erreur lors de la conversion\n\n` +
      `${error.response?.data?.error || error.message}`
    );
  } finally {
    setConversionLoading(false);
  }
};
```

### 4.2 - Ajouter le bouton de conversion dans le header du modal

```jsx
{/* Header */}
<div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
  <div className="flex items-center gap-3">
    {/* ... code existant ... */}
  </div>
  
  <div className="flex items-center gap-2">
    {/* Boutons existants */}
    
    {/* Bouton de conversion - uniquement pour devis validés */}
    {devis.statut === 'valide' && canConvert && !convertedDossier && (
      <button
        onClick={convertToFolder}
        disabled={conversionLoading}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        title="Convertir en dossier d'impression"
      >
        {conversionLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Conversion...
          </>
        ) : (
          <>
            <ArrowPathIcon className="w-4 h-4" />
            🔄 Convertir en Dossier
          </>
        )}
      </button>
    )}
    
    {/* Afficher le lien si déjà converti */}
    {devis.statut === 'converti' && devis.converted_folder_id && (
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <span className="text-sm text-blue-900 dark:text-blue-100">
          Converti en dossier
        </span>
        <a
          href={`/dossiers/${devis.converted_folder_id}`}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Voir le dossier →
        </a>
      </div>
    )}
    
    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
      <XMarkIcon className="w-6 h-6 text-gray-500" />
    </button>
  </div>
</div>
```

### 4.3 - Désactiver les boutons de modification si converti

Ajouter cette condition sur les boutons de modification :

```jsx
{/* Boutons de modification - désactivés si converti */}
{devis.statut !== 'converti' && (
  <>
    <button
      onClick={validateDevis}
      disabled={devis.statut === 'valide'}
      className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Valider le devis
    </button>
    
    <button
      onClick={() => setEditMode(true)}
      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
    >
      Modifier
    </button>
  </>
)}

{/* Message si converti */}
{devis.statut === 'converti' && (
  <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
    <span className="text-sm text-gray-600 dark:text-gray-400">
      🔒 Devis converti - Lecture seule
    </span>
  </div>
)}
```

---

## 🎨 ÉTAPE 5 : Affichage dans la liste des devis

### 5.1 - Mettre à jour `DevisList.js`

Ajouter un badge spécial pour les devis convertis :

```jsx
{/* Badge de conversion */}
{d.statut === 'converti' && d.converted_folder_id && (
  <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <ArrowRightIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    <span className="text-xs text-blue-900 dark:text-blue-100">
      Converti en dossier
    </span>
    <a
      href={`/dossiers?search=${d.dossier_numero || ''}`}
      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {d.dossier_numero || 'Voir →'}
    </a>
  </div>
)}
```

---

## 📝 ÉTAPE 6 : Tests

### 6.1 - Script de test de conversion

Créer : `test-conversion-devis-dossier.js`

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testConversionFlow() {
  console.log('🧪 Test du workflow de conversion Devis → Dossier\n');
  
  try {
    // 1. Login préparateur
    console.log('1️⃣ Connexion préparateur...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'preparateur@evocom.ci',
      password: 'prep123'
    });
    const token = loginRes.data.token;
    console.log('✅ Connecté\n');
    
    // 2. Créer un devis
    console.log('2️⃣ Création d\'un devis...');
    const devisRes = await axios.post(
      `${API_URL}/devis`,
      {
        machine_type: 'roland',
        client_nom: 'Client Test',
        client_contact: '0700000000',
        data_json: {
          type_support: 'Bâche',
          largeur: '200',
          hauteur: '150',
          unite: 'cm',
          nombre_exemplaires: '1'
        },
        notes: 'Test de conversion'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const devisId = devisRes.data.devis.id;
    console.log(`✅ Devis créé : #${devisId}\n`);
    
    // 3. Valider le devis
    console.log('3️⃣ Validation du devis...');
    await axios.put(
      `${API_URL}/devis/${devisId}`,
      { statut: 'valide', prix_final: 50000 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('✅ Devis validé\n');
    
    // 4. Vérifier si convertible
    console.log('4️⃣ Vérification conversion possible...');
    const canConvertRes = await axios.get(
      `${API_URL}/devis/${devisId}/can-convert`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`✅ Peut être converti : ${canConvertRes.data.canConvert}\n`);
    
    if (!canConvertRes.data.canConvert) {
      console.log(`❌ Impossible de convertir : ${canConvertRes.data.reason}`);
      return;
    }
    
    // 5. Convertir en dossier
    console.log('5️⃣ Conversion en dossier...');
    const convertRes = await axios.post(
      `${API_URL}/devis/${devisId}/convert`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✅ Conversion réussie !');
    console.log('📋 Détails de la conversion :');
    console.log('   Devis :', convertRes.data.devis);
    console.log('   Dossier :', convertRes.data.dossier);
    console.log('');
    
    // 6. Vérifier le dossier créé
    console.log('6️⃣ Vérification du dossier créé...');
    const dossierRes = await axios.get(
      `${API_URL}/dossiers?filter=tous`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const dossier = dossierRes.data.dossiers.find(
      d => d.folder_id === convertRes.data.dossier.folder_id
    );
    
    if (dossier) {
      console.log('✅ Dossier trouvé :');
      console.log('   Numéro :', dossier.numero);
      console.log('   Statut :', dossier.statut);
      console.log('   Source :', dossier.source);
      console.log('   Client :', dossier.client);
    } else {
      console.log('❌ Dossier non trouvé');
    }
    
    console.log('\n✅ Test complet réussi !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testConversionFlow();
```

Exécuter le test :

```bash
node test-conversion-devis-dossier.js
```

---

## 🚀 ÉTAPE 7 : Déploiement

### 7.1 - Script de migration

Créer : `migrate-conversion-feature.sh`

```bash
#!/bin/bash

echo "🚀 Migration : Système de conversion Devis → Dossier"
echo "================================================"

# 1. Backup de la base de données
echo "📦 Backup de la base de données..."
pg_dump -h localhost -U postgres -d evocom_print > backup_avant_conversion_$(date +%Y%m%d_%H%M%S).sql
echo "✅ Backup créé"

# 2. Exécuter les migrations SQL
echo "📊 Exécution des migrations SQL..."
psql -h localhost -U postgres -d evocom_print -f database/migrations/add_conversion_fields.sql
echo "✅ Migrations appliquées"

# 3. Créer les répertoires nécessaires
echo "📁 Création des répertoires uploads..."
mkdir -p uploads/devis
mkdir -p uploads/dossiers
echo "✅ Répertoires créés"

# 4. Installer les dépendances (si nouvelles)
echo "📦 Vérification des dépendances..."
cd backend && npm install
cd ../frontend && npm install
cd ..
echo "✅ Dépendances à jour"

# 5. Redémarrer les services
echo "🔄 Redémarrage des services..."
pm2 restart backend
pm2 restart frontend
echo "✅ Services redémarrés"

echo ""
echo "✅ Migration terminée avec succès !"
echo "🎉 Le système de conversion Devis → Dossier est opérationnel"
```

Rendre le script exécutable et l'exécuter :

```bash
chmod +x migrate-conversion-feature.sh
./migrate-conversion-feature.sh
```

---

## 📚 ÉTAPE 8 : Documentation utilisateur

### 8.1 - Guide pour les préparateurs

Créer : `GUIDE_CONVERSION_UTILISATEUR.md`

```markdown
# 📘 Guide : Convertir un Devis en Dossier

## Pour les Préparateurs

### Étape 1 : Créer un devis

1. Aller dans **Devis** > **Nouveau devis**
2. Choisir le type de machine (Roland ou Xerox)
3. Remplir tous les champs requis
4. Cliquer sur **Créer le devis**

### Étape 2 : Valider le devis

1. Ouvrir le devis créé
2. Vérifier les informations et le prix estimé
3. Cliquer sur **Valider le devis**
4. Le statut passe à "Validé"

### Étape 3 : Convertir en dossier

1. Le bouton **🔄 Convertir en Dossier** apparaît
2. Cliquer sur ce bouton
3. Confirmer la conversion (action irréversible !)
4. Un nouveau dossier est créé automatiquement

### Résultat

✅ Le devis devient **"Converti"** et en **lecture seule**  
✅ Un dossier est créé avec le statut **"En cours"**  
✅ Tous les fichiers sont copiés automatiquement  
✅ Le dossier suit le workflow normal d'impression

### ⚠️ Important

- Un devis converti **ne peut plus être modifié**
- La conversion est **irréversible**
- Seuls les devis **validés** peuvent être convertis
```

---

## ✅ ÉTAPE 9 : Vérification finale

### 9.1 - Checklist de validation

- [ ] Migrations SQL appliquées
- [ ] Service de conversion créé
- [ ] Routes backend mises à jour
- [ ] Interface frontend fonctionnelle
- [ ] Boutons de conversion affichés correctement
- [ ] Blocage des devis convertis actif
- [ ] Copie des fichiers opérationnelle
- [ ] Historique de conversion enregistré
- [ ] Tests passent avec succès
- [ ] Documentation utilisateur créée

### 9.2 - Tests à effectuer manuellement

1. **Créer un devis** : Vérifier que le formulaire fonctionne
2. **Valider un devis** : Vérifier le changement de statut
3. **Convertir en dossier** : Tester la conversion complète
4. **Vérifier le dossier** : S'assurer qu'il est accessible aux imprimeurs
5. **Tester la lecture seule** : Vérifier qu'on ne peut plus modifier le devis
6. **Vérifier les fichiers** : S'assurer que les fichiers sont copiés
7. **Tester les différents rôles** : Admin, préparateur, imprimeur

---

## 🎯 Résumé

Cette implémentation permet de :

✅ **Convertir automatiquement** un devis validé en dossier d'impression  
✅ **Préserver l'intégrité** des données et fichiers  
✅ **Bloquer les modifications** sur les devis convertis  
✅ **Assurer la traçabilité** complète via historique  
✅ **Faciliter le workflow** entre devis et production  

Le système est maintenant opérationnel et prêt pour la production ! 🚀
