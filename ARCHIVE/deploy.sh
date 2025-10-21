#!/bin/bash

# ========================================================
# Script de déploiement EvocomPrint Production
# Domaine: https://imprimerie.vps.webdock.cloud/
# ========================================================

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="imprimerie.vps.webdock.cloud"
EMAIL="admin@imprimerie.vps.webdock.cloud"
PROJECT_DIR="/var/www/evocomprint"

# Fonctions d'affichage
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
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        error "Docker n'est pas installé"
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose n'est pas installé"
    fi
    
    # Vérifier les permissions
    if [ "$EUID" -ne 0 ]; then
        warning "Ce script doit être exécuté en tant que root pour configurer les certificats SSL"
        log "Exécutez: sudo ./deploy.sh"
        exit 1
    fi
    
    success "Prérequis validés"
}

# Créer la structure des dossiers
setup_directories() {
    log "Création de la structure des dossiers..."
    
    mkdir -p $PROJECT_DIR
    mkdir -p /var/log/evocomprint
    mkdir -p /etc/letsencrypt
    mkdir -p /var/www/certbot
    
    success "Structure des dossiers créée"
}

# Copier les fichiers du projet
deploy_files() {
    log "Déploiement des fichiers..."
    
    # Copier tous les fichiers du projet
    cp -r ./* $PROJECT_DIR/
    
    # Copier le fichier d'environnement de production
    cp .env.prod $PROJECT_DIR/.env
    
    # Définir les permissions
    chown -R www-data:www-data $PROJECT_DIR
    chmod -R 755 $PROJECT_DIR
    
    success "Fichiers déployés"
}

# Configuration initiale SSL avec Let's Encrypt
setup_ssl() {
    log "Configuration des certificats SSL..."
    
    # Démarrer Nginx temporairement pour la validation Let's Encrypt
    cd $PROJECT_DIR
    
    # Créer un nginx temporaire pour l'ACME challenge
    docker-compose -f docker-compose.prod.yml up -d nginx
    
    # Attendre que Nginx soit prêt
    sleep 10
    
    # Générer les certificats SSL
    docker-compose -f docker-compose.prod.yml run --rm certbot
    
    # Redémarrer nginx avec SSL
    docker-compose -f docker-compose.prod.yml restart nginx
    
    success "Certificats SSL configurés"
}

# Initialiser la base de données
init_database() {
    log "Initialisation de la base de données..."
    
    cd $PROJECT_DIR
    
    # Démarrer PostgreSQL
    docker-compose -f docker-compose.prod.yml up -d postgres
    
    # Attendre que PostgreSQL soit prêt
    sleep 30
    
    # Vérifier la connexion à la base de données
    docker-compose -f docker-compose.prod.yml exec postgres psql -U imprimerie_user -d imprimerie_db -c "SELECT version();" || {
        warning "Échec de la connexion à la base de données, nouvelle tentative..."
        sleep 10
        docker-compose -f docker-compose.prod.yml exec postgres psql -U imprimerie_user -d imprimerie_db -c "SELECT version();"
    }
    
    success "Base de données initialisée"
}

# Construire et démarrer tous les services
start_services() {
    log "Construction et démarrage des services..."
    
    cd $PROJECT_DIR
    
    # Construire les images
    docker-compose -f docker-compose.prod.yml build
    
    # Démarrer tous les services
    docker-compose -f docker-compose.prod.yml up -d
    
    # Attendre que tous les services soient prêts
    log "Attente du démarrage des services..."
    sleep 60
    
    success "Services démarrés"
}

# Vérifier le déploiement
verify_deployment() {
    log "Vérification du déploiement..."
    
    cd $PROJECT_DIR
    
    # Vérifier les conteneurs
    docker-compose -f docker-compose.prod.yml ps
    
    # Vérifier l'API backend
    if curl -f -s http://localhost:5001/api/health > /dev/null; then
        success "✅ Backend accessible"
    else
        warning "⚠️  Backend non accessible"
    fi
    
    # Vérifier HTTPS
    if curl -f -s https://$DOMAIN/health > /dev/null; then
        success "✅ HTTPS fonctionnel"
    else
        warning "⚠️  HTTPS non accessible"
    fi
    
    # Afficher les logs récents
    log "Logs récents des services:"
    docker-compose -f docker-compose.prod.yml logs --tail=10
}

# Configuration du cron pour le renouvellement SSL
setup_ssl_renewal() {
    log "Configuration du renouvellement automatique SSL..."
    
    # Créer le script de renouvellement
    cat > /usr/local/bin/renew-ssl.sh << 'EOF'
#!/bin/bash
cd /var/www/evocomprint
docker-compose -f docker-compose.prod.yml run --rm certbot renew --webroot --webroot-path=/var/www/certbot
docker-compose -f docker-compose.prod.yml restart nginx
EOF
    
    chmod +x /usr/local/bin/renew-ssl.sh
    
    # Ajouter au cron (tous les 12h)
    echo "0 */12 * * * /usr/local/bin/renew-ssl.sh >> /var/log/evocomprint/ssl-renewal.log 2>&1" | crontab -
    
    success "Renouvellement SSL automatique configuré"
}

