# 🚀 Guide de Déploiement Render - Plateforme d'Imprimerie

## 📋 Prérequis

1. **Compte Render** : [render.com](https://render.com)
2. **Repository Git** : Code poussé sur GitHub/GitLab
3. **Fichier render.yaml** : Configuré (✅ fait)

## 🏗️ Architecture Déployée

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   PostgreSQL    │
│   (Static Site) │───▶│   (Web Service) │───▶│   (Database)    │
│   React Build   │    │   Node.js/PM2   │    │   15 Alpine     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       ▲
                                ▼                       │
                       ┌─────────────────┐              │
                       │     Redis       │──────────────┘
                       │   (Database)    │
                       │   Cache/Sessions│
                       └─────────────────┘
```

## 🚀 Déploiement Rapide

### 1. Préparation du Repository

```bash
# Cloner ou être dans le projet
cd /path/to/imprimerie-platform

# Vérifier que les fichiers sont prêts
ls render.yaml                    # ✅ Configuration Render
ls backend/scripts/setup-render.js # ✅ Script post-install
ls database/init/                 # ✅ Scripts PostgreSQL
ls backend/config/redis.js        # ✅ Configuration Redis
```

### 2. Déploiement via Render Dashboard

1. **Se connecter** à [render.com](https://render.com)
2. **Blueprint** → **New Blueprint Instance**
3. **Connecter votre repository**
4. **Sélectionner le fichier `render.yaml`**
5. **Deploy** 🚀

### 3. Configuration Automatique

Le fichier `render.yaml` configure automatiquement :

- ✅ **PostgreSQL 15** avec initialisation
- ✅ **Redis** pour le cache
- ✅ **Backend API** Node.js
- ✅ **Frontend** React statique
- ✅ **Variables d'environnement**
- ✅ **Health checks**

## 🔧 Configuration Manuelle (Alternative)

### Étape 1 : Base de Données PostgreSQL

```yaml
# Via Render Dashboard
Service Type: PostgreSQL
Database Name: imprimerie_db
User: imprimerie_user
Plan: Starter (gratuit)
Region: Oregon
```

### Étape 2 : Redis Cache

```yaml
# Via Render Dashboard  
Service Type: Redis
Plan: Starter (gratuit)
Region: Oregon
```

### Étape 3 : Backend API

```yaml
# Via Render Dashboard
Service Type: Web Service
Runtime: Node
Build Command: npm ci
Start Command: npm start
Root Directory: ./backend

# Variables d'environnement (auto-générées par render.yaml)
NODE_ENV=production
PORT=10000
DB_HOST=[auto-généré]
DB_PORT=[auto-généré]
# ... autres variables
```

### Étape 4 : Frontend React

```yaml
# Via Render Dashboard
Service Type: Static Site
Build Command: npm ci && npm run build
Publish Directory: ./build
Root Directory: ./frontend

# Variables d'environnement
REACT_APP_API_URL=https://[backend-url]/api
REACT_APP_SOCKET_URL=https://[backend-url]
GENERATE_SOURCEMAP=false
```

## 🌍 URLs d'Accès

Après déploiement :

- **Frontend** : `https://imprimerie-frontend.onrender.com`
- **Backend API** : `https://imprimerie-backend.onrender.com`
- **Documentation API** : `https://imprimerie-backend.onrender.com/api-docs`
- **Health Check** : `https://imprimerie-backend.onrender.com/api/health`

## 🔐 Sécurité

### Variables Sensibles

Les variables suivantes sont **auto-générées** de manière sécurisée :

- `JWT_SECRET` : Token de 64 caractères
- `DB_PASSWORD` : Mot de passe PostgreSQL
- `REDIS_PASSWORD` : Mot de passe Redis

### Headers de Sécurité

Le frontend inclut automatiquement :

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer-when-downgrade
```

## 📊 Monitoring

### Health Checks Automatiques

- **Backend** : `/api/health` (30s interval)
- **Base de données** : Connexion PostgreSQL
- **Cache** : Ping Redis

### Logs d'Application

```bash
# Via Render Dashboard
Services → [service-name] → Logs

# Ou via CLI Render
render logs [service-name]
```

## 🏷️ Plans et Coûts

### Plan Gratuit (Starter)

- **Frontend** : Gratuit (sites statiques)
- **Backend** : 750h/mois gratuit
- **PostgreSQL** : 1GB gratuit
- **Redis** : 25MB gratuit

### Limites Plan Gratuit

- Sleep après 15min d'inactivité
- 512MB RAM par service
- 1GB disque PostgreSQL
- Pas de domaine personnalisé

### Upgrade Recommandé (Production)

```yaml
# Backend: Standard ($7/mois)
- 1GB RAM
- Pas de sleep
- Domaines personnalisés

# PostgreSQL: Standard ($7/mois)  
- 10GB stockage
- Sauvegardes automatiques

# Redis: Standard ($7/mois)
- 100MB cache
- Persistence
```

## 🔄 Mise à Jour

### Déploiement Automatique

```bash
# Push vers main/master déclenche redéploiement
git add .
git commit -m "Update platform"
git push origin main
```

### Déploiement Manuel

```bash
# Via CLI Render
render deploy [service-name]

# Ou via Dashboard
Services → [service] → Manual Deploy
```

## 🐛 Dépannage

### Backend ne démarre pas

```bash
# Vérifier les logs
render logs imprimerie-backend

# Variables d'environnement
Services → Backend → Environment
```

### Erreurs Base de Données

```bash
# Vérifier la connexion PostgreSQL
Services → PostgreSQL → Info → External Database URL

# Test de connexion
psql [DATABASE_URL]
```

### Frontend ne charge pas l'API

```bash
# Vérifier les variables React
Services → Frontend → Environment
REACT_APP_API_URL=https://[correct-backend-url]/api

# Rebuild frontend
Services → Frontend → Manual Deploy
```

### Redis Indisponible

Le système utilise automatiquement un **cache mémoire de fallback** si Redis est indisponible.

## 🎯 Optimisations

### Performance Frontend

- ✅ Source maps désactivées
- ✅ Assets compressés  
- ✅ Cache headers optimisés
- ✅ Lazy loading des composants

### Performance Backend

- ✅ Compression gzip
- ✅ Rate limiting
- ✅ Connexions DB poolées
- ✅ Cache Redis/mémoire

### Base de Données

- ✅ Index optimisés
- ✅ Requêtes préparées
- ✅ Nettoyage automatique logs

## 📞 Support

- **Documentation Render** : [render.com/docs](https://render.com/docs)
- **Status Page** : [status.render.com](https://status.render.com)
- **Community** : [community.render.com](https://community.render.com)

---

## ✅ Checklist Déploiement

- [ ] Repository Git configuré
- [ ] `render.yaml` validé  
- [ ] Variables d'environnement vérifiées
- [ ] Scripts d'initialisation testés
- [ ] URLs d'API mises à jour
- [ ] Tests de déploiement effectués
- [ ] Monitoring configuré
- [ ] Sauvegardes planifiées

**🎉 Votre plateforme est prête pour Render !**