# ✅ CORRECTIONS APPLIQUÉES - Dossiers et Upload

## 📋 Résumé des problèmes résolus

### 🔴 Problème 1: "Dossier non trouvé" (404)
**Symptôme**: GET /api/dossiers/:id renvoyait 404 même si le dossier existait
**Cause**: Pas de validation de l'ID avant requête SQL
**✅ Solution appliquée**: Validation et normalisation de l'ID dossier (ligne 466-476 de `backend/routes/dossiers.js`)

### 🔴 Problème 2: Upload de fichiers échoue (500/404)
**Symptômes**: 
- Erreur PostgreSQL 22P02 (UUID invalide)
- Fonction `checkUploadPermissions()` non définie
- Chemins de fichiers incohérents (absolu vs relatif)

**✅ Solutions appliquées**:
1. **Fonction `checkUploadPermissions` ajoutée** (lignes 91-105 de `backend/routes/files.js`)
2. **Fonction `checkDossierViewPermissions` ajoutée** (lignes 107-131 de `backend/routes/files.js`)
3. **Chemins relatifs normalisés** (ligne 278 de `backend/routes/files.js`)
4. **Récupération du flag `validé_preparateur`** (ligne 237 de `backend/routes/files.js`)

## 📝 Fichiers modifiés

### 1. `backend/routes/files.js`
- ✅ Ajout fonction `checkUploadPermissions(userRole, dossier)`
- ✅ Ajout fonction `checkDossierViewPermissions(userRole, dossier)`
- ✅ Normalisation des chemins: `uploads/${dossierId}/${filename}` (relatif)
- ✅ Récupération de la colonne `validé_preparateur` lors de la vérification du dossier

### 2. `backend/routes/dossiers.js`
- ✅ Validation de l'ID dossier dans GET /:id
- ✅ Normalisation de l'ID (support INTEGER et UUID)

### 3. Nouveaux fichiers créés
- ✅ `PATCH_DOSSIERS_UPLOAD.md` - Documentation détaillée des correctifs
- ✅ `diagnostic-db.js` - Script de diagnostic de la base de données
- ✅ `CORRECTIONS_APPLIQUEES.md` - Ce fichier

## 🧪 Tests à effectuer

### 1. Diagnostic de la base de données
```bash
# Exécuter le script de diagnostic
cd /Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151
node diagnostic-db.js
```

**Ce script vérifie**:
- Type d'ID (INTEGER vs UUID)
- Colonnes critiques présentes
- Chemins de fichiers (absolus vs relatifs)
- Dossiers validés
- Statistiques générales

### 2. Test GET dossier par ID
```bash
# Remplacer <TOKEN> par un vrai token JWT et 1 par un ID existant
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:5001/api/dossiers/1
```

**Résultat attendu**: 200 OK avec les détails du dossier

### 3. Test upload de fichier
```bash
# Créer un fichier de test
echo "Test PDF content" > test.pdf

# Upload (remplacer <TOKEN> et 1)
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -F "files=@test.pdf" \
  http://localhost:5001/api/files/upload/1
```

**Résultat attendu**: 201 Created avec la liste des fichiers uploadés

### 4. Vérifier les logs
```bash
# Surveiller les logs en temps réel
tail -f backend/logs/error.log

# Dans un autre terminal, faire une requête
# Vérifier qu'il n'y a pas d'erreur 22P02 ou "checkUploadPermissions is not defined"
```

### 5. Test de validation de dossier
```bash
# Valider un dossier (préparateur uniquement)
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  http://localhost:5001/api/dossiers/1/valider
```

**Résultat attendu**: 
- ✅ Si le dossier a des fichiers: 200 OK, statut passe à "en_impression"
- ❌ Si pas de fichiers: 400 "Impossible de valider un dossier sans fichiers"

### 6. Test upload après validation
```bash
# Essayer d'uploader sur un dossier validé (devrait échouer pour préparateur)
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -F "files=@test.pdf" \
  http://localhost:5001/api/files/upload/1
```

**Résultat attendu**: 403 "Permission refusée pour uploader"

## 🔧 Actions recommandées

