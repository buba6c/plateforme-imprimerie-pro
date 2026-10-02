#!/bin/bash

# Script pour préparer le téléchargement optimisé du projet
# Ce script crée une archive compressée sans les fichiers lourds inutiles

echo "📦 Préparation du projet pour téléchargement..."
echo ""

cd /var/www

# Nom de l'archive avec date
ARCHIVE_NAME="imprimerie-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "✅ Création de l'archive: $ARCHIVE_NAME"
echo "⏳ Compression en cours (cela peut prendre 1-2 minutes)..."
echo ""

# Créer l'archive en excluant les gros dossiers
tar -czf "$ARCHIVE_NAME" \
  --exclude='imprimerie/node_modules' \
  --exclude='imprimerie/frontend/node_modules' \
  --exclude='imprimerie/backend/node_modules' \
  --exclude='imprimerie/uploads' \
  --exclude='imprimerie/.git' \
  --exclude='imprimerie/dist' \
  --exclude='imprimerie/build' \
  --exclude='imprimerie/.cache' \
  --exclude='imprimerie/*.log' \
  --exclude='imprimerie/.env' \
  --exclude='imprimerie/.DS_Store' \
  imprimerie/

# Vérifier si l'archive a été créée
if [ -f "$ARCHIVE_NAME" ]; then
    echo "✅ Archive créée avec succès!"
    echo ""
    echo "📊 Informations:"
    ls -lh "$ARCHIVE_NAME"
    echo ""
    echo "📥 Pour télécharger sur votre Mac, exécutez cette commande:"
    echo ""
    echo "   scp root@72.61.145.37:/var/www/$ARCHIVE_NAME ~/Downloads/"
    echo ""
    echo "📂 Puis décompressez:"
    echo ""
    echo "   cd ~/Downloads"
    echo "   tar -xzf $ARCHIVE_NAME"
    echo "   cd imprimerie"
    echo "   cd frontend && npm install"
    echo "   cd ../backend && npm install"
    echo ""
    echo "🗑️  Pour supprimer l'archive après téléchargement:"
    echo ""
    echo "   rm /var/www/$ARCHIVE_NAME"
    echo ""
else
    echo "❌ Erreur lors de la création de l'archive"
    exit 1
fi
