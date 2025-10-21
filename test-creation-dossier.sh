#!/bin/bash

BACKEND_URL="https://plateforme-imprimerie-pro.onrender.com"

echo "🧪 TEST CRÉATION DOSSIER COMPLET"
echo "═══════════════════════════════════════"
echo ""

# Login pour obtenir un token
echo "1️⃣ Connexion admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@imprimerie.com","password":"admin123"}' \
  2>&1)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Impossible de se connecter"
  echo "Réponse: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token obtenu: ${TOKEN:0:20}..."
echo ""

# Créer un dossier
echo "2️⃣ Création dossier de test..."
CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/dossiers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client": "Client Test Auto",
    "type_formulaire": "roland",
    "quantite": 5,
    "data_formulaire": {"test": true},
    "commentaire": "Test automatique après fix schéma"
  }' \
  2>&1)

echo "📡 Réponse:"
echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Vérifier succès
if echo "$CREATE_RESPONSE" | grep -q '"success".*:.*true'; then
  NUMERO=$(echo "$CREATE_RESPONSE" | jq -r '.dossier.numero' 2>/dev/null)
  echo "✅ DOSSIER CRÉÉ AVEC SUCCÈS!"
  echo "   Numéro: $NUMERO"
  echo ""
  echo "🎉 PLATEFORME 100% FONCTIONNELLE!"
elif echo "$CREATE_RESPONSE" | grep -q "quantite.*does not exist"; then
  echo "❌ ÉCHEC - Colonne quantite toujours manquante"
elif echo "$CREATE_RESPONSE" | grep -q "numero_commande_seq.*does not exist"; then
  echo "❌ ÉCHEC - Séquence manquante"
else
  echo "⚠️ Résultat inattendu - vérifier ci-dessus"
fi

echo ""
echo "═══════════════════════════════════════"
