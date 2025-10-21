#!/bin/bash

# Script de gestion de la Plateforme Imprimerie
# Usage: ./manage.sh [start|stop|restart|status|logs]

PROJECT_DIR="/Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

case "$1" in
  start)
    echo "🚀 Démarrage des services..."
    
    # Démarrer le backend avec PM2
    echo "📡 Démarrage du backend..."
    cd "$BACKEND_DIR" && pm2 start ecosystem.dev.config.js
    
    # Démarrer le frontend en arrière-plan
    echo "🌐 Démarrage du frontend..."
    cd "$FRONTEND_DIR" && PORT=3001 npm start > /tmp/frontend.log 2>&1 &
    
    echo "✅ Services démarrés !"
    echo "   Backend:  http://localhost:5001"
    echo "   Frontend: http://localhost:3001"
    ;;
    
  stop)
    echo "🛑 Arrêt des services..."
    
    # Arrêter PM2
    pm2 stop all
    
    # Arrêter le frontend
    pkill -f "node.*react-scripts"
    
    echo "✅ Services arrêtés !"
    ;;
    
  restart)
    echo "🔄 Redémarrage des services..."
    $0 stop
    sleep 3
    $0 start
    ;;
    
  status)
    echo "📊 État des services:"
    echo ""
    echo "Backend (PM2):"
    pm2 list
    echo ""
    echo "Ports utilisés:"
    lsof -i :3001 -i :5001 2>/dev/null | grep LISTEN || echo "Aucun service détecté"
    ;;
    
  logs)
    case "$2" in
      backend)
        pm2 logs imprimerie-backend-dev
        ;;
      frontend)
        tail -f /tmp/frontend.log
        ;;
      *)
        echo "Usage: $0 logs [backend|frontend]"
        ;;
    esac
    ;;
    
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Commandes:"
    echo "  start    - Démarre backend et frontend"
    echo "  stop     - Arrête tous les services"
    echo "  restart  - Redémarre tous les services"
    echo "  status   - Affiche l'état des services"
    echo "  logs     - Affiche les logs (backend|frontend)"
    exit 1
    ;;
esac
