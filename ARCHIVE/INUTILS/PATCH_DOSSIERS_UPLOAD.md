# 🔧 PATCH: Correction des problèmes "Dossier non trouvé" et Upload de fichiers

## 📋 Résumé des problèmes

### Problème 1: "Dossier non trouvé" (404)
- **Symptôme**: `GET /api/dossiers/:id` renvoie 404 même si le dossier existe
- **Cause racine**: Type d'ID incohérent (INTEGER vs UUID) + filtrage de rôle trop strict

### Problème 2: Upload de fichiers échoue
- **Symptôme**: `POST /api/files/upload/:dossierId` renvoie 500 ou 404
- **Causes**: 
  - Erreur PostgreSQL 22P02 (UUID invalide)
  - Fonction `checkUploadPermissions()` non définie
  - Chemins de fichiers incohérents (absolu vs relatif)

## 🎯 Solutions à appliquer

### CORRECTIF 1: Valider et normaliser l'ID dossier

**Fichier**: `backend/routes/dossiers.js`

**Emplacement**: Au début du handler `GET /:id` (ligne 462)

```javascript
// 📄 GET /dossiers/:id - Détail d'un dossier
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ AJOUT: Validation de l'ID
    if (!id || String(id).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'ID dossier requis',
        code: 'INVALID_DOSSIER_ID'
      });
    }

    // Normaliser l'ID (supporter INTEGER et UUID)
    const dossierId = String(id).trim();

    // D'abord récupérer le dossier sans filtre de rôle
    let query = `
      SELECT d.*, d.numero as numero_commande, d."validé_preparateur" as valide_preparateur, 
             u.nom as preparateur_name, u.email as preparateur_email
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      WHERE d.id = $1
    `;

    const result = await db.query(query, [dossierId]);
    // ... reste du code
```

### CORRECTIF 2: Ajouter la fonction `checkUploadPermissions` manquante

**Fichier**: `backend/routes/files.js`

**Emplacement**: Avant le handler `POST /upload/:dossierId` (ligne ~152)

```javascript
// ✅ AJOUT: Fonction de vérification des permissions d'upload
const checkUploadPermissions = (userRole, dossier) => {
  // Admin peut toujours uploader
  if (userRole === 'admin') return true;
  
  // Préparateur peut uploader sur ses dossiers non validés
  if (userRole === 'preparateur') {
    // Vérifier que le dossier n'est pas validé
    return !dossier.valide_preparateur;
  }
  
  // Autres rôles ne peuvent pas uploader
  return false;
};
```

### CORRECTIF 3: Normaliser les chemins de fichiers

**Fichier**: `backend/routes/files.js`

**Emplacement**: Dans le handler `POST /upload/:dossierId`, ligne ~237

```javascript
// Enregistrer chaque fichier en base
for (const file of req.files) {
  try {
    // ✅ CORRECTION: Utiliser un chemin RELATIF uniforme
    const relativePath = `uploads/${dossierId}/${file.filename}`;
    
    const fileData = {
      dossier_id: dossierId,
      original_filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      filename: file.filename,
      filepath: relativePath,  // ✅ CHANGÉ: était file.path (absolu)
      mimetype: file.mimetype,
      size: file.size,
      uploaded_by: userId,
    };

    const insertResult = await query(
      `INSERT INTO fichiers 
       (dossier_id, nom, chemin, type, taille, uploaded_by, mime_type, extension, checksum) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        fileData.dossier_id,
        fileData.original_filename,
        fileData.filepath,  // ✅ Chemin relatif
        fileData.mimetype.startsWith('image/') ? 'image' : 'document',
        fileData.size,
        fileData.uploaded_by,
        fileData.mimetype,
        path.extname(fileData.original_filename).toLowerCase(),
        'temp-checksum',
      ]
    );

    savedFiles.push(insertResult.rows[0]);
