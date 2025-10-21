#!/bin/bash

# =======================================================
# Script de sauvegarde PostgreSQL - EvocomPrint
# =======================================================

set -e  # Arrêter le script en cas d'erreur

# Configuration
DB_NAME="imprimerie_db"
DB_USER="imprimerie_user"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/Users/mac/plateforme-imprimerie-v3/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/imprimerie_backup_$DATE.sql"
BACKUP_ARCHIVE="$BACKUP_DIR/imprimerie_backup_$DATE.tar.gz"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Vérifier les prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Vérifier que pg_dump est installé
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump n'est pas installé. Installez PostgreSQL client."
    fi
    
    # Vérifier que le répertoire de sauvegarde existe
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Création du répertoire de sauvegarde: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    success "Prérequis validés"
}

# Nettoyer les anciennes sauvegardes (garder les 7 dernières)
cleanup_old_backups() {
    log "Nettoyage des anciennes sauvegardes..."
    
    # Compter le nombre de sauvegardes
    backup_count=$(find "$BACKUP_DIR" -name "imprimerie_backup_*.tar.gz" | wc -l)
    
    if [ "$backup_count" -gt 7 ]; then
        # Supprimer les plus anciennes (garder les 7 dernières)
        find "$BACKUP_DIR" -name "imprimerie_backup_*.tar.gz" -type f -print0 | \
        xargs -0 ls -t | \
        tail -n +8 | \
        xargs rm -f
        
        success "Anciennes sauvegardes supprimées"
    else
        log "Aucune ancienne sauvegarde à supprimer ($backup_count sauvegardes)"
    fi
}

# Effectuer la sauvegarde
perform_backup() {
    log "Début de la sauvegarde de la base de données..."
    log "Base de données: $DB_NAME"
    log "Fichier de sauvegarde: $BACKUP_FILE"
    
    # Variables d'environnement pour PostgreSQL
    export PGPASSWORD="$DB_PASSWORD"
    
    # Effectuer la sauvegarde avec pg_dump
    if pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --no-password \
        --verbose \
        --clean \
        --no-owner \
        --no-privileges \
        --format=plain \
        --file="$BACKUP_FILE"; then
        
        success "Sauvegarde SQL créée: $BACKUP_FILE"
    else
        error "Échec de la création de la sauvegarde SQL"
    fi
    
    # Vérifier que le fichier a été créé et n'est pas vide
    if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
        error "Le fichier de sauvegarde est vide ou inexistant"
    fi
    
    # Compresser la sauvegarde
    log "Compression de la sauvegarde..."
    if tar -czf "$BACKUP_ARCHIVE" -C "$BACKUP_DIR" "$(basename "$BACKUP_FILE")"; then
        success "Sauvegarde compressée: $BACKUP_ARCHIVE"
        
        # Supprimer le fichier SQL non compressé
        rm "$BACKUP_FILE"
        log "Fichier SQL temporaire supprimé"
    else
        error "Échec de la compression"
    fi
}

# Vérifier l'intégrité de la sauvegarde
verify_backup() {
    log "Vérification de l'intégrité de la sauvegarde..."
    
    if [ -f "$BACKUP_ARCHIVE" ]; then
        # Vérifier que l'archive n'est pas corrompue
        if tar -tzf "$BACKUP_ARCHIVE" > /dev/null 2>&1; then
            success "Archive valide"
            
            # Afficher la taille du fichier
            size=$(du -h "$BACKUP_ARCHIVE" | cut -f1)
            log "Taille de la sauvegarde: $size"
        else
            error "Archive corrompue"
        fi
    else
        error "Fichier de sauvegarde introuvable"
    fi
}

# Afficher le résumé
show_summary() {
    log "=== RÉSUMÉ DE LA SAUVEGARDE ==="
    log "Date: $(date)"
    log "Base de données: $DB_NAME"
    log "Fichier: $BACKUP_ARCHIVE"
    log "Taille: $(du -h "$BACKUP_ARCHIVE" | cut -f1)"
    log "Emplacement: $BACKUP_DIR"
    
    # Lister les sauvegardes disponibles
    log "Sauvegardes disponibles:"
    ls -lah "$BACKUP_DIR"/imprimerie_backup_*.tar.gz | tail -5
}

# Fonction principale
main() {
    log "=== DÉMARRAGE DE LA SAUVEGARDE EVOCOMPRINT ==="
    
    # Charger les variables d'environnement si disponibles
    if [ -f "/Users/mac/plateforme-imprimerie-v3/backend/.env" ]; then
        export $(grep -v '^#' /Users/mac/plateforme-imprimerie-v3/backend/.env | xargs)
        log "Variables d'environnement chargées"
    else
        warning "Fichier .env non trouvé, utilisation des valeurs par défaut"
        export DB_PASSWORD="imprimerie_password"
    fi
    
    check_prerequisites
    cleanup_old_backups
    perform_backup
    verify_backup
    show_summary
    
    success "Sauvegarde terminée avec succès!"
}

# Gestion des signaux (Ctrl+C, etc.)
trap 'error "Script interrompu par l'\''utilisateur"' INT TERM

# Exécuter le script principal
main "$@"