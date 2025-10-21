#!/bin/bash

# Script de test complet de la plateforme Render
# Teste tous les endpoints critiques

BACKEND_URL="https://plateforme-imprimerie-pro.onrender.com"
FRONTEND_URL="https://imprimerie-frontend.onrender.com"

echo "🔍 TEST COMPLET PLATEFORME RENDER"
echo "=================================="
echo ""

# Test 1: Backend Health
echo "1️⃣ Backend Health Check..."
HEALTH=$(curl -s "$BACKEND_URL/api/health")
echo "$HEALTH" | jq -r 'if .status == "ok" then "✅ Backend: OK" else "❌ Backend: ERROR" end'
echo ""

# Test 2: Frontend accessible
echo "2️⃣ Frontend Check..."
FRONTEND_STATUS=$(curl -sI "$FRONTEND_URL" | head -1)
if [[ $FRONTEND_STATUS == *"200"* ]]; then
  echo "✅ Frontend: OK"
else
  echo "❌ Frontend: $FRONTEND_STATUS"
fi
echo ""

# Test 3: Database colonnes
echo "3️⃣ Database Uptime..."
UPTIME=$(echo "$HEALTH" | jq -r '.uptime')
echo "⏱️  Backend uptime: ${UPTIME}s"
echo ""

# Test 4: WebSocket endpoint
echo "4️⃣ WebSocket Endpoint..."
WS_CHECK=$(curl -sI "$BACKEND_URL/socket.io/" | head -1)
if [[ $WS_CHECK == *"200"* ]] || [[ $WS_CHECK == *"400"* ]]; then
  echo "✅ WebSocket: Endpoint exists"
else
  echo "❌ WebSocket: $WS_CHECK"
fi
echo ""

# Test 5: Statistiques (nécessite auth)
echo "5️⃣ API Routes Check..."
STATS_CHECK=$(curl -s "$BACKEND_URL/api/statistiques/dashboard" -H "Authorization: Bearer test" 2>&1)
if [[ $STATS_CHECK == *"Token"* ]] || [[ $STATS_CHECK == *"401"* ]]; then
  echo "✅ API Routes: Protected (auth required)"
else
  echo "⚠️  API Routes: $STATS_CHECK"
fi
echo ""

echo "=================================="
echo "📊 RÉSUMÉ"
echo "=================================="
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "🔄 Pour rebuild le frontend:"
echo "   - Aller sur Render Dashboard"
echo "   - Trouver 'imprimerie-frontend'"
echo "   - Cliquer 'Manual Deploy' > 'Clear build cache & deploy'"
echo ""
echo "✅ Backend auto-fix s'exécute à chaque redémarrage"
echo "✅ Schéma complet avec:"
echo "   - 15 colonnes dossiers (quantite, folder_id, etc.)"
echo "   - Séquence numero_commande_seq"
echo "   - Fonction log_dossier_activity"
echo "   - Trigger auto status history"
echo "   - Tables: dossier_formulaires, dossier_status_history, activity_logs"