### Immédiat (à faire maintenant)
1. ✅ **Redémarrer le backend** pour appliquer les changements
   ```bash
   # Arrêter tous les PM2
   pm2 delete all
   
   # Vérifier qu'aucun processus n'écoute sur 5001
   lsof -i :5001
   # Si un processus existe, le tuer: kill -9 <PID>
   
   # Relancer UNIQUEMENT le backend
   cd /Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151/backend
   pm2 start ecosystem.dev.config.js
   
   # Ou si vous préférez nodemon
   npm run dev
   ```

2. ✅ **Exécuter le diagnostic**
   ```bash
   node diagnostic-db.js
   ```

3. ✅ **Tester les endpoints critiques** (voir section Tests ci-dessus)

### Court terme (dans les prochains jours)
1. 📊 **Migrer les chemins absolus vers relatifs** (si le diagnostic en trouve)
   ```sql
   -- Script de migration (à adapter selon votre cas)
   UPDATE fichiers 
   SET chemin = 'uploads/' || dossier_id || '/' || substring(chemin from '[^/]+$')
   WHERE chemin LIKE '/%';
   ```

2. 🧹 **Nettoyer les dossiers uploads orphelins**
   ```bash
   # Lister les dossiers dans uploads/
   ls -la uploads/
   
   # Comparer avec les IDs en base pour supprimer les orphelins
   ```

3. 📝 **Documenter le type d'ID choisi** (INTEGER ou UUID)
   - Si INTEGER: mettre à jour le README
   - Si UUID: ajouter validation UUID dans le frontend

### Moyen terme (prochaine sprint)
1. 🔐 **Ajouter des tests automatisés**
   - Test GET /api/dossiers/:id avec ID valide/invalide
   - Test POST /api/files/upload/:dossierId avec différents rôles
   - Test validation dossier avec/sans fichiers

2. 📈 **Monitoring**
   - Ajouter métriques sur les erreurs 404/500
   - Dashboard des uploads réussis/échoués

3. 🛡️ **Sécurité**
   - Rate limiting sur les uploads
   - Validation stricte des types MIME
   - Scan antivirus des fichiers uploadés (si budget)

## ⚠️ Points d'attention

### 1. Type d'ID (CRITIQUE)
Le script `diagnostic-db.js` va vous dire si vos IDs sont INTEGER ou UUID.
- **Si INTEGER**: Tout devrait fonctionner maintenant
- **Si UUID**: Vérifier que le frontend génère et envoie des UUID valides

### 2. Dossiers validés
Une fois qu'un préparateur valide un dossier:
- ✅ Il ne peut plus uploader de fichiers
- ✅ Il ne peut plus le modifier
- ✅ Seul l'admin peut déverrouiller avec `/api/dossiers/:id/autoriser-modification`

### 3. Chemins de fichiers
Les nouveaux uploads utilisent des chemins **relatifs**: `uploads/1/123456_file.pdf`
Les anciens peuvent être **absolus**: `/Users/mac/.../uploads/1/file.pdf`

**Conséquence**: Les anciens fichiers peuvent ne pas être téléchargeables si le serveur change de machine.
**Solution**: Migrer vers relatif (voir script SQL ci-dessus)

## 📞 Support

Si vous rencontrez des problèmes:

1. **Vérifier les logs**
   ```bash
   tail -100 backend/logs/error.log
   ```

2. **Vérifier la base de données**
   ```bash
   node diagnostic-db.js
   ```

3. **Tester manuellement avec curl** (voir section Tests)

4. **Vérifier les processus**
   ```bash
   pm2 list
   lsof -i :5001
   ```

## 🎯 Checklist de validation

- [ ] Script `diagnostic-db.js` s'exécute sans erreur
- [ ] Type d'ID clarifié (INTEGER ou UUID)
- [ ] GET /api/dossiers/:id fonctionne
- [ ] POST /api/files/upload/:dossierId fonctionne
- [ ] Validation de dossier fonctionne
- [ ] Upload bloqué après validation (pour préparateur)
- [ ] Pas d'erreur 22P02 dans les logs
- [ ] Pas d'erreur "checkUploadPermissions is not defined"
- [ ] Nouveaux fichiers utilisent des chemins relatifs
- [ ] Backend redémarré proprement (sans EADDRINUSE)

---

**Date des corrections**: 2025-10-04
**Fichiers modifiés**: 2
**Fichiers créés**: 3
**Tests recommandés**: 6
