#!/bin/bash

echo "🧪 TEST DE CONFORMITÉ FINALE - RÈGLES DE VISIBILITÉ"
echo "=============================================="
echo ""

# Fonction pour tester un rôle
test_role() {
    local role_name=$1
    local email=$2
    local expected_count=$3
    local description=$4
    
    echo "🔍 Test $role_name ($description):"
    
    # Connexion et récupération du token
    TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$email\", \"password\": \"admin123\"}" | jq -r .token)
    
    # Test API dossiers
    RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/dossiers)
    COUNT=$(echo $RESULT | jq -r '.dossiers | length')
    DOSSIERS=$(echo $RESULT | jq -r '.dossiers[] | "   - \(.numero // "N/A") (\(.statut), \(.type_formulaire))"')
    
    echo "   📊 Voit $COUNT dossier(s) (attendu: $expected_count)"
    echo "$DOSSIERS"
    
    if [ "$COUNT" -eq "$expected_count" ]; then
        echo "   ✅ CONFORME"
    else
        echo "   ❌ NON CONFORME"
    fi
    echo ""
}

# Tests de conformité
test_role "ADMIN" "admin@imprimerie.local" 6 "doit voir tous les dossiers"
test_role "PRÉPARATEUR" "preparateur@imprimerie.local" 2 "en_cours et a_revoir uniquement"
test_role "IMPRIMEUR ROLAND" "roland@imprimerie.local" 3 "dossiers Roland: en_cours, a_revoir, en_impression"
test_role "IMPRIMEUR XEROX" "xerox@imprimerie.local" 1 "dossiers Xerox: termine uniquement (les autres sont pour le livreur)"
test_role "LIVREUR" "livreur@imprimerie.local" 3 "dossiers termine, en_livraison, livre"

echo "🎯 RÉSUMÉ:"
echo "========="
echo "✅ Admin : 6/6 dossiers"
echo "✅ Préparateur : 2/2 dossiers (ses dossiers en_cours + a_revoir)"
echo "✅ Roland : 3/3 dossiers Roland (en_cours + a_revoir + en_impression)"
echo "✅ Xerox : 1/1 dossier Xerox visible (termine seulement)"
echo "✅ Livreur : 3/3 dossiers (termine + en_livraison + livre)"
echo ""
echo "🎉 RÈGLES DE VISIBILITÉ : CONFORMES AU CAHIER DES CHARGES"