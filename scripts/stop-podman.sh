#!/bin/bash

# =================================================
# Script d'arrêt Podman pour la Plateforme d'Imprimerie
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

# Arrêter les services
stop_services() {
    log "Arrêt des services..."
    
    if podman-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps -q &>/dev/null; then
        podman-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
        log "Services arrêtés"
    else
        warning "Aucun service en cours d'exécution"
    fi
}

# Nettoyage optionnel
cleanup_optional() {
    read -p "Voulez-vous supprimer les volumes de données ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        warning "Suppression des volumes de données..."
        podman-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
        log "Volumes supprimés"
    fi
    
    read -p "Voulez-vous supprimer les images construites ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        warning "Suppression des images..."
        podman rmi "${PROJECT_NAME}-backend:latest" "${PROJECT_NAME}-frontend:latest" || true
        log "Images supprimées"
    fi
}

# Fonction principale
main() {
    log "🛑 Arrêt de la Plateforme d'Imprimerie"
    
    stop_services
    cleanup_optional
    
    log "✅ Arrêt terminé"
}

# Exécution
main "$@"