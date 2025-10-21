#!/bin/bash

# Script de lancement de la Plateforme d'Imprimerie avec PM2
# Usage: ./start.sh [start|stop|restart|status|logs]

ACTION=${1:-start}

echo "🚀 Plateforme d'Imprimerie - PM2 Management"
echo "============================================"

#
# Mode DEV local sans PM2 : ./start.sh dev
#
if [ "$ACTION" = "dev" ]; then
  echo "🔧 Lancement DEV local (backend + frontend en parallèle)"
  (cd backend && npm install && npm run dev) &
  (cd frontend && npm install && npm start) &
  wait
  exit 0
fi

case $ACTION in
  start)
    echo "📱 Démarrage de la plateforme..."
    pm2 start pm2.config.js
    echo ""
    echo "✅ Plateforme démarrée!"
    echo "🌐 Frontend: http://localhost:3000"
    echo ""
    echo "📊 Monitoring en temps réel:"
    echo "   pm2 monit"
    echo ""
    echo "📋 Voir les logs:"
    echo "   pm2 logs plateforme-frontend"
    ;;
    
  stop)
    echo "⏹️  Arrêt de la plateforme..."
    pm2 stop pm2.config.js
    pm2 delete pm2.config.js
    echo "✅ Plateforme arrêtée!"
    ;;
    
  restart)
    echo "🔄 Redémarrage de la plateforme..."
    pm2 restart pm2.config.js
    echo "✅ Plateforme redémarrée!"
    ;;
    
  status)
    echo "📊 Status de la plateforme:"
    pm2 status
    ;;
    
  logs)
    echo "📋 Logs de la plateforme (Ctrl+C pour quitter):"
    pm2 logs plateforme-frontend --lines 50
    ;;
    
  monit)
    echo "📊 Monitoring temps réel (Q pour quitter):"
    pm2 monit
    ;;
    
  *)
    echo "Usage: $0 [start|stop|restart|status|logs|monit]"
    echo ""
    echo "Commands:"
    echo "  start   - Démarre la plateforme"
    echo "  stop    - Arrête la plateforme"
    echo "  restart - Redémarre la plateforme"
    echo "  status  - Affiche le status"
    echo "  logs    - Affiche les logs"
    echo "  monit   - Monitoring temps réel"
    ;;
esac