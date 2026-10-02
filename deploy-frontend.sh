#!/bin/bash

echo "🚀 Déploiement Frontend avec Sections Multi-Supports"
echo "======================================================"
echo ""

cd /var/www/imprimerie/frontend

echo "📦 Installation des dépendances (si nécessaire)..."
npm install --quiet

echo ""
echo "🔨 Build du frontend (avec nouveaux composants)..."
npm run build

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Build réussi!"
  echo ""
  echo "📊 Nouveaux composants inclus:"
  echo "  ✓ SectionForm.js"
  echo "  ✓ SupportForm.js"
  echo "  ✓ AmountField.js"
  echo "  ✓ SectionsManager.js"
  echo "  ✓ SupportsManager.js"
  echo "  ✓ SectionsDisplay.js"
  echo "  ✓ SupportsDisplay.js"
  echo "  ✓ AmountBadge.js"
  echo "  ✓ EditSectionsModal.js"
  echo ""
  echo "📝 Modifications appliquées:"
  echo "  ✓ CreateDossier.js (toggles sections/supports)"
  echo "  ✓ DossierDetails.js (affichage + modal édition)"
  echo ""
  echo "🌐 La plateforme est maintenant à jour!"
  echo ""
  echo "🔗 Accès:"
  echo "   Frontend: http://$(hostname -I | awk '{print $1}'):80"
  echo "   Backend API: http://$(hostname -I | awk '{print $1}'):5001"
  echo ""
  echo "✅ Les modifications sont maintenant VISIBLES sur la plateforme!"
else
  echo ""
  echo "❌ Erreur lors du build"
  exit 1
fi
