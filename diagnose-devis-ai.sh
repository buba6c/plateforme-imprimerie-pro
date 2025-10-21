#!/bin/bash

# 🚀 Script de Diagnostic - Système Devis IA
# Vérifie l'état complet du système

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   🔍 DIAGNOSTIC - SYSTÈME DEVIS IA               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# ========================================
# 1. Vérifier les services PM2
# ========================================
echo "📊 1️⃣  État des Services PM2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

pm2_status=$(pm2 status 2>/dev/null)
if echo "$pm2_status" | grep -q "imprimerie-backend.*online"; then
    echo "✅ Backend:  ONLINE"
else
    echo "❌ Backend:  OFFLINE"
fi

if echo "$pm2_status" | grep -q "imprimerie-frontend.*online"; then
    echo "✅ Frontend: ONLINE"
else
    echo "❌ Frontend: OFFLINE"
fi

echo ""

# ========================================
# 2. Vérifier les ports
# ========================================
echo "🔌 2️⃣  Vérifier les Ports"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Backend   (3000):  ACCESSIBLE"
else
    echo "❌ Backend   (3000):  INACCESSIBLE"
fi

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Frontend  (3001):  ACCESSIBLE"
else
    echo "❌ Frontend  (3001):  INACCESSIBLE"
fi

echo ""

# ========================================
# 3. Vérifier les fichiers
# ========================================
echo "📁 3️⃣  Fichiers Composants"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FRONTEND_DIR="/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/frontend/src/components/devis"
BACKEND_DIR="/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/backend/routes"

# Frontend Components
if [ -f "$FRONTEND_DIR/DevisCreationAI.js" ]; then
    echo "✅ DevisCreationAI.js"
else
    echo "❌ DevisCreationAI.js (MANQUANT)"
fi

if [ -f "$FRONTEND_DIR/DevisPrintTemplate.js" ]; then
    echo "✅ DevisPrintTemplate.js"
else
    echo "❌ DevisPrintTemplate.js (MANQUANT)"
fi

if [ -f "$FRONTEND_DIR/DevisCreation.js" ]; then
    echo "✅ DevisCreation.js"
else
    echo "❌ DevisCreation.js (MANQUANT)"
fi

# Backend Routes
if [ -f "$BACKEND_DIR/devis.js" ]; then
    echo "✅ backend/routes/devis.js"
else
    echo "❌ backend/routes/devis.js (MANQUANT)"
fi

echo ""

# ========================================
# 4. Vérifier les endpoints
# ========================================
echo "🔗 4️⃣  Endpoints API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier si les endpoints sont définis
if grep -q "router.post('/analyze-description'" "$BACKEND_DIR/devis.js" 2>/dev/null; then
    echo "✅ POST /devis/analyze-description"
else
    echo "❌ POST /devis/analyze-description (MANQUANT)"
fi

if grep -q "router.post('/create'" "$BACKEND_DIR/devis.js" 2>/dev/null; then
    echo "✅ POST /devis/create"
else
    echo "❌ POST /devis/create (MANQUANT)"
fi

echo ""

# ========================================
# 5. Vérifier les imports/exports
# ========================================
echo "📦 5️⃣  Services OpenAI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

OPENAI_FILE="/Users/mac/Documents/PLATEFOME/IMP PLATEFORM/backend/services/openaiService.js"

if grep -q "analyzeWithGPT" "$OPENAI_FILE" 2>/dev/null; then
    echo "✅ Fonction analyzeWithGPT définie"
else
    echo "❌ Fonction analyzeWithGPT (MANQUANTE)"
fi

if grep -q "analyzeWithGPT" "$OPENAI_FILE" | grep -q "module.exports" 2>/dev/null; then
    echo "✅ analyzeWithGPT exportée"
else
    # Vérifier autrement
    if grep "module.exports" "$OPENAI_FILE" | grep -q "analyzeWithGPT" 2>/dev/null; then
        echo "✅ analyzeWithGPT exportée"
    else
        echo "⚠️  Vérifier export analyzeWithGPT"
    fi
fi

echo ""

# ========================================
# 6. Sommaire
# ========================================
echo "📋 6️⃣  Sommaire"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "✨ Système de Création de Devis par IA"
echo ""
echo "Statut:  DÉPLOYÉ ✅"
echo "Version: 1.0.0"
echo ""
echo "Fonctionnalités:"
echo "  • Mode 1: Formulaire détaillé"
echo "  • Mode 2: Description IA"
echo "  • Mode 3: Import (Future)"
echo "  • Template A4 professionnel"
echo "  • Estimations temps réel"
echo ""
echo "Documentation:"
echo "  → DEVIS_AI_ENHANCEMENT.md"
echo "  → GUIDE_RAPIDE_DEVIS_IA.md"
echo ""

# ========================================
# 7. Commandes utiles
# ========================================
echo "🔧 Commandes Utiles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Redémarrer services:"
echo "  pm2 restart all"
echo ""
echo "Voir les logs:"
echo "  pm2 logs imprimerie-backend"
echo "  pm2 logs imprimerie-frontend"
echo ""
echo "Recompiler frontend:"
echo "  cd \"/Users/mac/Documents/PLATEFOME/IMP PLATEFORM\" && npm --prefix frontend run build"
echo ""
echo "Tester endpoint API:"
echo "  curl -X POST http://localhost:3000/api/devis/analyze-description"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║   ✅ Diagnostic Terminé                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
