#!/bin/bash

# 🧹 Script de nettoyage des erreurs lint
# Nettoie les console statements et erreurs mineures

echo "🧹 Nettoyage des erreurs lint..."

# Fichiers à nettoyer
FILES=(
  "frontend/src/components/admin/Dashboard.js"
  "frontend/src/components/ImprimeurDashboardUltraModern.js"
  "frontend/src/components/PreparateurDashboardUltraModern.js"
  "frontend/src/components/LivreurDashboardUltraModern.js"
  "frontend/src/components/dossiers/DossierManagement.js"
  "frontend/src/components/PreparateurDashboardRevolutionnaire.js"
  "frontend/src/components/Login.js"
  "frontend/src/hooks/useDossierSync.js"
)

# Backup avant modifications
BACKUP_DIR="ARCHIVE/lint-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Sauvegarde des fichiers dans $BACKUP_DIR..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
  fi
done

echo "✅ Sauvegarde terminée"
echo ""
echo "⚠️  Ce script NE modifie PAS automatiquement les fichiers"
echo "   Les fichiers sauvegardés sont dans: $BACKUP_DIR"
echo ""
echo "📋 Pour corriger les erreurs lint:"
echo "   1. Remplacer console.log/error/warn par notificationService"
echo "   2. Corriger les dépendances React Hooks"
echo "   3. Retirer les imports non utilisés"
echo ""
echo "🔧 Ou exécuter: npm run lint --fix (si configuré)"
