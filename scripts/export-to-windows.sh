#!/bin/bash

# =================================================
# Script d'exportation vers Windows - Plateforme d'Imprimerie
# Prépare un package complet pour déploiement Windows
# =================================================

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
PROJECT_NAME="imprimerie"
EXPORT_DIR="windows-deployment"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="imprimerie_windows_${TIMESTAMP}.tar.gz"

# Fonction d'affichage
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERREUR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[ATTENTION] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Vérifier les prérequis
check_requirements() {
    log "Vérification des prérequis pour l'exportation..."
    
    if ! command -v podman &> /dev/null; then
        error "Podman n'est pas installé"
        exit 1
    fi
    
    if ! command -v tar &> /dev/null; then
        error "tar n'est pas disponible"
        exit 1
    fi
}

# Construire les images si nécessaire
build_images() {
    log "Construction des images pour l'exportation..."
    
    # Backend
    log "Construction de l'image backend..."
    podman build -t "${PROJECT_NAME}-backend:latest" -f backend/Dockerfile.podman backend/
    
    # Frontend
    log "Construction de l'image frontend..."
    podman build -t "${PROJECT_NAME}-frontend:latest" \
        --build-arg REACT_APP_API_URL="/api" \
        --build-arg REACT_APP_SOCKET_URL="" \
        -f frontend/Dockerfile.podman frontend/
    
    log "Images construites"
}

# Exporter les images
export_images() {
    log "Exportation des images Docker..."
    
    mkdir -p "$EXPORT_DIR/images"
    
    # Exporter les images en format tar
    podman save -o "$EXPORT_DIR/images/postgres.tar" docker.io/postgres:15-alpine
    podman save -o "$EXPORT_DIR/images/redis.tar" docker.io/redis:7-alpine
    podman save -o "$EXPORT_DIR/images/backend.tar" "${PROJECT_NAME}-backend:latest"
    podman save -o "$EXPORT_DIR/images/frontend.tar" "${PROJECT_NAME}-frontend:latest"
    
    log "Images exportées dans $EXPORT_DIR/images/"
}

# Préparer les fichiers de configuration
prepare_config_files() {
    log "Préparation des fichiers de configuration..."
    
    mkdir -p "$EXPORT_DIR/config"
    
    # Copier les fichiers de configuration essentiels
    cp podman-compose.yml "$EXPORT_DIR/"
    cp -r backend/ecosystem.config.js "$EXPORT_DIR/config/"
    cp backend/package.json "$EXPORT_DIR/config/backend-package.json"
    cp frontend/package.json "$EXPORT_DIR/config/frontend-package.json"
    
    # Créer un fichier .env pour Windows
    cat > "$EXPORT_DIR/.env.windows" << 'EOF'
# Configuration Windows pour la Plateforme d'Imprimerie
# Renommez ce fichier en .env après avoir adapté les valeurs

# Base de données PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=imprimerie_db
DB_USER=imprimerie_user
DB_PASSWORD=imprimerie_production_password_ultra_secure_2024

# JWT
JWT_SECRET=imprimerie_jwt_production_secret_ultra_secure_key_2024_never_share_this
JWT_EXPIRES_IN=24h

# Configuration
NODE_ENV=production
PORT=5001

# URLs (ajustez selon votre configuration Windows)
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:5001
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_SOCKET_URL=http://localhost:5001

# Limites
UPLOAD_MAX_SIZE=100mb
REQUEST_TIMEOUT=300s

# Redis (optionnel)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=imprimerie_redis_password_2024
EOF
    
    log "Fichiers de configuration copiés"
}

# Créer les scripts Windows
create_windows_scripts() {
    log "Création des scripts Windows..."
    
    mkdir -p "$EXPORT_DIR/scripts"
    
    # Script de démarrage PowerShell
    cat > "$EXPORT_DIR/scripts/start.ps1" << 'EOF'
# Script de démarrage PowerShell pour la Plateforme d'Imprimerie
# Nécessite Podman Desktop pour Windows

Write-Host "🚀 Démarrage de la Plateforme d'Imprimerie sur Windows" -ForegroundColor Green

# Vérifier Podman
if (!(Get-Command podman -ErrorAction SilentlyContinue)) {
    Write-Error "Podman n'est pas installé. Installez Podman Desktop depuis https://podman-desktop.io/"
    exit 1
}

# Vérifier podman-compose
if (!(Get-Command podman-compose -ErrorAction SilentlyContinue)) {
    Write-Warning "podman-compose non trouvé. Installation via pip..."
    pip install podman-compose
}

# Créer les répertoires de données
Write-Host "Création des répertoires de données..." -ForegroundColor Blue
New-Item -ItemType Directory -Force -Path "data\postgres", "data\uploads", "data\logs", "data\backups", "data\redis"

# Charger les images
Write-Host "Chargement des images Docker..." -ForegroundColor Blue
podman load -i images\postgres.tar
podman load -i images\redis.tar
podman load -i images\backend.tar
podman load -i images\frontend.tar

# Démarrer les services
Write-Host "Démarrage des services..." -ForegroundColor Blue
podman-compose -f podman-compose.yml up -d

# Attendre et vérifier
Start-Sleep -Seconds 15

Write-Host "✅ Plateforme démarrée !" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:5001" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:5001/api-docs" -ForegroundColor Cyan
EOF

    # Script d'arrêt PowerShell
    cat > "$EXPORT_DIR/scripts/stop.ps1" << 'EOF'
# Script d'arrêt PowerShell pour la Plateforme d'Imprimerie

Write-Host "🛑 Arrêt de la Plateforme d'Imprimerie" -ForegroundColor Yellow

podman-compose -f podman-compose.yml down

Write-Host "✅ Services arrêtés" -ForegroundColor Green
EOF

    # Script batch pour compatibilité
    cat > "$EXPORT_DIR/scripts/start.bat" << 'EOF'
@echo off
echo 🚀 Démarrage de la Plateforme d'Imprimerie sur Windows
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
pause
EOF

    cat > "$EXPORT_DIR/scripts/stop.bat" << 'EOF'
@echo off
echo 🛑 Arrêt de la Plateforme d'Imprimerie
powershell -ExecutionPolicy Bypass -File scripts\stop.ps1
pause
EOF

    log "Scripts Windows créés"
}

