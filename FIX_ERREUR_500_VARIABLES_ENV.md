# ⚙️ Configuration Variables d'Environnement Backend

## 🎯 Variables Essentielles à Ajouter

### Dans Render Dashboard > Service Backend > Environment

1. **DATABASE_URL** (CRITIQUE)
   ```
   Key: DATABASE_URL
   Value: postgresql://[user]:[password]@[host]:[port]/[database]
   Description: URL de connexion PostgreSQL fournie par Render
   ```

2. **JWT_SECRET** (CRITIQUE)
   ```
   Key: JWT_SECRET
   Value: imprimerie_jwt_secret_super_secure_2024_production
   Description: Clé secrète pour signer les tokens JWT
   ```

3. **NODE_ENV**
   ```
   Key: NODE_ENV
   Value: production
   Description: Environment de production
   ```

4. **FRONTEND_URL**
   ```
   Key: FRONTEND_URL
   Value: https://imprimerie-frontend.onrender.com
   Description: URL du frontend pour CORS
   ```

## 🚨 Erreur 500 Actuelle

L'erreur `POST /api/auth/login 500` est causée par :
- ❌ Pas de DATABASE_URL configurée
- ❌ Le backend ne peut pas se connecter à PostgreSQL
- ❌ Les requêtes SQL échouent

## 🔧 Solution Rapide

1. **Créer base PostgreSQL** sur Render (gratuit)
2. **Copier l'URL de connexion** 
3. **Ajouter DATABASE_URL** dans les variables d'environnement
4. **Redéployer le backend**

## ✅ Vérification

Après configuration :
```bash
# Tester la santé du backend
curl https://plateforme-imprimerie-pro.onrender.com/api/health

# Réponse attendue : "database": "connected"
```

## 🕐 Temps Estimé

- Création PostgreSQL : 3-5 minutes
- Configuration variables : 2 minutes  
- Redéploiement backend : 3-5 minutes
- **Total : 10-15 minutes**

## 📋 Ordre des Opérations

1. ✅ Routes React Router (FAIT)
2. ⏳ **Base PostgreSQL (EN COURS)**
3. ⏳ Variables d'environnement
4. ⏳ Test login complet
5. ⏳ Fonctionnalités avancées