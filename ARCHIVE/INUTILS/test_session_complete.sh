#!/bin/bash

echo "🧪 TEST SESSION UTILISATEUR COMPLÈTE"
echo "===================================="
echo ""

# Test avec différents utilisateurs
test_user_session() {
    local role=$1
    local email=$2
    local description=$3
    
    echo "👤 Test session $role ($description)"
    echo "----------------------------------------"
    
    # 1. Connexion
    echo "📝 1. Connexion..."
    TOKEN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$email\", \"password\": \"admin123\"}")
    
    TOKEN=$(echo $TOKEN_RESPONSE | jq -r .token 2>/dev/null)
    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        echo "   ❌ Échec de la connexion"
        echo "   Réponse: $TOKEN_RESPONSE"
        return
    fi
    echo "   ✅ Connexion réussie"
    
    # 2. Test accès aux dossiers  
    echo "📁 2. Chargement des dossiers..."
    DOSSIERS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:5001/api/dossiers)
    
    if echo "$DOSSIERS_RESPONSE" | jq -e . >/dev/null 2>&1; then
        COUNT=$(echo "$DOSSIERS_RESPONSE" | jq -r '.dossiers | length' 2>/dev/null)
        if [ "$COUNT" != "null" ] && [ ! -z "$COUNT" ]; then
            echo "   ✅ Dossiers chargés: $COUNT dossier(s)"
            echo "$DOSSIERS_RESPONSE" | jq -r '.dossiers[] | "      - \(.numero // "N/A") (\(.statut), \(.type_formulaire))"' 2>/dev/null | head -3
        else
            echo "   ❌ Format de réponse incorrect"
        fi
    else
        echo "   ❌ Erreur lors du chargement des dossiers"
        echo "   Réponse: $(echo "$DOSSIERS_RESPONSE" | head -100)"
    fi
    
    # 3. Test création (pour admin et préparateur seulement)
    if [ "$role" = "admin" ] || [ "$role" = "préparateur" ]; then
        echo "➕ 3. Test création de dossier..."
        CREATE_RESPONSE=$(curl -s -X POST http://localhost:5001/api/dossiers \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "client": "Test Client Session",
                "type_formulaire": "roland", 
                "data_formulaire": {"dimension": "50x30"},
                "commentaire": "Test session '$role'"
            }')
        
        if echo "$CREATE_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
            echo "   ✅ Création réussie"
        else
            echo "   ⚠️  Création échouée (peut-être des permissions)"
        fi
    fi
    
    echo ""
}

# Tests pour tous les rôles
test_user_session "admin" "admin@imprimerie.local" "Administrateur - accès complet"
test_user_session "préparateur" "preparateur@imprimerie.local" "Préparateur - dossiers en_cours/a_revoir"  
test_user_session "imprimeur Roland" "roland@imprimerie.local" "Imprimeur Roland - dossiers Roland"
test_user_session "imprimeur Xerox" "xerox@imprimerie.local" "Imprimeur Xerox - dossiers Xerox"
test_user_session "livreur" "livreur@imprimerie.local" "Livreur - dossiers livraison"

echo "🎯 RÉSUMÉ FINAL"
echo "==============="
echo "✅ Si tous les tests affichent 'Connexion réussie' et 'Dossiers chargés'"
echo "   → La plateforme fonctionne correctement"
echo "   → Il suffit de se connecter via http://localhost:3001"
echo ""
echo "❌ Si des erreurs apparaissent:"
echo "   → Vérifier que les services PM2 sont démarrés (pm2 status)"
echo "   → Vérifier les logs (pm2 logs)"
echo ""
echo "🌐 Pour utiliser l'interface:"
echo "   1. Ouvrir http://localhost:3001"  
echo "   2. Se connecter avec un des comptes:"
echo "      - admin@imprimerie.local / admin123 (admin)"
echo "      - preparateur@imprimerie.local / admin123 (préparateur)"
echo "      - roland@imprimerie.local / admin123 (imprimeur Roland)"  
echo "      - xerox@imprimerie.local / admin123 (imprimeur Xerox)"
echo "      - livreur@imprimerie.local / admin123 (livreur)"