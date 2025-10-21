# ✅ Checklist d'Installation - Module Devis & Facturation

## 📋 Avant de commencer

- [ ] Vérifier que la plateforme fonctionne correctement
- [ ] Faire une sauvegarde de la base de données
- [ ] S'assurer d'avoir accès root MySQL
- [ ] Node.js version 14+ installé
- [ ] npm fonctionnel

---

## 🔧 Installation Backend

### 1. Installation des dépendances

- [ ] Ouvrir un terminal dans le dossier racine
- [ ] Exécuter : `./install-devis-facturation.sh`
- [ ] Vérifier qu'aucune erreur n'apparaît
- [ ] Vérifier que `ENCRYPTION_KEY` est ajoutée au `.env`

**Commandes manuelles si besoin** :
```bash
cd backend
npm install openai pdfkit multer uuid
```

### 2. Création des dossiers

- [ ] Vérifier que `/backend/uploads/devis/` existe
- [ ] Vérifier que `/backend/uploads/factures/` existe
- [ ] Vérifier que `/backend/uploads/config/openai/` existe
- [ ] Vérifier les permissions d'écriture

**Commande manuelle** :
```bash
mkdir -p backend/uploads/{devis,factures,config/openai}
chmod 755 backend/uploads/{devis,factures,config/openai}
```

### 3. Migration SQL

- [ ] Se connecter à MySQL
- [ ] Sélectionner la base `plateforme_impression`
- [ ] Exécuter le fichier `backend/database/migrations/002_devis_facturation.sql`
- [ ] Vérifier qu'aucune erreur SQL n'apparaît

**Commandes** :
```bash
# Option 1 : Via terminal
mysql -u root -p plateforme_impression < backend/database/migrations/002_devis_facturation.sql

# Option 2 : Via phpMyAdmin
# Copier le contenu du fichier et l'exécuter
```

**Vérifications** :
```sql
-- Doit retourner 5 tables
SHOW TABLES LIKE '%devis%';
SHOW TABLES LIKE '%factures%';
SHOW TABLES LIKE '%tarifs%';
SHOW TABLES LIKE '%openai%';

-- Doit retourner ~30 lignes
SELECT COUNT(*) FROM tarifs_config;

-- Doit retourner 1 ligne
SELECT * FROM openai_config;
```

### 4. Montage des routes dans server.js

- [ ] Ouvrir `backend/server.js`
- [ ] Trouver la section où les routes sont montées (après ligne 80 environ)
- [ ] Ajouter les 4 nouvelles routes **APRÈS** les routes existantes

**Code à ajouter** (copier depuis `backend/server-routes-update.js`) :
```javascript
// ================================
// ROUTES DEVIS & FACTURATION
// ================================
try {
  const devisRoutes = require('./routes/devis');
  const facturesRoutes = require('./routes/factures');
  const tarifsRoutes = require('./routes/tarifs');
  const openaiConfigRoutes = require('./routes/openai-config');
  
  if (devisRoutes) {
    app.use('/api/devis', devisRoutes);
    console.log('✅ Route devis montée');
  }
  
  if (facturesRoutes) {
    app.use('/api/factures', facturesRoutes);
    console.log('✅ Route factures montée');
  }
  
  if (tarifsRoutes) {
    app.use('/api/tarifs', tarifsRoutes);
    console.log('✅ Route tarifs montée');
  }
  
  if (openaiConfigRoutes) {
    app.use('/api/settings/openai', openaiConfigRoutes);
    console.log('✅ Route openai-config montée');
  }
} catch (error) {
  console.warn('⚠️  Erreur routes devis/facturation:', error.message);
}
```

- [ ] Trouver `app.get('/api', ...)` (ligne ~137)
- [ ] Dans l'objet `endpoints`, ajouter :

```javascript
devis: '/api/devis',
factures: '/api/factures',
tarifs: '/api/tarifs',
'openai-config': '/api/settings/openai',
```

- [ ] Sauvegarder le fichier

### 5. Redémarrer le serveur

- [ ] Arrêter le serveur actuel
- [ ] Redémarrer avec PM2 ou npm

**Commandes** :
```bash
cd backend

# Avec PM2
pm2 restart ecosystem.config.js

# Avec npm
npm run dev

# Vérifier les logs
pm2 logs
# ou
tail -f backend.log
```

**Dans les logs, vous devez voir** :
```
✅ Route devis montée
✅ Route factures montée
✅ Route tarifs montée
✅ Route openai-config montée
```

---

## 🧪 Tests Backend

### 1. Tester les routes

- [ ] Ouvrir Postman ou utiliser curl
- [ ] Se connecter pour obtenir un token JWT

**Obtenir un token** :
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}'
```

- [ ] Copier le token reçu

**Tester les routes** :
```bash
# Remplacer YOUR_TOKEN par le token obtenu

# 1. Liste des tarifs (doit retourner ~30 tarifs)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/tarifs

# 2. Config OpenAI (doit retourner is_active: false)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/settings/openai

