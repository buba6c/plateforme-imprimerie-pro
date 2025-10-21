#!/bin/bash

echo "🔍 === VÉRIFICATION DES CORRECTIONS ===" 
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
TOTAL=0
SUCCESS=0
FAILED=0

check_file() {
    local file=$1
    local pattern=$2
    local description=$3
    
    TOTAL=$((TOTAL + 1))
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $description"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "${RED}❌${NC} $description"
        echo "   Fichier: $file"
        FAILED=$((FAILED + 1))
    fi
}

echo "📋 Vérification des corrections dans les Dashboards..."
echo ""

# Dashboards standards (anciens)
check_file \
    "frontend/src/components/PreparateurDashboard.js" \
    "if (user && user.id)" \
    "PreparateurDashboard vérifie user avant fetchDossiers"

check_file \
    "frontend/src/components/ImprimeurDashboard.js" \
    "if (user && user.id)" \
    "ImprimeurDashboard vérifie user avant fetchDossiers"

check_file \
    "frontend/src/components/LivreurDashboard.js" \
    "if (user && user.id)" \
    "LivreurDashboard vérifie user avant fetchDossiers"

# Dashboards UltraModern (actuellement utilisés)
check_file \
    "frontend/src/components/PreparateurDashboardUltraModern.js" \
    "if (user && user.id)" \
    "PreparateurDashboardUltraModern vérifie user avant fetchDossiers"

check_file \
    "frontend/src/components/ImprimeurDashboardUltraModern.js" \
    "if (user && user.id)" \
    "ImprimeurDashboardUltraModern vérifie user avant loadDossiers"

check_file \
    "frontend/src/components/LivreurInterfaceV2.js" \
    "if (user && user.id)" \
    "LivreurInterfaceV2 vérifie user avant fetchDossiers"

# DossierDetailsFixed
check_file \
    "frontend/src/components/dossiers/DossierDetailsFixed.js" \
    "if (!effectiveId ||" \
    "DossierDetailsFixed a des vérifications strictes"

echo ""
echo "🔐 Vérification des protections httpClient..."
echo ""

check_file \
    "frontend/src/services/httpClient.js" \
    "invalidSegmentRegex" \
    "httpClient bloque les URLs avec /null ou /undefined"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSUMÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total de vérifications: ${TOTAL}"
echo -e "${GREEN}Réussies: ${SUCCESS}${NC}"
echo -e "${RED}Échouées: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Toutes les corrections sont en place !${NC}"
    echo ""
    echo "🚀 Prochaines étapes:"
    echo "   1. Redémarrez le frontend: cd frontend && npm start"
    echo "   2. Ouvrez http://localhost:3001"
    echo "   3. Ouvrez la console (F12)"
    echo "   4. Vérifiez qu'il n'y a plus d'erreur /api/null"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  Certaines corrections n'ont pas été appliquées${NC}"
    echo ""
    exit 1
fi
