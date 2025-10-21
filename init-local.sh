#!/bin/bash

# Script d'initialisation locale pour EvocomPrint
# Ce script configure et démarre l'application localement

set -e

echo "🚀 Initialisation de EvocomPrint en local"
echo "========================================="

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions d'affichage
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Répertoire du projet
PROJECT_DIR="/Users/mac/plateforme-imprimerie-v3"

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log "Vérification des prérequis..."
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        error "Docker n'est pas installé. Veuillez l'installer depuis https://docker.com"
        exit 1
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    # Vérifier que Docker est en cours d'exécution
    if ! docker info &> /dev/null; then
        error "Docker n'est pas en cours d'exécution. Veuillez le démarrer"
        exit 1
    fi
    
    success "Prérequis vérifiés ✓"
}

# Nettoyer les anciens conteneurs
cleanup() {
    log "Nettoyage des anciens conteneurs..."
    cd "$PROJECT_DIR"
    
    docker-compose down --remove-orphans 2>/dev/null || true
    
    success "Nettoyage terminé"
}

# Créer les volumes Docker
create_volumes() {
    log "Création des volumes Docker..."
    
    docker volume create evocomprint_postgres_data 2>/dev/null || true
    docker volume create evocomprint_uploads 2>/dev/null || true
    
    success "Volumes créés"
}

# Démarrer PostgreSQL et attendre qu'il soit prêt
start_database() {
    log "Démarrage de la base de données PostgreSQL..."
    cd "$PROJECT_DIR"
    
    # Démarrer uniquement PostgreSQL
    docker-compose up -d postgres
    
    # Attendre que PostgreSQL soit prêt
    log "Attente de la disponibilité de PostgreSQL..."
    sleep 10
    
    # Vérifier la connexion
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U evocomprint -d evocomprint_db &>/dev/null; then
            success "PostgreSQL est prêt ✓"
            return 0
        fi
        echo "Tentative $i/30 - PostgreSQL n'est pas encore prêt..."
        sleep 2
    done
    
    error "PostgreSQL n'a pas démarré dans les temps"
    exit 1
}

# Appliquer les migrations
apply_migrations() {
    log "Application des migrations de base de données..."
    cd "$PROJECT_DIR"
    
    # Exécuter les migrations s'il y en a
    if [ -f "backend/migrations/add_history_and_files_tables.sql" ]; then
        log "Application de la migration des tables d'historique et fichiers..."
        docker-compose exec -T postgres psql -U evocomprint -d evocomprint_db -f /dev/stdin < backend/migrations/add_history_and_files_tables.sql
        success "Migration appliquée ✓"
    fi
    
    # Créer des données de test si nécessaire
    if [ -f "backend/scripts/seed-data.sql" ]; then
        log "Insertion des données de test..."
        docker-compose exec -T postgres psql -U evocomprint -d evocomprint_db -f /dev/stdin < backend/scripts/seed-data.sql
        success "Données de test insérées ✓"
    fi
}

# Construire les images Docker
build_images() {
    log "Construction des images Docker..."
    cd "$PROJECT_DIR"
    
    docker-compose build
    
    success "Images construites ✓"
}

# Démarrer tous les services
start_services() {
    log "Démarrage de tous les services..."
    cd "$PROJECT_DIR"
    
    docker-compose up -d
    
    # Attendre que les services soient prêts
    log "Attente du démarrage des services..."
    sleep 15
    
    success "Services démarrés ✓"
}

# Vérifier que tout fonctionne
verify_services() {
    log "Vérification des services..."
    cd "$PROJECT_DIR"
    
    # Afficher le statut des conteneurs
    docker-compose ps
    
    echo ""
    log "Vérification de l'API backend..."
    
    # Vérifier l'API (avec plusieurs tentatives)
    for i in {1..10}; do
        if curl -f -s http://localhost:5001/api/health > /dev/null; then
            success "✅ API backend accessible sur http://localhost:5001"
            break
        fi
        if [ $i -eq 10 ]; then
            warning "⚠️  API backend non accessible"
        else
            echo "Tentative $i/10 - API non encore accessible..."
            sleep 3
        fi
    done
    
    # Vérifier le frontend
    if curl -f -s http://localhost:3000 > /dev/null; then
        success "✅ Frontend accessible sur http://localhost:3000"
    else
        warning "⚠️  Frontend non accessible"
    fi
    
    echo ""
    success "Services vérifiés ✓"
}

# Afficher les informations finales
show_final_info() {
    echo ""
    echo "🎉 EvocomPrint est maintenant en cours d'exécution !"
    echo "================================================="
    echo ""
    echo "📱 Frontend: http://localhost:3000"
    echo "🔧 API Backend: http://localhost:5001"
    echo "📊 API Health: http://localhost:5001/api/health"
    echo ""
    echo "📋 Comptes par défaut:"
    echo "   Admin: admin@evocomprint.com / admin123"
    echo "   Préparateur: preparateur@evocomprint.com / prep123"
    echo "   Imprimeur Roland: roland@evocomprint.com / roland123"
    echo "   Imprimeur Xerox: xerox@evocomprint.com / xerox123"
    echo "   Livreur: livreur@evocomprint.com / livreur123"
    echo ""
    echo "🛠️  Commandes utiles:"
    echo "   Voir les logs: docker-compose logs -f"
    echo "   Arrêter: docker-compose down"
    echo "   Redémarrer: docker-compose restart"
    echo ""
}

# Fonction principale
main() {
    case ${1:-start} in
        start)
            check_prerequisites
            cleanup
            create_volumes
            build_images
            start_database
            apply_migrations
            start_services
            verify_services
            show_final_info
            ;;
            
        stop)
            log "Arrêt des services..."
            cd "$PROJECT_DIR"
            docker-compose down
            success "Services arrêtés ✓"
            ;;
            
        restart)
            log "Redémarrage des services..."
            cd "$PROJECT_DIR"
            docker-compose restart
            success "Services redémarrés ✓"
            ;;
            
        logs)
            cd "$PROJECT_DIR"
            docker-compose logs -f
            ;;
            
        status)
            cd "$PROJECT_DIR"
            docker-compose ps
            ;;
            
        clean)
            log "Nettoyage complet..."
            cd "$PROJECT_DIR"
            docker-compose down --remove-orphans
            docker volume prune -f
            success "Nettoyage terminé ✓"
            ;;
            
        help)
            echo "Usage: $0 [OPTION]"
            echo ""
            echo "Options:"
            echo "  start     Démarrer l'application (défaut)"
            echo "  stop      Arrêter l'application"
            echo "  restart   Redémarrer l'application"
            echo "  logs      Afficher les logs en continu"
            echo "  status    Afficher le statut des conteneurs"
            echo "  clean     Nettoyage complet (supprime volumes)"
            echo "  help      Afficher cette aide"
            ;;
            
        *)
            error "Option inconnue: $1"
            echo "Utilisez '$0 help' pour voir les options disponibles"
            exit 1
            ;;
    esac
}

# Exécuter la fonction principale
main "$@"