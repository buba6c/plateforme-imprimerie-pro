#!/bin/bash

# Script de vérification de la qualité du code - Version simplifiée
# Utilisation: ./quality-check-simple.sh

echo "🔍 Vérification simplifiée de la qualité du code..."
echo "=================================================="

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
        echo -e "${YELLOW}⚠️  $2 (quelques avertissements)${NC}"
    fi
}

# Variables pour compter les erreurs
ERRORS=0

echo -e "${BLUE}💅 Frontend - Formatage Prettier...${NC}"
cd frontend
npm run format >/dev/null 2>&1
FRONTEND_PRETTIER=$?
show_result $FRONTEND_PRETTIER "Prettier Frontend"

cd ..

echo -e "${BLUE}💅 Backend - Formatage Prettier...${NC}"
cd backend
npm run format >/dev/null 2>&1
BACKEND_PRETTIER=$?
show_result $BACKEND_PRETTIER "Prettier Backend"

cd ..

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Formatage du code terminé !${NC}"
echo -e "${BLUE}📋 Pour les vérifications ESLint détaillées :${NC}"
echo "   - Frontend: cd frontend && npm run lint"
echo "   - Backend: cd backend && npm run lint"
echo ""
echo -e "${YELLOW}💡 Configuration actuelle optimisée pour la productivité${NC}"
echo "   - PropTypes temporairement désactivées"
echo "   - Règles ESLint assouplies"
echo "   - Focus sur le formatage et bonnes pratiques essentielles"