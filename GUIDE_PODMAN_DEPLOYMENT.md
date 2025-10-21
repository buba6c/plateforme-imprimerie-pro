# 🐳 Guide de Déploiement Podman - Plateforme d'Imprimerie

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Installation macOS/Linux](#installation-macoslinux)
4. [Installation Windows](#installation-windows)
5. [Configuration](#configuration)
6. [Démarrage](#démarrage)
7. [Export vers Windows](#export-vers-windows)
8. [Dépannage](#dépannage)
9. [Maintenance](#maintenance)

## 🎯 Vue d'ensemble

Cette configuration Podman permet de déployer la **Plateforme d'Imprimerie** de manière containerisée, compatible avec macOS, Linux et Windows.

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   PostgreSQL    │
│   (React+Nginx) │◄──►│   (Node.js+PM2) │◄──►│   Database      │
│   Port: 3001    │    │   Port: 5001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │     Redis       │
                    │   (Cache)       │
                    │   Port: 6379    │
                    └─────────────────┘
```

### Services inclus

- **Frontend**: Interface React servie par Nginx
- **Backend**: API Node.js avec PM2
- **PostgreSQL**: Base de données principale
- **Redis**: Cache et sessions

## 🔧 Prérequis

### macOS/Linux
- **Podman** 4.0+ ([Installation](https://podman.io/getting-started/installation))
- **podman-compose** (`pip install podman-compose`)
- **Python 3.x** (pour podman-compose)
- **Git** (pour cloner/mettre à jour)

### Windows
- **Podman Desktop** ([Télécharger](https://podman-desktop.io/))
- **Python 3.x** ([Télécharger](https://www.python.org/downloads/))
- **PowerShell 5.1+** (inclus dans Windows)

## 🚀 Installation macOS/Linux

### 1. Préparer l'environnement

```bash
# Cloner ou se placer dans le répertoire du projet
cd /path/to/imprimerie

# Rendre les scripts exécutables
chmod +x scripts/*.sh

# Vérifier Podman
podman --version
podman-compose --version
```

### 2. Configuration

```bash
# Copier le fichier d'environnement
cp .env.podman.windows .env

# Éditer la configuration si nécessaire
nano .env
```

### 3. Démarrage

```bash
# Démarrage automatique avec le script
./scripts/start-podman.sh

# OU démarrage manuel
podman-compose -f podman-compose.yml up -d
```

### 4. Vérification

```bash
# Vérifier les services
podman-compose ps

# Voir les logs
podman-compose logs -f

# Tester l'accès
curl http://localhost:3001
curl http://localhost:5001/api/health
```

## 🪟 Installation Windows

### 1. Installer Podman Desktop

1. Téléchargez [Podman Desktop](https://podman-desktop.io/)
2. Installez et démarrez l'application
3. Attendez que Podman soit initialisé

### 2. Installer podman-compose

Ouvrez **PowerShell en tant qu'administrateur** :

```powershell
# Installer Python si nécessaire
# Télécharger depuis https://www.python.org/downloads/

# Installer podman-compose
pip install podman-compose

# Vérifier l'installation
podman --version
podman-compose --version
```

### 3. Préparer le projet

Si vous avez reçu une archive d'export :

```powershell
# Extraire l'archive
Expand-Archive -Path imprimerie_windows_*.zip -DestinationPath C:\imprimerie

# Se placer dans le répertoire
cd C:\imprimerie

# Configurer l'environnement
Copy-Item .env.podman.windows .env
```

### 4. Démarrage Windows

```powershell
# Option 1: Script automatique
.\scripts\start.bat

# Option 2: PowerShell
.\scripts\start.ps1

# Option 3: Manuel
podman-compose -f podman-compose.yml up -d
```

## ⚙️ Configuration

### Variables d'environnement importantes

Éditez le fichier `.env` :

```bash
# Ports (changez si occupés)
PORT=5001                    # Backend
FRONTEND_PORT=3001           # Frontend

# Base de données
DB_PASSWORD=votre_mot_de_passe_sécurisé

# JWT
JWT_SECRET=votre_clé_jwt_très_sécurisée

# URLs (ajustez selon votre environnement)
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:5001
```

### Ajuster les ressources

Pour des machines moins puissantes :

```bash
# Dans .env
BACKEND_MEMORY_LIMIT=256m
FRONTEND_MEMORY_LIMIT=128m
POSTGRES_MEMORY_LIMIT=512m
REDIS_MEMORY_LIMIT=64m
```

## 📤 Export vers Windows

### Depuis macOS/Linux

```bash
# Créer un package pour Windows
./scripts/export-to-windows.sh

# Cela crée une archive imprimerie_windows_YYYYMMDD_HHMMSS.tar.gz
```

### Contenu de l'export

```
imprimerie_windows_*.tar.gz
├── images/                 # Images Docker exportées
├── scripts/               # Scripts Windows (.bat, .ps1)
├── config/               # Fichiers de configuration
├── podman-compose.yml    # Configuration des services
├── .env.windows         # Variables d'environnement
└── README_WINDOWS.md    # Documentation spécifique Windows
```

### Transférer vers Windows

1. **Transférez l'archive** vers Windows (USB, réseau, etc.)
2. **Extrayez** dans un dossier (ex: `C:\imprimerie`)
3. **Suivez** les instructions dans `README_WINDOWS.md`

## 🔍 Dépannage

### Problèmes courants

#### Ports occupés

```bash
# Vérifier les ports
netstat -an | grep :3001
netstat -an | grep :5001

# Changer les ports dans podman-compose.yml
ports:
  - "3002:80"   # Frontend sur 3002
  - "5002:5001" # Backend sur 5002
```

#### Problèmes de permissions (Linux)

```bash
# Ajuster les permissions des répertoires de données
sudo chown -R $(id -u):$(id -g) data/
chmod -R 755 data/
```

#### Mémoire insuffisante

```bash
# Réduire les limites dans .env
BACKEND_MEMORY_LIMIT=256m
POSTGRES_MEMORY_LIMIT=512m
```

#### Problèmes Windows-spécifiques

```powershell
# Redémarrer Podman Desktop
# Vérifier les services Windows :
Get-Service | Where-Object {$_.Name -like "*podman*"}

# Réinitialiser Podman (attention: supprime les données)
podman system reset
```

### Logs et diagnostic

```bash
# Logs détaillés
podman-compose logs -f

# Logs d'un service spécifique
podman-compose logs backend
podman-compose logs frontend

# État des containers
podman ps -a

# Utilisation des ressources
podman stats
```

## 🔧 Maintenance

### Sauvegardes

```bash
# Sauvegarde automatique des données
tar -czf backup_$(date +%Y%m%d).tar.gz data/

# Sauvegarde de la base de données
podman exec imprimerie_postgres pg_dump -U imprimerie_user imprimerie_db > backup_db.sql
```

### Mises à jour

```bash
# Arrêter les services
./scripts/stop-podman.sh

# Reconstruire les images
podman-compose build --no-cache

# Redémarrer
./scripts/start-podman.sh
```

### Nettoyage

```bash
# Supprimer les containers arrêtés
podman container prune

# Supprimer les images inutilisées
podman image prune

# Nettoyage complet (ATTENTION: supprime les données)
podman system prune -a
```

## 📝 Commandes utiles

### Gestion des services

```bash
# Démarrer
podman-compose up -d

# Arrêter
podman-compose down

# Redémarrer un service
podman-compose restart backend

# Mettre à l'échelle
podman-compose up -d --scale backend=2
```

### Debug et développement

```bash
# Accéder au container backend
podman exec -it imprimerie_backend sh

# Accéder à la base de données
podman exec -it imprimerie_postgres psql -U imprimerie_user -d imprimerie_db

# Voir les variables d'environnement
podman exec imprimerie_backend env
```

## 🆘 Support

### Documentation complémentaire

- [Documentation Podman officielle](https://docs.podman.io/)
- [Podman Desktop](https://podman-desktop.io/docs/)
- [Guide podman-compose](https://github.com/containers/podman-compose)

### En cas de problème

1. **Vérifiez les logs** : `podman-compose logs -f`
2. **Redémarrez les services** : `podman-compose restart`
3. **Vérifiez l'espace disque** : `df -h`
4. **Consultez la documentation** des erreurs spécifiques

---

**🎉 Votre Plateforme d'Imprimerie est maintenant prête !**

Accédez à votre application :
- **Frontend** : http://localhost:3001
- **API Backend** : http://localhost:5001
- **Documentation API** : http://localhost:5001/api-docs