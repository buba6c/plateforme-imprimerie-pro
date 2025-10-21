#!/bin/bash

# Script d'analyse des corruptions dans DossierDetailsFixed.js.disabled

FILE_DISABLED="frontend/src/components/dossiers/DossierDetailsFixed.js.disabled"
FILE_BACKUP="frontend/src/components/dossiers/DossierDetailsFixed.js.backup-20251015_213648"

echo "======================================"
echo "ANALYSE DossierDetailsFixed.js.disabled"
echo "======================================"
echo ""

echo "📊 STATISTIQUES"
echo "----------------"
wc -l "$FILE_DISABLED" "$FILE_BACKUP"
echo ""

echo "🔍 IMPORTS MANQUANTS"
echo "--------------------"
echo "Dans le backup (PROPRE) :"
grep "^import" "$FILE_BACKUP" | head -15
echo ""
echo "Dans le .disabled (CORROMPU) :"
grep "^import" "$FILE_DISABLED" | head -15
echo ""

echo "❌ DIFFÉRENCES D'IMPORTS"
echo "------------------------"
diff <(grep "^import" "$FILE_BACKUP" | sort) <(grep "^import" "$FILE_DISABLED" | sort) || true
echo ""

echo "🐛 CODE DUPLIQUÉ - getStatusBadge"
echo "----------------------------------"
grep -n "const getStatusBadge" "$FILE_DISABLED"
echo ""

echo "🔴 LIGNES ORPHELINES (172-175)"
echo "-------------------------------"
sed -n '170,176p' "$FILE_DISABLED"
echo ""

echo "🔍 STRUCTURE DU COMPOSANT"
echo "-------------------------"
echo "Backup (PROPRE) :"
grep -n "^export default\|^const DossierDetails\|^export default function" "$FILE_BACKUP"
echo ""
echo ".disabled (CORROMPU) :"
grep -n "^export default\|^const DossierDetails\|^const.*=.*({" "$FILE_DISABLED" | head -3
echo ""

echo "✅ ANALYSE TERMINÉE"
