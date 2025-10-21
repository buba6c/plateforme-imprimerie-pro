#!/bin/bash

# Script de build unifié pour Render
echo "🚀 Build Script Unifié pour Render"
echo "📅 $(date)"
echo "📁 PWD: $(pwd)"
echo "📋 Contenu du répertoire:"
ls -la

echo ""
echo "🔧 Informations système:"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "OS: $(uname -s)"

echo ""
echo "📦 Phase 1: Installation Backend"
if [ -d "backend" ]; then
    cd backend
    echo "📍 Dans le répertoire backend: $(pwd)"
    echo "📦 Installation des dépendances backend..."
    npm install --production --silent
    echo "✅ Backend dependencies installées"
    cd ..
else
    echo "❌ Répertoire backend non trouvé"
    exit 1
fi

echo ""
echo "🎨 Phase 2: Build Frontend (optionnel)"
if [ -d "frontend" ]; then
    cd frontend
    echo "📍 Dans le répertoire frontend: $(pwd)"
    if [ "$BUILD_FRONTEND" = "true" ]; then
        echo "📦 Installation des dépendances frontend..."
        npm install --silent
        echo "🏗️ Build du frontend..."
        npm run build
        echo "✅ Frontend build terminé"
    else
        echo "⏭️ Build frontend ignoré (BUILD_FRONTEND != true)"
    fi
    cd ..
else
    echo "⚠️ Répertoire frontend non trouvé"
fi

echo ""
echo "✅ Build terminé avec succès!"
echo "🎯 Prêt pour le démarrage du serveur"