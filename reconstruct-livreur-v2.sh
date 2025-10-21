#!/bin/bash

# Script de reconstruction de LivreurDashboardV2.js
# Nettoie les caractères échappés et reconstruit proprement

SOURCE="/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/frontend/src/components/livreur/v2/dashboard/LivreurDashboardV2.js.disabled"
TARGET="/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/frontend/src/components/livreur/v2/dashboard/LivreurDashboardV2.js"
BACKUP="/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/frontend/src/components/livreur/v2/dashboard/LivreurDashboardV2.js.disabled.backup"

echo "🔧 RECONSTRUCTION DE LivreurDashboardV2.js"
echo "=========================================="
echo ""

# Créer backup du .disabled
echo "📦 Création backup..."
cp "$SOURCE" "$BACKUP"
echo "✅ Backup créé: $BACKUP"
echo ""

# Nettoyer les caractères échappés
echo "🧹 Nettoyage des caractères échappés..."
cat "$SOURCE" | \
  perl -pe 's/\\\"/"/g' | \
  perl -pe "s/\\\\'/'/g" | \
  perl -pe 's/\\\\n/\n/g' \
  > "$TARGET"

echo "✅ Fichier nettoyé: $TARGET"
echo ""

# Vérifier le résultat
echo "📊 VÉRIFICATION"
echo "---------------"
ESCAPED_COUNT=$(grep -o "\\\\\\\\" "$TARGET" 2>/dev/null | wc -l | tr -d ' ')
echo "Caractères échappés restants: $ESCAPED_COUNT"

if [ "$ESCAPED_COUNT" -eq "0" ]; then
  echo "✅ Nettoyage réussi !"
else
  echo "⚠️  Il reste des caractères échappés"
fi

echo ""
echo "📈 STATISTIQUES"
echo "---------------"
wc -l "$SOURCE" "$TARGET"

echo ""
echo "✅ RECONSTRUCTION TERMINÉE"
