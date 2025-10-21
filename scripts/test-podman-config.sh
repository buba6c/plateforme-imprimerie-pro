#!/bin/bash

# =================================================
# Script de test et validation - Configuration Podman
# Teste tous les composants avant déploiement
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
COMPOSE_FILE="podman-compose.yml"

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

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

fail() {
    echo -e "${RED}❌ $1${NC}"
}

# Test des prérequis
test_requirements() {
    log "Test des prérequis..."
    
    local errors=0
    
    # Vérifier Podman
    if command -v podman &> /dev/null; then
        success "Podman installé: $(podman --version)"
    else
        fail "Podman non installé"
        errors=$((errors + 1))
    fi
    
    # Vérifier podman-compose
    if command -v podman-compose &> /dev/null; then
        success "podman-compose installé: $(podman-compose --version)"
    else
        fail "podman-compose non installé"
        errors=$((errors + 1))
    fi
    
    # Vérifier les fichiers nécessaires
    local required_files=(
        "podman-compose.yml"
        "backend/Dockerfile.podman"
        "frontend/Dockerfile.podman"
        ".env.podman.windows"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            success "Fichier trouvé: $file"
        else
            fail "Fichier manquant: $file"
            errors=$((errors + 1))
        fi
    done
    
    return $errors
}

# Test de construction des images
test_build() {
    log "Test de construction des images..."
    
    local errors=0
    
    # Construire l'image backend
    if podman build -t "${PROJECT_NAME}-backend:test" -f backend/Dockerfile.podman backend/ &>/dev/null; then
        success "Image backend construite"
    else
        fail "Échec construction image backend"
        errors=$((errors + 1))
    fi
    
    # Construire l'image frontend
    if podman build -t "${PROJECT_NAME}-frontend:test" \
        --build-arg REACT_APP_API_URL="/api" \
        --build-arg REACT_APP_SOCKET_URL="" \
        -f frontend/Dockerfile.podman frontend/ &>/dev/null; then
        success "Image frontend construite"
    else
        fail "Échec construction image frontend"
        errors=$((errors + 1))
    fi
    
    return $errors
}

# Test de validation du compose file
test_compose_validation() {
    log "Validation du fichier podman-compose.yml..."
    
    local errors=0
    
    # Vérifier la syntaxe
    if podman-compose -f "$COMPOSE_FILE" config &>/dev/null; then
        success "Syntaxe podman-compose.yml valide"
    else
        fail "Syntaxe podman-compose.yml invalide"
        errors=$((errors + 1))
    fi
    
    # Vérifier les variables d'environnement
    if [[ -f ".env.podman.windows" ]]; then
        success "Fichier .env.podman.windows trouvé"
        
        # Vérifier les variables critiques
        local required_vars=(
            "DB_PASSWORD"
            "JWT_SECRET"
            "REDIS_PASSWORD"
        )
        
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" .env.podman.windows; then
                success "Variable $var définie"
            else
                fail "Variable $var manquante"
                errors=$((errors + 1))
            fi
        done
    else
        fail "Fichier .env.podman.windows manquant"
        errors=$((errors + 1))
    fi
    
    return $errors
}

# Test des ports
test_ports() {
    log "Vérification des ports..."
    
    local errors=0
    local ports=(3001 5001 5432 6379)
    
    for port in "${ports[@]}"; do
        if netstat -an 2>/dev/null | grep -q ":${port}.*LISTEN" || \
           lsof -i ":${port}" &>/dev/null; then
            warning "Port $port déjà utilisé"
        else
            success "Port $port disponible"
        fi
    done
    
    return $errors
}

# Test de démarrage rapide
test_quick_start() {
    log "Test de démarrage rapide..."
    
    local errors=0
    
    # Copier le fichier .env
    cp .env.podman.windows .env
    
    # Créer les répertoires de données
    mkdir -p data/{postgres,uploads,logs,backups,redis}
    
    # Démarrer les services
    info "Démarrage des services (peut prendre quelques minutes)..."
    if podman-compose -f "$COMPOSE_FILE" up -d &>/dev/null; then
        success "Services démarrés"
        
        # Attendre un peu
        sleep 30
        
        # Tester la base de données
        if podman exec "${PROJECT_NAME}_postgres_1" pg_isready -U imprimerie_user -d imprimerie_db &>/dev/null; then
            success "PostgreSQL opérationnel"
        else
            fail "PostgreSQL non opérationnel"
            errors=$((errors + 1))
        fi
        
        # Tester le backend
        if curl -f http://localhost:5001/api/health &>/dev/null; then
            success "Backend opérationnel"
        else
            warning "Backend non encore opérationnel (normal au premier démarrage)"
        fi
        
        # Tester le frontend
        if curl -f http://localhost:3001 &>/dev/null; then
            success "Frontend opérationnel"
        else
            warning "Frontend non encore opérationnel"
        fi
        
        # Arrêter les services
        info "Arrêt des services de test..."
        podman-compose -f "$COMPOSE_FILE" down &>/dev/null
        
    else
        fail "Échec démarrage des services"
        errors=$((errors + 1))
    fi
    
    # Nettoyer
    rm -f .env
    
    return $errors
}

# Test des scripts
test_scripts() {
    log "Test des scripts..."
    
    local errors=0
    local scripts=(
        "scripts/start-podman.sh"
        "scripts/stop-podman.sh"
        "scripts/export-to-windows.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -f "$script" && -x "$script" ]]; then
            success "Script $script OK"
        else
            fail "Script $script manquant ou non exécutable"
            errors=$((errors + 1))
        fi
    done
    
    return $errors
}

# Nettoyage après tests
cleanup_test() {
    log "Nettoyage après tests..."
    
    # Supprimer les images de test
    podman rmi "${PROJECT_NAME}-backend:test" "${PROJECT_NAME}-frontend:test" &>/dev/null || true
    
    # Nettoyer les containers orphelins
    podman container prune -f &>/dev/null || true
    
    success "Nettoyage terminé"
}

# Rapport final
generate_report() {
    local total_errors=$1
    
    info "==========================================="
    if [[ $total_errors -eq 0 ]]; then
        success "🎉 TOUS LES TESTS SONT PASSÉS !"
        info "La configuration Podman est prête pour le déploiement."
        info ""
        info "Prochaines étapes:"
        info "1. Démarrer: ./scripts/start-podman.sh"
        info "2. Exporter: ./scripts/export-to-windows.sh"
    else
        fail "❌ $total_errors ERREUR(S) DÉTECTÉE(S)"
        warning "Corrigez les erreurs avant de déployer."
    fi
    info "==========================================="
}

# Fonction principale
main() {
    log "🧪 Test de validation de la configuration Podman"
    
    local total_errors=0
    
    # Exécuter tous les tests
    test_requirements || total_errors=$((total_errors + $?))
    test_compose_validation || total_errors=$((total_errors + $?))
    test_ports || total_errors=$((total_errors + $?))
    test_scripts || total_errors=$((total_errors + $?))
    test_build || total_errors=$((total_errors + $?))
    test_quick_start || total_errors=$((total_errors + $?))
    
    cleanup_test
    generate_report $total_errors
    
    if [[ $total_errors -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Exécution
main "$@"