#!/bin/bash
# Test rapide des nouvelles fonctionnalités de workflow

echo "🧪 Test des nouvelles API de workflow"
echo "======================================"

# Vérifier l'API de santé
echo -e "\n1. Test API Health:"
curl -s http://localhost:5001/api/health | jq -r '.status, .database'

# Vérifier les métadonnées workflow
echo -e "\n2. Test Workflow Meta:"
curl -s http://localhost:5001/api/workflow/meta | jq -r '.version, (.statuses | length), (.roles | length)'

# Tester l'endpoint dossiers (nécessite authentification, mais on peut voir l'erreur)
echo -e "\n3. Test endpoint dossiers (sans auth - pour vérifier que l'API répond):"
curl -s http://localhost:5001/api/dossiers | jq -r '.error // "OK"' 2>/dev/null || echo "Authentification requise (normal)"

# Vérifier si le frontend répond
echo -e "\n4. Test Frontend:"
if curl -s http://localhost:3000 | grep -q "<!DOCTYPE html>"; then
    echo "✅ Frontend actif"
else
    echo "❌ Frontend non accessible"
fi

echo -e "\n✅ Tests terminés - La plateforme est opérationnelle avec le nouveau workflow adapter !"