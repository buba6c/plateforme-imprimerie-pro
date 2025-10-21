#!/bin/bash

# Script de démarrage simplifié pour Render
# Ce script s'assure que toutes les dépendances sont correctement installées

echo "🚀 Démarrage de la plateforme d'imprimerie..."
echo "📍 Répertoire de travail: $(pwd)"
echo "📁 Contenu du répertoire:"
ls -la

echo ""
echo "🔧 Configuration Node.js..."
echo "Version Node: $(node --version)"
echo "Version NPM: $(npm --version)"

echo ""
echo "📦 Installation des dépendances backend..."
cd backend
npm install --only=production

echo ""
echo "🗄️ Vérification de la base de données..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL non définie, utilisation de SQLite par défaut"
    export DATABASE_URL="sqlite:./database/imprimerie.db"
fi

echo "🔐 Configuration JWT..."
if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  JWT_SECRET non définie, génération automatique"
    export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
fi

echo ""
echo "🌐 Configuration serveur..."
export PORT=${PORT:-10000}
export NODE_ENV=${NODE_ENV:-production}

echo "✅ Configuration terminée"
echo "🎯 Démarrage du serveur sur le port $PORT..."

# Démarrer le serveur
exec node server.js