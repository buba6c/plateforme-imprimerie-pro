# 🗃️ Guide Création Base PostgreSQL sur Render

## 📋 Étapes pour créer la base de données PostgreSQL

### 1. Accéder à Render Dashboard
1. Aller sur https://render.com/
2. Se connecter avec votre compte GitHub
3. Cliquer sur "Dashboard"

### 2. Créer une nouvelle base PostgreSQL
1. Cliquer sur "New +" en haut à droite
2. Sélectionner "PostgreSQL"

### 3. Configuration de la base
```
Name: plateforme-imprimerie-db
Database: imprimerie_db
User: imprimerie_user
Region: Oregon (US West) - même région que votre backend
PostgreSQL Version: 15 (recommandé)
Plan: Free (pour commencer)
```

### 4. Finaliser la création
1. Cliquer sur "Create Database"
2. Attendre 2-3 minutes que la base soit créée
3. Noter l'URL de connexion qui apparaît

### 5. Configurer la variable d'environnement
1. Aller dans votre service backend "plateforme-imprimerie-pro"
2. Onglet "Environment" 
3. Ajouter la variable :
   - **Key**: `DATABASE_URL`
   - **Value**: [L'URL complète fournie par Render]

### 6. Variables d'environnement supplémentaires
Ajouter aussi ces variables dans le backend :
```
JWT_SECRET=imprimerie_jwt_secret_super_secure_2024_production
NODE_ENV=production
FRONTEND_URL=https://imprimerie-frontend.onrender.com
```

### 7. Redéployer le backend
1. Cliquer sur "Manual Deploy" dans votre service backend
2. Attendre que le déploiement se termine

## 🔧 URL de connexion PostgreSQL
L'URL sera du format :
```
postgresql://user:password@host:port/database
```

## 📝 Initialisation des tables
Une fois la base créée et connectée, les tables seront créées automatiquement au premier démarrage du backend grâce aux scripts d'initialisation.

## ✅ Vérification
Après configuration :
1. Tester l'endpoint de santé : https://plateforme-imprimerie-pro.onrender.com/api/health
2. Le statut "database" devrait être "connected"
3. Tester le login avec admin@imprimerie.com / admin123

## 🚨 Notes importantes
- La base PostgreSQL Free a des limitations (100MB, connexions limitées)
- Pour la production, considérer un plan payant
- Sauvegarder régulièrement les données importantes