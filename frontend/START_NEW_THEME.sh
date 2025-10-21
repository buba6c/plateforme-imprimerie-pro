#!/bin/bash

# 🎨 Script de démarrage avec le nouveau système de thème

echo ""
echo "🎨 ═══════════════════════════════════════════════════════"
echo "   DÉMARRAGE AVEC LE NOUVEAU SYSTÈME DE THÈME"
echo "   ═══════════════════════════════════════════════════════"
echo ""

# Nettoyage du cache
echo "🧹 Nettoyage du cache..."
rm -rf node_modules/.cache
rm -rf .parcel-cache
echo "✅ Cache nettoyé"
echo ""

# Démarrage
echo "🚀 Démarrage du serveur..."
echo ""
echo "Une fois démarré, ouvrez votre navigateur et testez :"
echo ""
echo "  • Console (F12) → Tapez :"
echo "    document.documentElement.setAttribute('data-theme', 'dark')"
echo ""
echo "  • Pour revenir en clair :"
echo "    document.documentElement.setAttribute('data-theme', 'light')"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""

npm start
