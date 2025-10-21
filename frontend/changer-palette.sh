#!/bin/bash

# Script pour changer rapidement la palette de couleurs

echo "🎨 Choix de Palette de Couleurs"
echo ""
echo "1. Bleu Professionnel (défaut)"
echo "2. Violet Moderne"
echo "3. Vert Entreprise"
echo "4. Orange Dynamique"
echo "5. Rose Élégant"
echo "6. Cyan Tech"
echo ""
read -p "Choisissez une palette (1-6): " choice

case $choice in
  1)
    PRIMARY="#1A73E8"
    SECONDARY="#0F4C81"
    ACCENT="#FF6F61"
    NAME="Bleu Professionnel"
    ;;
  2)
    PRIMARY="#8B5CF6"
    SECONDARY="#6D28D9"
    ACCENT="#F472B6"
    NAME="Violet Moderne"
    ;;
  3)
    PRIMARY="#10B981"
    SECONDARY="#059669"
    ACCENT="#F59E0B"
    NAME="Vert Entreprise"
    ;;
  4)
    PRIMARY="#F97316"
    SECONDARY="#EA580C"
    ACCENT="#3B82F6"
    NAME="Orange Dynamique"
    ;;
  5)
    PRIMARY="#EC4899"
    SECONDARY="#BE185D"
    ACCENT="#8B5CF6"
    NAME="Rose Élégant"
    ;;
  6)
    PRIMARY="#06B6D4"
    SECONDARY="#0891B2"
    ACCENT="#F59E0B"
    NAME="Cyan Tech"
    ;;
  *)
    echo "❌ Choix invalide"
    exit 1
    ;;
esac

echo ""
echo "✨ Application de la palette : $NAME"
echo "   Primaire: $PRIMARY"
echo "   Secondaire: $SECONDARY"
echo "   Accent: $ACCENT"
echo ""

# Modifier le fichier theme.css
sed -i.bak "s/--color-primary: #[0-9A-Fa-f]\{6\};/--color-primary: $PRIMARY;/" src/styles/theme.css
sed -i.bak "s/--color-secondary: #[0-9A-Fa-f]\{6\};/--color-secondary: $SECONDARY;/" src/styles/theme.css
sed -i.bak "s/--color-accent: #[0-9A-Fa-f]\{6\};/--color-accent: $ACCENT;/" src/styles/theme.css

echo "✅ Palette appliquée avec succès !"
echo ""
echo "🔄 Rechargez votre navigateur (Cmd+R) pour voir les changements"
