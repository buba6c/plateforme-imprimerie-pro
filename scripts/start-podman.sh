#!/bin/bash

# =================================================
# Script de démarrage Podman pour la Plateforme d'Imprimerie
# Compatible macOS/Linux - Version 1.0.0
# =================================================

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
COMPOSE_FILE="podman-compose.yml"
PROJECT_NAME="imprimerie"
DATA_DIR="./data"

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
    log "Vérification des prérequis..."
    
    if ! command -v podman &> /dev/null; then
        error "Podman n'est pas installé. Veuillez l'installer : https://podman.io/getting-started/installation"
        exit 1
    fi
    
    if ! command -v podman-compose &> /dev/null; then
        warning "podman-compose n'est pas installé. Tentative d'installation..."
        pip3 install podman-compose || {
            error "Impossible d'installer podman-compose. Installez-le manuellement."
            exit 1
        }
    fi
    
    info "Podman version: $(podman --version)"
    info "Podman Compose version: $(podman-compose --version)"
}

# Créer les répertoires de données
create_data_directories() {
    log "Création des répertoires de données..."
    
    mkdir -p "$DATA_DIR"/{postgres,uploads,logs,backups,redis}
    
    # Permissions pour Podman (user namespaces)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Sur Linux, ajuster les permissions pour les user namespaces
        chmod 755 "$DATA_DIR"
        chmod 700 "$DATA_DIR"/postgres
        chmod 755 "$DATA_DIR"/{uploads,logs,backups,redis}
    fi
    
    log "Répertoires créés dans $DATA_DIR"
}

# Nettoyer les containers/images existants
cleanup() {
    log "Nettoyage des containers existants..."
    
    podman-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans || true
    
    # Nettoyer les images orphelines
    podman image prune -f || true
    
    log "Nettoyage terminé"
}

# Construire les images
build_images() {
    log "Construction des images Docker..."
    
    # Backend avec Dockerfile.podman
    log "Construction de l'image backend..."
    podman build -t "${PROJECT_NAME}-backend:latest" -f backend/Dockerfile.podman backend/
    
    # Frontend avec Dockerfile.podman
    log "Construction de l'image frontend..."
    podman build -t "${PROJECT_NAME}-frontend:latest" \
        --build-arg REACT_APP_API_URL="http://localhost:5001/api" \
        --build-arg REACT_APP_SOCKET_URL="http://localhost:5001" \
        -f frontend/Dockerfile.podman frontend/
    
    log "Images construites avec succès"
}

# Mettre à jour le fichier podman-compose.yml pour utiliser les images locales
update_compose_file() {
    log "Mise à jour du fichier de composition..."
    
    # Sauvegarder le fichier original
    cp "$COMPOSE_FILE" "${COMPOSE_FILE}.backup"
    
    # Remplacer les directives build par les images locales
    sed -i.tmp "s|build:|#build:|g" "$COMPOSE_FILE"
    sed -i.tmp "/dockerfile: Dockerfile/d" "$COMPOSE_FILE"
    sed -i.tmp "/context: .\/backend/a\\    image: ${PROJECT_NAME}-backend:latest" "$COMPOSE_FILE"
    sed -i.tmp "/context: .\/frontend/a\\    image: ${PROJECT_NAME}-frontend:latest" "$COMPOSE_FILE"
    
    rm -f "${COMPOSE_FILE}.tmp"
    
    log "Fichier de composition mis à jour"
}

# Démarrer les services
start_services() {
    log "Démarrage des services..."
    
    # Démarrer en mode détaché
    podman-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    
    log "Services démarrés en arrière-plan"
}

# Vérifier l'état des services
check_health() {
    log "Vérification de l'état des services..."
    
    sleep 10  # Attendre que les services démarrent
    
    # Vérifier PostgreSQL
    if podman exec "${PROJECT_NAME}_postgres_1" pg_isready -U imprimerie_user -d imprimerie_db &>/dev/null; then
        log "✅ PostgreSQL est opérationnel"
    else
        error "❌ PostgreSQL ne répond pas"
    fi
    
    # Vérifier Backend
    if curl -f http://localhost:5001/api/health &>/dev/null; then
        log "✅ Backend est opérationnel"
    else
        warning "⚠️ Backend ne répond pas encore (peut prendre quelques minutes)"
    fi
    
    # Vérifier Frontend
    if curl -f http://localhost:3001/health &>/dev/null; then
        log "✅ Frontend est opérationnel"
    else
        warning "⚠️ Frontend ne répond pas encore"
    fi
}

# Afficher les informations de connexion
show_info() {
    info "==========================================="
    info "🚀 Plateforme d'Imprimerie démarrée !"
    info "==========================================="
    info "Frontend: http://localhost:3001"
    info "Backend API: http://localhost:5001"
    info "API Docs: http://localhost:5001/api-docs"
    info "==========================================="
    info "Commandes utiles:"
    info "  Voir les logs: podman-compose -f $COMPOSE_FILE logs -f"
    info "  Arrêter: ./scripts/stop-podman.sh"
    info "  Statut: podman-compose -f $COMPOSE_FILE ps"
    info "==========================================="
}

# Fonction principale
main() {
    log "🐳 Démarrage de la Plateforme d'Imprimerie avec Podman"
    
    check_requirements
    create_data_directories
    cleanup
    build_images
    update_compose_file
    start_services
    check_health
    show_info
    
    log "✅ Déploiement terminé avec succès !"
}

# Exécution
main "$@"