# Créer un script de monitoring
create_monitoring() {
    log "Création des scripts de monitoring..."
    
    cat > /usr/local/bin/evocomprint-status.sh << 'EOF'
#!/bin/bash

echo "=== STATUS EVOCOMPRINT ==="
echo "Date: $(date)"
echo ""

cd /var/www/evocomprint

echo "--- Services Docker ---"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "--- API Health Check ---"
curl -s http://localhost:5001/api/health | jq . || echo "API non accessible"

echo ""
echo "--- Certificats SSL ---"
openssl x509 -in /etc/letsencrypt/live/imprimerie.vps.webdock.cloud/fullchain.pem -text -noout | grep -A2 "Not After" || echo "Certificat non trouvé"

echo ""
echo "--- Logs récents (dernières 5 lignes) ---"
docker-compose -f docker-compose.prod.yml logs --tail=5
EOF
    
    chmod +x /usr/local/bin/evocomprint-status.sh
    
    success "Script de monitoring créé (/usr/local/bin/evocomprint-status.sh)"
}

# Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  install     Installation complète (défaut)"
    echo "  update      Mise à jour des services"
    echo "  restart     Redémarrage des services"
    echo "  status      Afficher le statut"
    echo "  logs        Afficher les logs"
    echo "  backup      Sauvegarder la base de données"
    echo "  help        Afficher cette aide"
}

# Fonction principale
main() {
    echo ""
    echo "========================================================"
    echo "🚀 DÉPLOIEMENT EVOCOMPRINT PRODUCTION"
    echo "========================================================"
    echo "Domaine: https://$DOMAIN"
    echo "Email: $EMAIL"
    echo "========================================================"
    echo ""

    case ${1:-install} in
        install)
            check_prerequisites
            setup_directories
            deploy_files
            init_database
            start_services
            setup_ssl
            verify_deployment
            setup_ssl_renewal
            create_monitoring
            
            echo ""
            success "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"
            echo ""
            echo "✅ Accès: https://$DOMAIN"
            echo "✅ API: https://$DOMAIN/api/health"
            echo "✅ Monitoring: /usr/local/bin/evocomprint-status.sh"
            echo ""
            echo "📋 Comptes par défaut:"
            echo "   Admin: admin@evocomprint.com / admin123"
            echo "   Préparateur: preparateur@evocomprint.com / prep123"
            echo "   etc..."
            echo ""
            ;;
            
        update)
            log "Mise à jour des services..."
            cd $PROJECT_DIR
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml build
            docker-compose -f docker-compose.prod.yml up -d
            success "Services mis à jour"
            ;;
            
        restart)
            log "Redémarrage des services..."
            cd $PROJECT_DIR
            docker-compose -f docker-compose.prod.yml restart
            success "Services redémarrés"
            ;;
            
        status)
            /usr/local/bin/evocomprint-status.sh
            ;;
            
        logs)
            cd $PROJECT_DIR
            docker-compose -f docker-compose.prod.yml logs -f
            ;;
            
        backup)
            log "Sauvegarde de la base de données..."
            cd $PROJECT_DIR
            ./scripts/backup-db.sh
            ;;
            
        help)
            show_help
            ;;
            
        *)
            error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
}

# Gestion des signaux
trap 'error "Script interrompu par l'\''utilisateur"' INT TERM

# Exécuter la fonction principale
main "$@"