# 3. Liste des devis (doit retourner tableau vide au début)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/devis

# 4. Liste des factures (doit retourner tableau vide)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/factures
```

### 2. Créer un devis de test

```bash
curl -X POST http://localhost:5001/api/devis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "machine_type": "roland",
    "data_json": "{\"largeur\":200,\"hauteur\":150,\"support\":\"bache\"}",
    "client_nom": "Client Test",
    "client_contact": "0612345678"
  }'
```

- [ ] Vérifier que le devis est créé
- [ ] Noter l'ID du devis
- [ ] Vérifier que `prix_estime` est calculé

### 3. Télécharger le PDF du devis

```bash
# Remplacer 1 par l'ID du devis créé
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/devis/1/pdf \
  -o test-devis.pdf
```

- [ ] Vérifier que le fichier PDF est créé
- [ ] Ouvrir le PDF et vérifier son contenu

---

## 🎨 Frontend

### 1. Vérifier la navigation

- [ ] Lancer le frontend : `cd frontend && npm start`
- [ ] Se connecter en tant que **préparateur**
- [ ] Dans le menu latéral, vérifier la présence de :
  - ✓ "Créer un devis"
  - ✓ "Mes devis"
  - ✓ "Mes factures"

- [ ] Se déconnecter
- [ ] Se connecter en tant qu'**admin**
- [ ] Dans le menu, vérifier la présence de :
  - ✓ "Tous les devis"
  - ✓ "Toutes les factures"
  - ✓ "Tarification"

### 2. Cliquer sur les menus

- [ ] Cliquer sur "Créer un devis" → doit afficher un placeholder
- [ ] Cliquer sur "Mes devis" → doit afficher un placeholder
- [ ] Vérifier qu'aucune erreur console n'apparaît

---

## 🔐 Configuration OpenAI (Optionnel)

### 1. Obtenir une clé API

- [ ] Créer un compte sur [platform.openai.com](https://platform.openai.com)
- [ ] Générer une clé API (commence par sk-...)
- [ ] Copier la clé

### 2. Configurer via l'API

```bash
# Tester la connexion
curl -X POST http://localhost:5001/api/settings/openai/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"api_key": "sk-..."}'

# Si succès, sauvegarder
curl -X PUT http://localhost:5001/api/settings/openai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "api_key": "sk-...",
    "is_active": true,
    "knowledge_base_text": "Prix Roland: 7000 F/m² bâche, 9500 F/m² vinyle"
  }'
```

### 3. Tester l'estimation IA

- [ ] Créer un nouveau devis
- [ ] Vérifier dans la réponse que `ia_used: true`
- [ ] Vérifier que `explanation` contient un texte de l'IA

---

## ✅ Validation finale

### Checklist complète

- [ ] Backend démarre sans erreur
- [ ] Les 4 nouvelles routes sont montées
- [ ] La migration SQL est appliquée
- [ ] Les tarifs par défaut existent
- [ ] Un devis de test peut être créé
- [ ] Le PDF du devis se génère
- [ ] Le menu frontend affiche les nouvelles sections
- [ ] Aucune erreur console
- [ ] (Optionnel) OpenAI fonctionne

### Tests de permissions

- [ ] Un préparateur voit uniquement ses devis
- [ ] Un admin voit tous les devis
- [ ] Un préparateur ne peut pas accéder à `/api/tarifs/:id` en PUT
- [ ] Un admin peut modifier les tarifs

---

## 🐛 Résolution de problèmes

### Erreur: "Cannot find module 'openai'"
```bash
cd backend
npm install openai pdfkit multer uuid
```

### Erreur: "Table doesn't exist"
→ La migration SQL n'a pas été exécutée
```bash
mysql -u root -p plateforme_impression < backend/database/migrations/002_devis_facturation.sql
```

### Erreur: "ENOENT: no such file or directory"
→ Les dossiers uploads n'existent pas
```bash
mkdir -p backend/uploads/{devis,factures,config/openai}
```

### Les routes ne sont pas montées
→ Vérifier server.js et les logs
```bash
grep -n "devis" backend/server.js
pm2 logs
```

### L'IA ne fonctionne pas
→ Vérifier la clé OpenAI
```sql
SELECT is_active, last_test_status FROM openai_config;
```

---

## 📞 Support

Si un problème persiste :
1. Vérifier les logs : `pm2 logs` ou `tail -f backend.log`
2. Vérifier la console du navigateur (F12)
3. Tester les routes avec curl/Postman
4. Consulter la documentation : `README_DEVIS_FACTURATION.md`

---

## 🎉 Installation terminée !

Une fois tous les éléments cochés, le module est **opérationnel** !

**Prochaines étapes** :
- Créer les composants React pour les interfaces
- Personnaliser les tarifs
- Configurer OpenAI (optionnel)
- Former les utilisateurs

---

**Temps d'installation estimé** : 15-30 minutes  
**Version** : 1.0.0  
**Date** : 2025-10-09