```

### CORRECTIF 4: Support hybride INTEGER/UUID pour dossiers

**Fichier**: `backend/routes/files.js`

**Emplacement**: Dans le handler `POST /upload/:dossierId`, ligne ~185

```javascript
// Vérifier que le dossier existe
// ✅ AMÉLIORATION: Support INTEGER et UUID
let dossierQuery = `SELECT 
     id,
     numero_commande,
     client,
     type_formulaire,
     statut,
     created_by,
     preparateur_id,
     "validé_preparateur" as valide_preparateur,
     created_at,
     updated_at
   FROM dossiers WHERE `;

// Détection du type d'ID (simple heuristique)
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dossierId);

if (isUUID) {
  dossierQuery += 'id = $1::uuid';
} else {
  // Supposer INTEGER, convertir en entier
  const intId = parseInt(dossierId, 10);
  if (isNaN(intId)) {
    return res.status(400).json({
      error: 'ID du dossier invalide (ni INTEGER ni UUID)',
      code: 'INVALID_DOSSIER_ID',
    });
  }
  dossierQuery += 'id = $1';
}

const dossierResult = await query(dossierQuery, [dossierId]);
```

### CORRECTIF 5: Autoriser upload après validation (optionnel)

**Fichier**: `backend/routes/dossiers.js`

**Emplacement**: Handler `POST /:id/fichiers`, ligne ~1268

```javascript
// ✅ OPTION: Permettre à l'admin d'uploader même si validé
const canUpload =
  req.user.role === 'admin' ||  // Admin peut toujours
  (req.user.role === 'preparateur' &&
    (dossier.created_by === parseInt(req.user.id) ||
      dossier.preparateur_id === parseInt(req.user.id)) &&
    !dossier.valide_preparateur);  // Préparateur seulement si pas validé
```

**Alternative plus souple**: Permettre l'upload sur dossier validé mais en statut "À revoir"

```javascript
const canUpload =
  req.user.role === 'admin' ||
  (req.user.role === 'preparateur' &&
    (dossier.created_by === parseInt(req.user.id) ||
      dossier.preparateur_id === parseInt(req.user.id)) &&
    (!dossier.valide_preparateur || dossier.statut === 'À revoir'));
```

## 🧪 Tests recommandés après application

```bash
# 1. Test GET dossier avec ID integer
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:5001/api/dossiers/1

# 2. Test upload fichier
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -F "files=@test.pdf" \
  http://localhost:5001/api/files/upload/1

# 3. Vérifier les logs backend
tail -f backend/logs/error.log

# 4. Vérifier la base de données
psql -U imprimerie_user -d imprimerie_db -c "SELECT id, numero, statut, \"validé_preparateur\" FROM dossiers LIMIT 5;"
psql -U imprimerie_user -d imprimerie_db -c "SELECT id, dossier_id, nom, chemin FROM fichiers LIMIT 5;"
```

## 🔍 Vérifications de la base de données

Vérifier le type de colonne `id` dans `dossiers`:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dossiers' 
  AND column_name = 'id';
```

Si `data_type` = `integer`, utiliser les IDs entiers partout.
Si `data_type` = `uuid`, générer des UUID à la création de dossiers.

## 📝 Notes importantes

1. **Chemins relatifs**: Toujours stocker `uploads/<dossier_id>/<filename>` en base
2. **IDs cohérents**: Choisir INTEGER ou UUID, pas un mélange
3. **Permissions upload**: Admin = toujours, Préparateur = seulement avant validation
4. **Validation ID**: Toujours vérifier le format avant la requête SQL

## 🚀 Ordre d'application recommandé

1. ✅ Appliquer CORRECTIF 2 (fonction `checkUploadPermissions`)
2. ✅ Appliquer CORRECTIF 3 (chemins relatifs)
3. ✅ Appliquer CORRECTIF 1 (validation ID dossier)
4. ✅ Appliquer CORRECTIF 4 (support INTEGER/UUID)
5. ✅ (Optionnel) CORRECTIF 5 (upload après validation)
6. 🧪 Tester chaque endpoint
7. 📊 Vérifier les logs et la base de données
