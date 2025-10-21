// Script pour nettoyer complètement le cache localStorage
console.log('🧹 Nettoyage complet du cache localStorage...');

// Supprimer les clés spécifiques aux dossiers mockés
const keysToRemove = [
  'mock_dossiers_storage_v1',
  'backendAvailable',
  'lastBackendCheck',
  'cached_dossiers',
  'dossiers_cache',
  'api_cache'
];

keysToRemove.forEach(key => {
  if (localStorage.getItem(key)) {
    localStorage.removeItem(key);
    console.log(`✅ Supprimé: ${key}`);
  } else {
    console.log(`ℹ️ Pas trouvé: ${key}`);
  }
});

// Afficher toutes les clés restantes
console.log('\n📋 Clés localStorage restantes:');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  console.log(`- ${key}: ${localStorage.getItem(key).substring(0, 100)}...`);
}

console.log('\n✨ Nettoyage localStorage terminé!');