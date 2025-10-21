#!/bin/bash

echo "🔐 Test d'upload de fichiers avec authentification"

# URL de base
API_URL="http://localhost:5001/api"

# 1. Connexion et récupération du token
echo "1️⃣ Connexion..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@imprimerie.com",
    "password": "admin123"
  }')

echo "Réponse login: $LOGIN_RESPONSE"

# Extraire le token (simple parsing JSON)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: impossible de récupérer le token"
  exit 1
fi

echo "✅ Token récupéré: ${TOKEN:0:20}..."

# 2. Vérifier l'authentification
echo "2️⃣ Vérification authentification..."
AUTH_CHECK=$(curl -s -X GET "${API_URL}/auth/me" \
  -H "Authorization: Bearer $TOKEN")

echo "Check auth: $AUTH_CHECK"

# 3. Test upload sur le dossier 9 (en cours)
echo "3️⃣ Test upload de fichier..."

UPLOAD_RESPONSE=$(curl -s -X POST "${API_URL}/files/upload/9" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@test-upload.txt")

echo "Réponse upload: $UPLOAD_RESPONSE"

# 4. Test de l'endpoint /all pour Admin
echo "4️⃣ Test endpoint /files/all..."
ALL_FILES_RESPONSE=$(curl -s -X GET "${API_URL}/files/all?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "Fichiers (admin): $ALL_FILES_RESPONSE"

echo "✅ Tests terminés!"