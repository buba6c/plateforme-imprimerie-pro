#!/bin/bash

echo "🧪 TESTS DE VÉRIFICATION FINALE"
echo "==============================="
echo ""

# Test 1: Vérification des services
echo "1️⃣ Vérification des services PM2..."
pm2 status
echo ""

# Test 2: Test santé du backend
echo "2️⃣ Test santé du backend..."
HEALTH_RESPONSE=$(curl -s http://localhost:5001/api/health)
if echo "$HEALTH_RESPONSE" | jq -e '.status' >/dev/null 2>&1; then
    echo "✅ Backend fonctionnel"
    echo "   Status: $(echo "$HEALTH_RESPONSE" | jq -r .status)"
else
    echo "❌ Backend non fonctionnel"
    echo "   Réponse: $HEALTH_RESPONSE"
fi
echo ""

# Test 3: Test frontend
echo "3️⃣ Test accès frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo "✅ Frontend accessible sur http://localhost:3001"
else
    echo "❌ Frontend non accessible (HTTP $FRONTEND_RESPONSE)"
fi
echo ""

# Test 4: Test authentification API
echo "4️⃣ Test authentification API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "preparateur@imprimerie.local", "password": "admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token 2>/dev/null)
if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
    echo "✅ Authentification API fonctionnelle"
    USER_ROLE=$(echo "$LOGIN_RESPONSE" | jq -r .user.role)
    echo "   Utilisateur connecté: $USER_ROLE"
else
    echo "❌ Authentification API échoue"
    echo "   Réponse: $(echo "$LOGIN_RESPONSE" | head -100)"
fi
echo ""

# Test 5: Test accès dossiers avec token
if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "5️⃣ Test accès dossiers avec token..."
    DOSSIERS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:5001/api/dossiers)
    
    if echo "$DOSSIERS_RESPONSE" | jq -e '.dossiers' >/dev/null 2>&1; then
        COUNT=$(echo "$DOSSIERS_RESPONSE" | jq -r '.dossiers | length')
        echo "✅ Accès dossiers fonctionnel"
        echo "   Dossiers visibles: $COUNT"
        echo "   Premiers dossiers:"
        echo "$DOSSIERS_RESPONSE" | jq -r '.dossiers[0:3][] | "     - \(.numero // "N/A") (\(.statut), \(.type_formulaire))"' 2>/dev/null
    else
        echo "❌ Accès dossiers échoue"
        echo "   Réponse: $(echo "$DOSSIERS_RESPONSE" | head -200)"
    fi
else
    echo "5️⃣ ⏭️ Test accès dossiers ignoré (pas de token)"
fi
echo ""

# Test 6: Vérification logs récents
echo "6️⃣ Vérification logs récents (erreurs 404)..."
RECENT_LOGS=$(pm2 logs --lines 10 --nostream 2>/dev/null | grep -i "404\|error\|failed")
if [ -z "$RECENT_LOGS" ]; then
    echo "✅ Aucune erreur 404 récente"
else
    echo "⚠️ Erreurs trouvées dans les logs:"
    echo "$RECENT_LOGS" | head -5
fi
echo ""

# Résumé final
echo "🎯 RÉSUMÉ FINAL"
echo "==============="
echo ""
echo "🌐 Pour utiliser l'interface:"
echo "   1. Ouvrir http://localhost:3001"
echo "   2. Se connecter avec un des comptes:"
echo "      - admin@imprimerie.local / admin123"
echo "      - preparateur@imprimerie.local / admin123"
echo "      - roland@imprimerie.local / admin123"
echo "      - xerox@imprimerie.local / admin123"
echo "      - livreur@imprimerie.local / admin123"
echo ""
echo "✅ Si tous les tests ci-dessus sont verts:"
echo "   → L'application est entièrement fonctionnelle"
echo "   → Les problèmes de 'Route non trouvée' sont corrigés"
echo "   → Les dossiers se chargent correctement après connexion"
echo ""
echo "❌ Si des tests échouent:"
echo "   → Vérifier les logs: pm2 logs"
echo "   → Redémarrer les services: pm2 restart all"