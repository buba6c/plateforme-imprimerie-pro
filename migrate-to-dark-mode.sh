#!/bin/bash

# Script de migration automatique vers le mode dark
# Ce script ajoute les classes dark: sur les composants principaux

echo "🎨 Début de la migration vers le mode dark..."

# Fonction pour faire un backup
backup_file() {
  local file="$1"
  if [ ! -f "$file.dark-backup" ]; then
    cp "$file" "$file.dark-backup"
    echo "  ✅ Backup créé: $file.dark-backup"
  fi
}

# Fichiers à migrer
FILES=(
  "frontend/src/components/PreparateurDashboardUltraModern.js"
  "frontend/src/components/ImprimeurDashboardUltraModern.js"
  "frontend/src/components/LivreurDashboardUltraModern.js"
  "frontend/src/components/admin/Dashboard.js"
  "frontend/src/components/livreur/LivreurBoard.js"
)

# Patterns de remplacement
declare -A REPLACEMENTS=(
  # Backgrounds
  ["bg-white "]="bg-white dark:bg-neutral-900 "
  ["bg-white\""]="bg-white dark:bg-neutral-900\""
  ["bg-gray-50"]="bg-neutral-50 dark:bg-neutral-900"
  ["bg-gray-100"]="bg-neutral-100 dark:bg-neutral-800"
  ["bg-gray-200"]="bg-neutral-200 dark:bg-neutral-700"
  
  # Textes principaux
  ["text-gray-900"]="text-neutral-900 dark:text-white"
  ["text-gray-800"]="text-neutral-800 dark:text-neutral-100"
  ["text-gray-700"]="text-neutral-700 dark:text-neutral-200"
  
  # Textes secondaires
  ["text-gray-600"]="text-neutral-600 dark:text-neutral-300"
  ["text-gray-500"]="text-neutral-500 dark:text-neutral-400"
  ["text-gray-400"]="text-neutral-400 dark:text-neutral-500"
  
  # Bordures
  ["border-gray-200"]="border-neutral-200 dark:border-neutral-700"
  ["border-gray-300"]="border-neutral-300 dark:border-neutral-600"
  
  # Dividers
  ["divide-gray-200"]="divide-neutral-200 dark:divide-neutral-700"
)

# Fonction de remplacement
migrate_file() {
  local file="$1"
  
  if [ ! -f "$file" ]; then
    echo "  ⚠️  Fichier non trouvé: $file"
    return
  fi
  
  echo "  📝 Migration de: $file"
  backup_file "$file"
  
  # Créer un fichier temporaire
  local temp_file="${file}.tmp"
  cp "$file" "$temp_file"
  
  # Appliquer les remplacements
  for pattern in "${!REPLACEMENTS[@]}"; do
    replacement="${REPLACEMENTS[$pattern]}"
    # Utiliser perl pour un remplacement plus fiable
    perl -i -pe "s/\Q$pattern\E/$replacement/g" "$temp_file"
  done
  
  # Remplacer le fichier original
  mv "$temp_file" "$file"
  echo "  ✅ Migration terminée: $file"
}

# Migrer chaque fichier
for file in "${FILES[@]}"; do
  migrate_file "$file"
done

echo ""
echo "🎉 Migration terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Vérifier les fichiers migrés"
echo "  2. Tester l'interface en mode dark"
echo "  3. Ajuster manuellement si nécessaire"
echo ""
echo "💡 Les backups sont dans *.dark-backup"
