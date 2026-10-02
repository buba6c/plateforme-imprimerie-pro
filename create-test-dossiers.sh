#!/bin/bash

# Script de création de dossier de test avec sections
# Pour tester l'affichage dans DossierDetails.js

echo "🧪 Création de dossier test avec sections/supports"
echo "=================================================="
echo ""

# Variables
API_URL="http://localhost:5001/api"
TOKEN=""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction login
login() {
  echo -e "${BLUE}📝 Étape 1: Login...${NC}"
  
  RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "yoro@evocomprint.com",
      "password": "votre_mot_de_passe"
    }')
  
  TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login échoué. Vérifiez le mot de passe.${NC}"
    echo "Réponse: $RESPONSE"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Login OK, token obtenu${NC}"
  echo ""
}

# Fonction création dossier Xerox avec sections
create_xerox_with_sections() {
  echo -e "${BLUE}📝 Étape 2: Création dossier Xerox avec sections...${NC}"
  
  RESPONSE=$(curl -s -X POST "${API_URL}/dossiers" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
      "client_id": 1,
      "type_formulaire": "xerox",
      "description": "Test brochure A4 - Couverture couleur + Intérieur N&B",
      "amount": 262000,
      "sections": [
        {
          "type": "Couverture",
          "mode_impression": "recto_verso",
          "copies": 100,
          "paper_types": [
            {
              "format": "A4",
              "couleur": "couleur",
              "grammage": "250",
              "pages": 2
            }
          ],
          "finitions": ["plastification", "pelliculage"],
          "faconnage": []
        },
        {
          "type": "Intérieur",
          "mode_impression": "recto_verso",
          "copies": 100,
          "paper_types": [
            {
              "format": "A4",
              "couleur": "nb",
              "grammage": "80",
              "pages": 20
            }
          ],
          "finitions": [],
          "faconnage": ["reliure_spirale", "agrafage"]
        }
      ]
    }')
  
  DOSSIER_ID=$(echo $RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  
  if [ -z "$DOSSIER_ID" ]; then
    echo -e "${RED}❌ Création échouée${NC}"
    echo "Réponse: $RESPONSE"
    return 1
  fi
  
  echo -e "${GREEN}✅ Dossier Xerox créé avec ID: ${DOSSIER_ID}${NC}"
  echo -e "${YELLOW}👉 Ouvrir dans le navigateur:${NC}"
  echo -e "${YELLOW}   http://localhost:3000/dossiers/${DOSSIER_ID}${NC}"
  echo ""
  
  return 0
}

# Fonction création dossier Roland avec supports
create_roland_with_supports() {
  echo -e "${BLUE}📝 Étape 3: Création dossier Roland avec supports...${NC}"
  
  RESPONSE=$(curl -s -X POST "${API_URL}/dossiers" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
      "client_id": 1,
      "type_formulaire": "roland",
      "description": "Test multi-supports - Bâche extérieur + Vinyle intérieur",
      "amount": 78500,
      "supports": [
        {
          "type_support": "bache",
          "largeur": 3.0,
          "hauteur": 2.0,
          "unite": "m",
          "exemplaires": 5,
          "finitions": ["oeillets", "coupage_decoupe"]
        },
        {
          "type_support": "vinyle",
          "largeur": 1.5,
          "hauteur": 1.0,
          "unite": "m",
          "exemplaires": 10,
          "finitions": ["pelliculage", "montage"]
        }
      ]
    }')
  
  DOSSIER_ID=$(echo $RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  
  if [ -z "$DOSSIER_ID" ]; then
    echo -e "${RED}❌ Création échouée${NC}"
    echo "Réponse: $RESPONSE"
    return 1
  fi
  
  echo -e "${GREEN}✅ Dossier Roland créé avec ID: ${DOSSIER_ID}${NC}"
  echo -e "${YELLOW}👉 Ouvrir dans le navigateur:${NC}"
  echo -e "${YELLOW}   http://localhost:3000/dossiers/${DOSSIER_ID}${NC}"
  echo ""
  
  return 0
}

# Exécution
echo -e "${YELLOW}⚠️  Assurez-vous que:${NC}"
echo "  1. Le backend est démarré (pm2 list)"
echo "  2. Le frontend est démarré (npm start)"
echo "  3. Vous avez modifié le mot de passe dans ce script"
echo ""
read -p "Continuer? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

# Tests
login
if [ $? -eq 0 ]; then
  create_xerox_with_sections
  create_roland_with_supports
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Tests terminés!${NC}"
echo ""
echo -e "${YELLOW}📋 Checklist de validation:${NC}"
echo "  [ ] Ouvrir les dossiers dans le navigateur"
echo "  [ ] Vérifier l'affichage de SectionsDisplay (bleu)"
echo "  [ ] Vérifier l'affichage de SupportsDisplay (vert)"
echo "  [ ] Vérifier l'affichage de AmountBadge (jaune)"
echo "  [ ] Vérifier le calcul de surface pour Roland"
echo "  [ ] Vérifier les finitions et façonnages"
echo "  [ ] Tester en mode sombre (dark mode)"
echo ""