# Créer la documentation
create_documentation() {
    log "Création de la documentation..."
    
    cat > "$EXPORT_DIR/README_WINDOWS.md" << 'EOF'
# Plateforme d'Imprimerie - Déploiement Windows

## Prérequis

1. **Podman Desktop** - Téléchargez depuis [podman-desktop.io](https://podman-desktop.io/)
2. **Python 3.x** - Pour podman-compose
3. **Git** (optionnel) - Pour les mises à jour

## Installation

### 1. Installer Podman Desktop
- Téléchargez et installez Podman Desktop
- Démarrez l'application et attendez que Podman soit initialisé

### 2. Installer podman-compose
Ouvrez PowerShell en tant qu'administrateur :
```powershell
pip install podman-compose
```

### 3. Préparer le projet
1. Extrayez l'archive dans un dossier (ex: `C:\imprimerie`)
2. Renommez `.env.windows` en `.env`
3. Ajustez les variables dans `.env` si nécessaire

## Démarrage

### Option 1: Scripts automatiques
Double-cliquez sur `scripts\start.bat` ou exécutez dans PowerShell :
```powershell
.\scripts\start.ps1
```

### Option 2: Manuel
```powershell
# Charger les images
podman load -i images\postgres.tar
podman load -i images\redis.tar
podman load -i images\backend.tar
podman load -i images\frontend.tar

# Créer les répertoires
mkdir data\postgres, data\uploads, data\logs, data\backups, data\redis

# Démarrer
podman-compose up -d
```

## Accès

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5001
- **Documentation API**: http://localhost:5001/api-docs

## Arrêt

Double-cliquez sur `scripts\stop.bat` ou :
```powershell
.\scripts\stop.ps1
```

## Dépannage

### Problème de ports
Si les ports 3001 ou 5001 sont occupés, modifiez dans `podman-compose.yml` :
```yaml
ports:
  - "3002:80"  # Frontend sur port 3002
  - "5002:5001"  # Backend sur port 5002
```

### Problème de permissions
Assurez-vous que Podman Desktop est démarré et que les services Windows sont actifs.

### Problème de mémoire
Augmentez la mémoire allouée à Podman dans les paramètres de Podman Desktop.

## Structure des données

```
data/
├── postgres/    # Base de données
├── uploads/     # Fichiers uploadés
├── logs/        # Logs de l'application
├── backups/     # Sauvegardes
└── redis/       # Cache Redis
```

## Support

- Documentation complète : Consultez les fichiers MD dans le projet
- Logs : `podman-compose logs -f`
- Status : `podman-compose ps`
EOF

    log "Documentation créée"
}

# Créer l'archive finale
create_archive() {
    log "Création de l'archive finale..."
    
    # Créer l'archive tar.gz
    tar -czf "$ARCHIVE_NAME" -C "$EXPORT_DIR" .
    
    # Calculer la taille
    SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
    
    log "Archive créée: $ARCHIVE_NAME ($SIZE)"
}

# Nettoyer les fichiers temporaires
cleanup() {
    log "Nettoyage..."
    
    # Garder l'archive, supprimer le répertoire temporaire
    if [[ -d "$EXPORT_DIR" ]]; then
        rm -rf "$EXPORT_DIR"
    fi
    
    log "Nettoyage terminé"
}

# Afficher le résumé
show_summary() {
    info "==========================================="
    info "📦 Export Windows terminé !"
    info "==========================================="
    info "Archive: $ARCHIVE_NAME"
    info "Taille: $(du -h "$ARCHIVE_NAME" | cut -f1)"
    info "==========================================="
    info "Pour déployer sur Windows:"
    info "1. Transférez $ARCHIVE_NAME sur Windows"
    info "2. Extrayez l'archive"
    info "3. Installez Podman Desktop"
    info "4. Exécutez scripts/start.bat"
    info "==========================================="
}

# Fonction principale
main() {
    log "📦 Exportation vers Windows"
    
    check_requirements
    
    # Nettoyer le répertoire d'export existant
    rm -rf "$EXPORT_DIR"
    
    build_images
    export_images
    prepare_config_files
    create_windows_scripts
    create_documentation
    create_archive
    cleanup
    show_summary
    
    log "✅ Exportation terminée avec succès !"
}

# Exécution
main "$@"