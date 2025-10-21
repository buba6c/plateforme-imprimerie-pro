#!/bin/bash

# Script de vérification de la qualité du code
# Utilisation: ./quality-check.sh

echo "🔍 Vérification de la qualité du code..."
echo "======================================="

# Variables de couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
show_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Variables pour compter les erreurs
ERRORS=0

echo -e "${BLUE}📋 Frontend - Vérification ESLint...${NC}"
cd frontend
npm run lint >/dev/null 2>&1
FRONTEND_LINT=$?
show_result $FRONTEND_LINT "ESLint Frontend"
ERRORS=$((ERRORS + FRONTEND_LINT))

echo -e "${BLUE}💅 Frontend - Vérification Prettier...${NC}"
npm run format:check >/dev/null 2>&1
FRONTEND_PRETTIER=$?
show_result $FRONTEND_PRETTIER "Prettier Frontend"
ERRORS=$((ERRORS + FRONTEND_PRETTIER))

cd ..

echo -e "${BLUE}📋 Backend - Vérification ESLint...${NC}"
cd backend
npm run lint >/dev/null 2>&1
BACKEND_LINT=$?
show_result $BACKEND_LINT "ESLint Backend"
ERRORS=$((ERRORS + BACKEND_LINT))

echo -e "${BLUE}💅 Backend - Vérification Prettier...${NC}"
npm run format:check >/dev/null 2>&1
BACKEND_PRETTIER=$?
show_result $BACKEND_PRETTIER "Prettier Backend"
ERRORS=$((ERRORS + BACKEND_PRETTIER))

cd ..

echo ""
echo "======================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 Toutes les vérifications sont passées!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $ERRORS erreur(s) détectée(s)${NC}"
    echo -e "${YELLOW}💡 Utilisez les commandes suivantes pour corriger:${NC}"
    echo "   - Frontend: cd frontend && npm run quality:fix"
    echo "   - Backend: cd backend && npm run quality:fix"
    exit 1
fi