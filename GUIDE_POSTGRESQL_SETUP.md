# 🗄️ GUIDE RAPIDE : Configurer PostgreSQL

## 🎯 OBJECTIF
Connecter une base de données PostgreSQL à votre backend API pour activer :
- ✅ Login administrateur
- ✅ Gestion des dossiers
- ✅ Upload de fichiers
- ✅ Système complet

## 🚀 ÉTAPES SIMPLES

### 1. **Créer PostgreSQL sur Render**

1. **Allez sur** : https://render.com/dashboard
2. **Cliquez** "New +" → "PostgreSQL"
3. **Configuration** :
   ```
   Name: imprimerie-postgres
   Database: imprimerie_db
   User: imprimerie_user
   Region: Oregon (ou proche de votre backend)
   Plan: Starter (gratuit)
   ```
4. **Créer** - Attendre 2-3 minutes

### 2. **Récupérer l'URL de connexion**

1. **Cliquez** sur votre base PostgreSQL créée
2. **Onglet "Info"** 
3. **Copiez** la "External Database URL" :
   ```
   postgresql://imprimerie_user:password@host:port/imprimerie_db
   ```

### 3. **Configurer le backend**

1. **Allez** dans votre service backend
2. **Onglet "Environment"**
3. **Add Environment Variable** :
   ```
   DATABASE_URL = postgresql://imprimerie_user:password@host:port/imprimerie_db
   ```
4. **Add Environment Variable** :
   ```
   JWT_SECRET = [générer une clé de 64 caractères]
   ```

### 4. **Générer JWT_SECRET**

```bash
# Copiez cette commande dans votre terminal local
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiez le résultat (64 caractères) dans `JWT_SECRET`.

### 5. **Redéployer**

1. **Manual Deploy** dans votre service backend
2. **Attendre** 2-3 minutes
3. **Vérifier** les logs

## ✅ VALIDATION

### Test 1: Health Check
```
https://plateforme-imprimerie-pro.onrender.com/api/health
```
Résultat attendu : `{"status": "OK", "database": "connected"}`

### Test 2: Login Admin
```
POST https://plateforme-imprimerie-pro.onrender.com/api/auth/login
Content-Type: application/json

{
  "email": "admin@imprimerie.com",
  "password": "admin123"
}
```

### Test 3: Liste Dossiers
```
GET https://plateforme-imprimerie-pro.onrender.com/api/dossiers
```

## 🔧 VARIABLES FINALES REQUISES

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://imprimerie_user:password@host:port/imprimerie_db
JWT_SECRET=your_64_character_secret_key_here
```

## 🎯 RÉSULTAT FINAL

Après configuration :
- ✅ **API complète** fonctionnelle
- ✅ **Base de données** connectée
- ✅ **Login admin** : admin@imprimerie.com / admin123
- ✅ **Toutes les fonctionnalités** activées

## 🆘 EN CAS DE PROBLÈME

### Erreur de connexion BDD :
1. Vérifiez l'URL DATABASE_URL
2. Vérifiez que PostgreSQL est démarré
3. Consultez les logs du backend

### Erreur JWT :
1. Vérifiez que JWT_SECRET fait 64+ caractères
2. Pas d'espaces dans la clé
3. Redéployez après modification

---

**🚀 Une fois PostgreSQL configuré, votre plateforme sera 100% opérationnelle !**