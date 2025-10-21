#!/bin/bash

# Script de déploiement d'urgence - Sans Docker
echo "🚨 DÉPLOIEMENT D'URGENCE - Configuration Render forcée"
echo "======================================================"

echo ""
echo "📁 Structure du projet:"
ls -la | head -10

echo ""
echo "🔧 Configuration Node.js:"
echo "Node: $(node --version 2>/dev/null || echo 'Non installé')"
echo "NPM: $(npm --version 2>/dev/null || echo 'Non installé')"

echo ""
echo "📦 Phase 1: Préparation Backend"
if [ -d "backend" ]; then
    echo "✅ Répertoire backend trouvé"
    cd backend
    
    echo "📦 Installation des dépendances..."
    npm install --production --silent
    
    if [ $? -eq 0 ]; then
        echo "✅ Dépendances installées avec succès"
    else
        echo "❌ Erreur lors de l'installation"
        exit 1
    fi
    
    echo "🔧 Vérification du serveur..."
    if [ -f "server.js" ]; then
        echo "✅ server.js trouvé"
        node -c server.js
        if [ $? -eq 0 ]; then
            echo "✅ Syntaxe JavaScript valide"
        else
            echo "❌ Erreur de syntaxe"
            exit 1
        fi
    else
        echo "❌ server.js non trouvé"
        exit 1
    fi
    
    cd ..
else
    echo "❌ Répertoire backend non trouvé"
    exit 1
fi

echo ""
echo "🌐 Phase 2: Configuration environnement"
export NODE_ENV=production
export PORT=${PORT:-10000}

echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

echo ""
echo "🚀 Phase 3: Démarrage"
echo "Commande: cd backend && node server.js"
echo "✅ Configuration prête pour Render"

if [ "$START_SERVER" = "true" ]; then
    echo "🎯 Démarrage du serveur..."
    cd backend && exec node server.js
else
    echo "💡 Pour démarrer: export START_SERVER=true && ./deploy-urgence.sh"
fi