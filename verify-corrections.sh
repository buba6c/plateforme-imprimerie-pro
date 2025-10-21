#!/bin/bash

# Script de vérification des corrections appliquées
# Usage: ./verify-corrections.sh

set -e

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Vérification des corrections - Plateforme Imprimerie v3  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Compteurs
CHECKS=0
PASSED=0
FAILED=0

# Fonction de vérification
check() {
    local description=$1
    local command=$2
    
    CHECKS=$((CHECKS + 1))
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Vérifications de structure
echo -e "${YELLOW}📁 Vérification de la structure des fichiers...${NC}"
echo ""

check "Module validators.js existe" "test -f backend/utils/validators.js"
check "Tests validators.js existent" "test -f backend/tests/test-validators.js"
check "Documentation CORRECTIONS_APPLIED.md existe" "test -f CORRECTIONS_APPLIED.md"
check "Dossier uploads/ existe" "test -d uploads || mkdir -p uploads"

echo ""

# Vérifications de contenu
echo -e "${YELLOW}🔍 Vérification du contenu des fichiers...${NC}"
echo ""

check "validators.js contient isValidUUID" "grep -q 'isValidUUID' backend/utils/validators.js"
check "validators.js contient validateIdParam" "grep -q 'validateIdParam' backend/utils/validators.js"
check "files.js importe validators" "grep -q 'validators' backend/routes/files.js"
check "dossiers.js importe validators" "grep -q 'validators' backend/routes/dossiers.js"

echo ""

# Vérification des modifications dans files.js
echo -e "${YELLOW}📝 Vérification des modifications dans files.js...${NC}"
echo ""

check "Validation UUID ajoutée à /upload/:dossierId" "grep -q 'isValidId(dossierId)' backend/routes/files.js"
check "validateIdParam utilisé pour GET /:id" "grep -q 'validateIdParam.*id.*async.*req.*res' backend/routes/files.js"
check "Gestion des chemins relatifs" "grep -q 'path.isAbsolute' backend/routes/files.js"

echo ""

# Vérification des modifications dans dossiers.js
echo -e "${YELLOW}📝 Vérification des modifications dans dossiers.js...${NC}"
echo ""

check "validateIdParam utilisé dans GET /:id" "grep -q 'router.get.*:id.*validateIdParam' backend/routes/dossiers.js"
check "validateIdParam utilisé dans PUT /:id" "grep -q 'router.put.*:id.*validateIdParam' backend/routes/dossiers.js"
check "validateIdParam utilisé dans DELETE /:id" "grep -q 'router.delete.*:id.*validateIdParam' backend/routes/dossiers.js"

echo ""

# Tests unitaires
echo -e "${YELLOW}🧪 Lancement des tests unitaires...${NC}"
echo ""

if node backend/tests/test-validators.js > /tmp/test-output.txt 2>&1; then
    TESTS_PASSED=$(grep -o "Réussis: [0-9]*" /tmp/test-output.txt | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Tests validateurs : ${GREEN}${TESTS_PASSED}/33 passés${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Tests validateurs échoués"
    cat /tmp/test-output.txt
    FAILED=$((FAILED + 1))
fi

CHECKS=$((CHECKS + 1))

echo ""

# Résumé final
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📊 Résumé${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total des vérifications : ${CHECKS}"
echo -e "${GREEN}Réussies               : ${PASSED}${NC}"
echo -e "${RED}Échouées               : ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✓ Toutes les vérifications sont passées !         ║${NC}"
    echo -e "${GREEN}║     Les corrections sont correctement appliquées.     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📦 Prochaines étapes :${NC}"
    echo "   1. Redémarrer le serveur backend"
    echo "   2. Tester l'upload de fichiers"
    echo "   3. Vérifier les logs (moins d'erreurs 500 attendues)"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     ✗ Certaines vérifications ont échoué              ║${NC}"
    echo -e "${RED}║     Veuillez vérifier les erreurs ci-dessus.          ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi
