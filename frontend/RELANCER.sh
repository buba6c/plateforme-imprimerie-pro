#!/bin/bash

echo "🔄 Nettoyage du cache..."
rm -rf node_modules/.cache build 2>/dev/null

echo "🚀 Relancement du serveur..."
echo ""
echo "⚠️  IMPORTANT - Pour voir les modifications :"
echo "1. Une fois le serveur démarré, allez dans votre navigateur"
echo "2. Appuyez sur Cmd+Shift+R (Mac) ou Ctrl+Shift+F5 (Windows)"
echo "3. Cela va VIDER LE CACHE et recharger complètement"
echo ""
echo "📍 Ensuite, allez dans : Paramètres → Personnalisation"
echo ""

PORT=3001 npm start
