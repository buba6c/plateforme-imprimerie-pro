# 🔧 Correction : Attribution du Dossier au Créateur du Devis

## ⚠️ Problème identifié

Dans le guide initial, le dossier converti était attribué à l'utilisateur qui **effectue la conversion** au lieu du préparateur qui a **créé le devis**.

## ✅ Solution

Le dossier doit appartenir au **préparateur qui a créé le devis** (`devis.user_id`) et non à celui qui clique sur "Convertir".

---

## 🔧 Correction du Code

### Fichier : `backend/services/conversionService.js`

#### ❌ Code incorrect (ligne 263) :

```javascript
user_id, // Le préparateur qui convertit
```

#### ✅ Code correct :

```javascript
devis.user_id, // Le préparateur qui a CRÉÉ le devis
```

---

## 📝 Code Complet Corrigé

### `backend/services/conversionService.js`

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
      
      // ✅ IMPORTANT : Le dossier est créé pour le préparateur qui a CRÉÉ le devis
      console.log(`📋 Attribution du dossier au préparateur #${devis.user_id} (créateur du devis)`);
      
      // 5. Créer le dossier dans la base de données
      const [dossierResult] = await dbHelper.query(
        `INSERT INTO dossiers (
          folder_id, 
          numero, 
          client, 
          user_id, 
          created_by,
          preparateur_id,
          machine_type,
          type_formulaire,
          data_json, 
          statut,
          source,
          devis_id,
          prix_devis,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING id, folder_id, numero`,
        [
          folderId,
          numeroDossier,
          devis.client_nom,
          devis.user_id,        // ✅ Le préparateur qui a CRÉÉ le devis
          devis.user_id,        // ✅ Même valeur pour created_by
          devis.user_id,        // ✅ Même valeur pour preparateur_id
          devis.machine_type,
          devis.machine_type,   // type_formulaire = machine_type
          JSON.stringify(dataJson),
          'en_cours',           // Statut initial du dossier
          'devis',              // Source de création
          devisId,              // Référence au devis source
          devis.prix_final || devis.prix_estime
        ]
      );
      
      const dossier = dossierResult[0];
      console.log(`✅ Dossier créé: ${dossier.numero} (${dossier.folder_id})`);
      console.log(`✅ Propriétaire: Préparateur #${devis.user_id}`);
      
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
      // ✅ user.id = celui qui a effectué la conversion (peut être différent du créateur)
      await dbHelper.query(
        `INSERT INTO conversion_historique (devis_id, folder_id, user_id, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          devisId, 
          folderId, 
          user.id, // Celui qui a cliqué sur "Convertir"
          `Conversion du devis ${devis.numero} en dossier ${numeroDossier}. ` +
          `Dossier attribué au préparateur #${devis.user_id} (créateur du devis)`
        ]
      );
      
      // 8. Ajouter dans l'historique du devis
      await dbHelper.query(
        `INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut, commentaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          devisId, 
          user.id, 
          'conversion', 
          'converti', 
          `Converti en dossier ${numeroDossier} pour le préparateur #${devis.user_id}`
        ]
      );
      
      // 9. Copier les fichiers si présents
      await this.copyDevisFiles(devisId, folderId);
      
      console.log(`🎉 Conversion réussie ! Devis ${devis.numero} → Dossier ${numeroDossier}`);
      console.log(`👤 Le dossier appartient au préparateur qui a créé le devis (#${devis.user_id})`);
      
      return {
        success: true,
        message: 'Devis converti en dossier avec succès',
        dossier: {
          id: dossier.id,
          folder_id: dossier.folder_id,
          numero: dossier.numero,
          statut: 'en_cours',
          proprietaire_id: devis.user_id // ✅ ID du préparateur propriétaire
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
    
    // ✅ Vérifier les permissions
    // Seul le créateur du devis ou un admin peut convertir
    if (user.role === 'preparateur' && devis.user_id !== user.id) {
      return { 
        canConvert: false, 
        reason: 'Seul le préparateur qui a créé ce devis peut le convertir' 
      };
    }
    
    // L'admin peut convertir n'importe quel devis
    if (user.role === 'admin') {
      return { 
        canConvert: true,
        note: 'Le dossier sera attribué au préparateur qui a créé le devis'
      };
    }
    
    return { canConvert: true };
  }
}

