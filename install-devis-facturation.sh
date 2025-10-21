#!/bin/bash

echo "🚀 Installation du module Devis & Facturation"
echo "=============================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Backend
echo -e "${BLUE}📦 Installation des dépendances backend...${NC}"
cd backend
npm install openai pdfkit multer uuid

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances backend installées${NC}"
else
    echo -e "${YELLOW}⚠️  Erreur lors de l'installation backend${NC}"
    exit 1
fi

# Créer les dossiers nécessaires
echo -e "${BLUE}📁 Création des dossiers...${NC}"
mkdir -p uploads/devis
mkdir -p uploads/factures
mkdir -p uploads/config/openai
echo -e "${GREEN}✅ Dossiers créés${NC}"

# Vérifier .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé${NC}"
    echo "ENCRYPTION_KEY=$(openssl rand -hex 16)" >> .env
    echo -e "${GREEN}✅ ENCRYPTION_KEY ajoutée au .env${NC}"
else
    if ! grep -q "ENCRYPTION_KEY" .env; then
        echo "ENCRYPTION_KEY=$(openssl rand -hex 16)" >> .env
        echo -e "${GREEN}✅ ENCRYPTION_KEY ajoutée au .env${NC}"
    else
        echo -e "${GREEN}✅ ENCRYPTION_KEY déjà présente${NC}"
    fi
fi

cd ..

# Frontend
echo -e "${BLUE}📦 Installation des dépendances frontend...${NC}"
cd frontend
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances frontend installées${NC}"
else
    echo -e "${YELLOW}⚠️  Erreur lors de l'installation frontend${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${GREEN}✅ Installation terminée !${NC}"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Exécuter la migration SQL :"
echo "   mysql -u root -p plateforme_impression < backend/database/migrations/002_devis_facturation.sql"
echo ""
echo "2. Mettre à jour backend/server.js pour monter les routes :"
echo "   - require('./routes/devis')"
echo "   - require('./routes/factures')"
echo "   - require('./routes/tarifs')"
echo "   - require('./routes/openai-config')"
echo ""
echo "3. Redémarrer le serveur :"
echo "   npm run dev (ou pm2 restart)"
echo ""
echo "📖 Consultez GUIDE_IMPLEMENTATION_DEVIS_FACTURATION.md pour plus de détails"
