#!/bin/bash

# Test rapide du backend avant déploiement
echo "🧪 Test Backend - Vérification avant déploiement"
echo "================================================"

echo ""
echo "📁 Vérification de la structure..."
if [ ! -d "backend" ]; then
    echo "❌ Répertoire backend manquant"
    exit 1
fi

if [ ! -f "backend/server.js" ]; then
    echo "❌ Fichier server.js manquant"
    exit 1
fi

if [ ! -f "backend/package.json" ]; then
    echo "❌ Fichier package.json manquant"
    exit 1
fi

echo "✅ Structure OK"

echo ""
echo "📦 Test installation des dépendances..."
cd backend
npm install --silent

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
fi

echo "✅ Dépendances installées"

echo ""
echo "🔧 Test de syntaxe JavaScript..."
node -c server.js

if [ $? -ne 0 ]; then
    echo "❌ Erreur de syntaxe dans server.js"
    exit 1
fi

echo "✅ Syntaxe OK"

echo ""
echo "🚀 Test de démarrage (5 secondes)..."
timeout 5s node server.js &
PID=$!
sleep 2

if ps -p $PID > /dev/null; then
    echo "✅ Serveur démarre correctement"
    kill $PID 2>/dev/null
else
    echo "❌ Erreur de démarrage du serveur"
    exit 1
fi

echo ""
echo "🎉 TOUS LES TESTS PASSENT !"
echo "✅ Backend prêt pour le déploiement"
echo ""
echo "📋 Informations pour Render :"
echo "   Build Command: cd backend && npm install"
echo "   Start Command: cd backend && node server.js"
echo "   Port: 10000 (ou PORT env variable)"

cd ..