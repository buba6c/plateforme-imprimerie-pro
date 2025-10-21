#!/usr/bin/env bash
set -euo pipefail

API_URL="http://localhost:5001/api"
ADMIN_EMAIL="admin@imprimerie.local"
ADMIN_PASS="test123"

echo "[E2E] Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "[E2E][ERROR] Login failed: $LOGIN_RESPONSE"
  exit 2
fi
echo "[E2E] Got token"

# Create dossier
echo "[E2E] Creating dossier..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/dossiers" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"client":"E2E Client","type_formulaire":"roland","unite":"cm","hauteur":"10","largeur":"10"}')
if [ $(echo "$CREATE_RESPONSE" | jq -r '.success') != "true" ]; then
  echo "[E2E][ERROR] Create dossier failed: $CREATE_RESPONSE"
  exit 3
fi
DOSSIER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.dossier.id')
echo "[E2E] Dossier created: $DOSSIER_ID"

# Change status to pret_livraison
echo "[E2E] Changing status -> pret_livraison"
PATCH1=$(curl -s -X PATCH "$API_URL/dossiers/$DOSSIER_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"status":"pret_livraison"}')
if [ $(echo "$PATCH1" | jq -r '.success') != "true" ]; then
  echo "[E2E][ERROR] Status change to pret_livraison failed: $PATCH1"
  exit 4
fi
echo "[E2E] Status now: $(echo "$PATCH1" | jq -r '.dossier.statut')"

# Change status to livre (simulate livreur via admin)
echo "[E2E] Changing status -> livre"
PATCH2=$(curl -s -X PATCH "$API_URL/dossiers/$DOSSIER_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"status":"livre"}')
if [ $(echo "$PATCH2" | jq -r '.success') != "true" ]; then
  echo "[E2E][ERROR] Status change to livre failed: $PATCH2"
  exit 5
fi
echo "[E2E] Status now: $(echo "$PATCH2" | jq -r '.dossier.statut')"

# Wait a moment for invoice async work
sleep 0.5

# Check invoices for dossier
echo "[E2E] Checking invoices..."
FACTURES=$(curl -s "$API_URL/factures?dossier_folder_id=$DOSSIER_ID" -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$FACTURES" | jq -r '.factures | length')
if [ "$COUNT" -eq 0 ]; then
  echo "[E2E][ERROR] No invoice found for dossier. Response: $FACTURES"
  exit 6
fi
FACTURE_ID=$(echo "$FACTURES" | jq -r '.factures[0].id')
echo "[E2E] Invoice created: $FACTURE_ID"

echo "[E2E] SUCCESS: dossier=$DOSSIER_ID facture=$FACTURE_ID"
exit 0