module.exports = new ConversionService();
```

---

## 🔍 Explication des changements

### 1. Attribution du propriétaire

**Avant** (incorrect) :
```javascript
user_id: user.id, // L'utilisateur qui clique sur "Convertir"
```

**Après** (correct) :
```javascript
user_id: devis.user_id,        // Le préparateur qui a CRÉÉ le devis
created_by: devis.user_id,     // Cohérence avec user_id
preparateur_id: devis.user_id, // Cohérence avec user_id
```

### 2. Logs améliorés

```javascript
console.log(`📋 Attribution du dossier au préparateur #${devis.user_id} (créateur du devis)`);
console.log(`👤 Le dossier appartient au préparateur qui a créé le devis (#${devis.user_id})`);
```

### 3. Historique détaillé

```javascript
notes: `Conversion du devis ${devis.numero} en dossier ${numeroDossier}. ` +
       `Dossier attribué au préparateur #${devis.user_id} (créateur du devis)`
```

### 4. Permissions renforcées

```javascript
if (user.role === 'preparateur' && devis.user_id !== user.id) {
  return { 
    canConvert: false, 
    reason: 'Seul le préparateur qui a créé ce devis peut le convertir' 
  };
}
```

---

## 📊 Schéma du flux corrigé

```
┌─────────────────────────────────────────────────┐
│  Préparateur A crée un devis                    │
│  → devis.user_id = ID du Préparateur A         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Le devis est validé                            │
│  → devis.statut = "valide"                     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Quelqu'un clique sur "Convertir"               │
│  (Peut être Préparateur A ou Admin)            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  ✅ Dossier créé                                │
│  → dossiers.user_id = devis.user_id            │
│  → dossiers.created_by = devis.user_id         │
│  → dossiers.preparateur_id = devis.user_id     │
│                                                  │
│  👤 Le dossier appartient au Préparateur A      │
│     (celui qui a créé le devis)                 │
└─────────────────────────────────────────────────┘
```

---

## ✅ Résultat attendu

### Scénario 1 : Le préparateur convertit son propre devis

```
Préparateur A crée devis #123
→ Préparateur A valide le devis
→ Préparateur A clique "Convertir"
→ Dossier créé pour Préparateur A ✅
```

### Scénario 2 : L'admin convertit le devis d'un préparateur

```
Préparateur B crée devis #456
→ Préparateur B valide le devis
→ Admin clique "Convertir"
→ Dossier créé pour Préparateur B (pas pour Admin) ✅
```

### Scénario 3 : Un autre préparateur ne peut pas convertir

```
Préparateur C crée devis #789
→ Préparateur C valide le devis
→ Préparateur D essaie de convertir
→ ❌ ERREUR : "Seul le préparateur qui a créé ce devis peut le convertir"
```

---

## 🧪 Test de vérification

### Script de test mis à jour

Créer : `test-attribution-correcte.js`

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testAttribution() {
  console.log('🧪 Test : Attribution correcte du dossier au créateur du devis\n');
  
  try {
    // 1. Login Préparateur A
    console.log('1️⃣ Connexion Préparateur A...');
    const prepALogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'preparateur@evocom.ci',
      password: 'prep123'
    });
    const tokenA = prepALogin.data.token;
    const prepAId = prepALogin.data.user.id;
    console.log(`✅ Préparateur A connecté (ID: ${prepAId})\n`);
    
    // 2. Préparateur A crée un devis
    console.log('2️⃣ Préparateur A crée un devis...');
    const devisRes = await axios.post(
      `${API_URL}/devis`,
      {
        machine_type: 'roland',
        client_nom: 'Client Test Attribution',
        data_json: {
          type_support: 'Bâche',
          largeur: '200',
          hauteur: '150',
          unite: 'cm'
        }
      },
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    const devisId = devisRes.data.devis.id;
    const devisUserId = devisRes.data.devis.user_id;
    console.log(`✅ Devis créé par Préparateur A`);
    console.log(`   Devis ID: ${devisId}`);
    console.log(`   user_id du devis: ${devisUserId}\n`);
    
    // 3. Valider le devis
    console.log('3️⃣ Validation du devis...');
    await axios.put(
      `${API_URL}/devis/${devisId}`,
      { statut: 'valide', prix_final: 50000 },
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    console.log('✅ Devis validé\n');
    
    // 4. Login Admin
    console.log('4️⃣ Connexion Admin...');
    const adminLogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@evocom.ci',
      password: 'admin123'
    });
    const tokenAdmin = adminLogin.data.token;
    const adminId = adminLogin.data.user.id;
    console.log(`✅ Admin connecté (ID: ${adminId})\n`);
    
    // 5. Admin convertit le devis
    console.log('5️⃣ Admin convertit le devis du Préparateur A...');
    const convertRes = await axios.post(
      `${API_URL}/devis/${devisId}/convert`,
      {},
      { headers: { Authorization: `Bearer ${tokenAdmin}` } }
    );
    
    const dossierCreated = convertRes.data.dossier;
    console.log('✅ Conversion réussie !');
    console.log(`   Dossier créé: ${dossierCreated.numero}\n`);
    
    // 6. Vérifier le propriétaire du dossier
    console.log('6️⃣ Vérification du propriétaire du dossier...');
    const dossierRes = await axios.get(
      `${API_URL}/dossiers/${dossierCreated.folder_id}`,
      { headers: { Authorization: `Bearer ${tokenAdmin}` } }
    );
    
    const dossier = dossierRes.data;
    const dossierId = dossier.user_id || dossier.created_by;
    
    console.log(`📊 Détails du dossier créé :`);
    console.log(`   Numéro: ${dossier.numero}`);
    console.log(`   user_id: ${dossierId}`);
    console.log(`   created_by: ${dossier.created_by}`);
    console.log(`   source: ${dossier.source}`);
    console.log('');
    
    // 7. Vérification finale
    if (dossierId === prepAId) {
      console.log('✅ TEST RÉUSSI !');
      console.log(`   Le dossier appartient bien au Préparateur A (ID: ${prepAId})`);
      console.log(`   Même si c'est l'Admin (ID: ${adminId}) qui a effectué la conversion`);
    } else {
      console.log('❌ TEST ÉCHOUÉ !');
      console.log(`   Le dossier appartient à l'utilisateur ${dossierId}`);
      console.log(`   Il devrait appartenir au Préparateur A (ID: ${prepAId})`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testAttribution();
```

Exécuter le test :

```bash
node test-attribution-correcte.js
```

**Résultat attendu** :
```
✅ TEST RÉUSSI !
   Le dossier appartient bien au Préparateur A (ID: X)
   Même si c'est l'Admin (ID: Y) qui a effectué la conversion
```

---

## 📝 Résumé des corrections

| Aspect | Avant | Après |
|--------|-------|-------|
| **Propriétaire du dossier** | Celui qui convertit | Celui qui a créé le devis ✅ |
| **user_id** | `user.id` | `devis.user_id` ✅ |
| **created_by** | Non défini | `devis.user_id` ✅ |
| **preparateur_id** | Non défini | `devis.user_id` ✅ |
| **Permissions** | Tout le monde | Créateur ou Admin ✅ |
| **Logs** | Basiques | Détaillés avec IDs ✅ |

---

## 🎯 Actions à faire

1. **Utiliser le code corrigé** pour créer `backend/services/conversionService.js`
2. **Tester** avec le script `test-attribution-correcte.js`
3. **Vérifier** dans la base de données que `dossiers.user_id = devis.user_id`

---

✅ **La correction est prête ! Le dossier sera maintenant toujours attribué au préparateur qui a créé le devis, peu importe qui effectue la conversion.**
