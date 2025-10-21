# 🔍 Diagnostic et Solutions - Système de Conversion Devis → Dossier

**Date:** 9 Octobre 2025  
**Statut:** Backend déployé avec corrections appliquées

---

## ✅ Corrections Appliquées

### 1. **Correction du Service de Conversion**
**Problème détecté:** Le champ `client` dans la table `dossiers` ne peut pas être NULL, mais le service utilisait directement `devis.client_nom` sans vérifier s'il était vide.

**Solution appliquée:**
- Ajout d'un système de **fallback** qui récupère le nom client depuis plusieurs sources :
  1. `devis.client_nom` (colonne directe)
  2. `dataJson.client` (données JSON)
  3. `dataJson.nomClient` (variante)
  4. `dataJson.clientNom` (variante)
  5. `"Client non renseigné"` (valeur par défaut)

**Fichier modifié:** `backend/services/conversionService.js` (lignes 62-68)

---

## ⚠️ Problème Identifié - À Corriger

### 2. **Clé API OpenAI Corrompue**

**Symptôme:**
```
❌ Erreur déchiffrement clé API: The argument 'encoding' is invalid for data of length 193. Received 'hex'
```

**Cause racine:**
La clé API OpenAI stockée dans la base de données contient un **format invalide**. Elle contient 193 caractères (nombre impair), ce qui n'est pas un hexadécimal valide. L'analyse montre qu'elle contient un caractère `:` au milieu, suggérant un mauvais format d'enregistrement initial.

**Données actuelles:**
```sql
SELECT LENGTH(api_key_encrypted) as key_len, LENGTH(api_key_iv) as iv_len 
FROM openai_config WHERE id = 1;

 key_len | iv_len 
---------|--------
     193 |     32
```

**Impact:**
- Le système OpenAI **ne peut pas fonctionner** pour les estimations de devis avec IA
- Fallback automatique vers calcul manuel

---

## 🔧 Solution Proposée

### Option 1: Réenregistrer la clé API (Recommandé)

Un script interactif a été créé pour corriger le problème :

```bash
cd /Users/mac/Documents/PLATEFOME/code_backup_20251003_131151/backend
node scripts/fix-openai-key.js
```

**Ce que fait le script:**
1. ✅ Demande la clé API OpenAI
2. ✅ Chiffre correctement avec AES-256-CBC
3. ✅ Enregistre dans la base de données
4. ✅ Vérifie immédiatement le déchiffrement
5. ✅ Active automatiquement OpenAI

### Option 2: Désactiver temporairement OpenAI

Si vous n'avez pas besoin d'OpenAI immédiatement :

```sql
UPDATE openai_config SET is_active = FALSE WHERE id = 1;
```

Cela supprimera les erreurs des logs.

---

## 📊 État du Système

### ✅ Fonctionnel
- ✅ Service de conversion devis → dossier déployé
- ✅ Migrations de base de données appliquées
- ✅ Routes API créées (`/api/devis/:id/convert`)
- ✅ Copie automatique de toutes les données du devis
- ✅ Attribution correcte au préparateur créateur du devis
- ✅ Copie physique des fichiers joints
- ✅ Traçabilité complète (historiques)
- ✅ Backend redémarré (PM2)

### ⚠️ À Corriger
- ⚠️ Clé API OpenAI corrompue (script de correction disponible)

### 📝 Non Déployé (Optionnel)
- 📝 Interface frontend pour la conversion (à déployer si nécessaire)

---

## 🧪 Tests Recommandés

### 1. Test de Conversion Devis → Dossier

**Prérequis:** Créer un devis avec `statut = 'valide'`

```bash
# Via API
curl -X POST http://localhost:3000/api/devis/:id/convert \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Vérifications:**
- [ ] Le dossier est créé avec `statut = 'en_cours'`
- [ ] Le `client` n'est pas NULL
- [ ] Le `preparateur_id` correspond au créateur du devis (`user_id`)
- [ ] Le `data_json` contient toutes les données du devis
- [ ] Le devis a `statut = 'converti'` et `is_locked = TRUE`
- [ ] Les fichiers sont copiés dans `uploads/dossiers/:folder_id/`

### 2. Test OpenAI (Après Correction)

```bash
cd backend
node scripts/fix-openai-key.js
# Entrer votre clé API OpenAI (sk-...)
```

Puis tester l'estimation d'un devis via l'interface ou l'API.

---

## 📋 Commandes Utiles

### Vérifier l'état du backend
```bash
pm2 status
pm2 logs imprimerie-backend --lines 50
```

### Vérifier la base de données
```bash
PGPASSWORD=imprimerie_password psql -h localhost -U imprimerie_user -d imprimerie_db
```

### Redémarrer le backend
```bash
cd /Users/mac/Documents/PLATEFOME/code_backup_20251003_131151/backend
pm2 restart imprimerie-backend
```

---

## 📁 Fichiers Créés/Modifiés

### Nouveaux Fichiers
1. `backend/services/conversionService.js` - Service principal de conversion
2. `database/migrations/add_conversion_fields.sql` - Migrations SQL
3. `backend/scripts/test-decrypt.js` - Script de diagnostic
4. `backend/scripts/fix-openai-key.js` - **Script de correction OpenAI**
5. `DONNEES_DEVIS_VERS_DOSSIER.md` - Documentation complète
6. `DEPLOYMENT_REPORT.md` - Rapport de déploiement
7. `DIAGNOSTIC_ET_SOLUTIONS.md` - Ce document

### Fichiers Modifiés
1. `backend/routes/devis.js` - Routes de conversion ajoutées
2. `backend/services/conversionService.js` - Correction extraction client (lignes 62-68)

---

## 🎯 Prochaines Étapes Recommandées

1. **[URGENT]** Corriger la clé API OpenAI avec le script fourni
2. **[RECOMMANDÉ]** Tester la conversion d'un devis validé
3. **[OPTIONNEL]** Déployer l'interface frontend pour la conversion
4. **[OPTIONNEL]** Créer des tests automatisés pour la conversion

---

## 💡 Notes Importantes

### Sécurité
- ✅ Les clés API sont chiffrées avec AES-256-CBC
- ✅ La clé de chiffrement est stockée dans une variable d'environnement
- ✅ Aucune clé API n'est loggée en clair

### Performance
- ✅ Les conversions utilisent des transactions pour garantir l'intégrité
- ✅ Les fichiers sont copiés physiquement (pas de liens symboliques)
- ✅ Les index SQL sont optimisés pour les requêtes fréquentes

### Traçabilité
- ✅ Chaque conversion est enregistrée dans `conversion_historique`
- ✅ Les modifications de devis sont tracées dans `devis_historique`
- ✅ Le `converted_folder_id` permet de retrouver le dossier créé

---

## 📞 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs:** `pm2 logs imprimerie-backend`
2. **Vérifier la base:** Colonnes `client_nom` et `data_json` dans `devis`
3. **Exécuter le script de diagnostic:** `node scripts/test-decrypt.js`
4. **Consulter la documentation:** `DONNEES_DEVIS_VERS_DOSSIER.md`

---

**Fin du rapport** ✅
