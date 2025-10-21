#!/bin/bash

# Script d'urgence pour forcer la correction du schéma via endpoint admin
# Utilise l'endpoint POST /api/admin/fix-schema

BACKEND_URL="https://plateforme-imprimerie-pro.onrender.com"

echo "═══════════════════════════════════════"
echo "🚨 FIX SCHÉMA MANUEL D'URGENCE"
echo "═══════════════════════════════════════"
echo ""

echo "1️⃣ Appel de l'endpoint /api/admin/fix-schema..."
echo ""

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/admin/fix-schema" \
  -H "Content-Type: application/json" \
  2>&1)

echo "📡 Réponse serveur:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Vérifier le résultat
if echo "$RESPONSE" | grep -q "success.*true"; then
  echo "✅ FIX RÉUSSI!"
elif echo "$RESPONSE" | grep -q "success.*false"; then
  echo "❌ FIX ÉCHOUÉ - Voir erreur ci-dessus"
else
  echo "⚠️ Réponse inattendue"
fi

echo ""
echo "═══════════════════════════════════════"
echo "2️⃣ Vérification post-fix..."
echo ""

# Test de création de dossier (sans auth - juste pour voir l'erreur)
echo "Test POST /api/dossiers (doit échouer avec 401 ou 201, PAS 500):"
TEST_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/dossiers" \
  -H "Content-Type: application/json" \
  -d '{"client":"Test","type_formulaire":"roland","quantite":1}' \
  2>&1)

if echo "$TEST_RESPONSE" | grep -q "quantite.*does not exist"; then
  echo "❌ SCHÉMA TOUJOURS INCORRECT - Colonne quantite manquante"
elif echo "$TEST_RESPONSE" | grep -q "401\|403\|Token"; then
  echo "✅ SCHÉMA CORRECT - Erreur auth (normal sans token)"
elif echo "$TEST_RESPONSE" | grep -q "success.*true"; then
  echo "✅ SCHÉMA CORRECT - Dossier créé!"
else
  echo "⚠️ Réponse: $TEST_RESPONSE"
fi

echo ""
echo "═══════════════════════════════════════"
echo "✅ Script terminé"
echo "═══════════════════════════════════════"
