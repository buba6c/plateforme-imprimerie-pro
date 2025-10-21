/**
 * Script de diagnostic pour identifier l'origine des requêtes /api/null
 * À exécuter dans la console du navigateur (F12)
 */

console.log('🔍 === DIAGNOSTIC REQUÊTES /api/null ===\n');

// 1. Vérifier les requêtes invalides enregistrées
if (window.__INVALID_API_REQUESTS__ && window.__INVALID_API_REQUESTS__.length > 0) {
  console.log(`🚨 ${window.__INVALID_API_REQUESTS__.length} requête(s) invalide(s) détectée(s):\n`);
  
  window.__INVALID_API_REQUESTS__.forEach((req, index) => {
    console.log(`\n━━━ REQUÊTE #${index + 1} ━━━`);
    console.log(`📅 Timestamp: ${req.timestamp}`);
    console.log(`🔗 URL complète: ${req.fullUrl}`);
    console.log(`📝 Méthode: ${req.method}`);
    console.log(`\n📋 Détails:`, req.details);
    console.log(`\n🔍 Stack trace:`);
    console.log(req.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
} else {
  console.log('✅ Aucune requête invalide enregistrée pour le moment');
  console.log('\n💡 Si vous voyez l\'erreur, actualisez la page et cette liste se remplira');
}

// 2. Rechercher les composants React qui pourraient être la source
console.log('\n\n🔎 === ANALYSE DES COMPOSANTS REACT ===\n');

// Recherche dans les hooks actifs
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('⚛️ React DevTools détecté - inspectez les composants avec React DevTools');
  console.log('💡 Cherchez les composants avec des props/state contenant null comme ID');
} else {
  console.log('⚠️ React DevTools non détecté - installez l\'extension pour mieux debugger');
}

// 3. Conseils de résolution
console.log('\n\n💡 === SOLUTIONS POSSIBLES ===\n');
console.log(`
1️⃣ Vérifiez les useEffect sans dépendances correctes:
   ❌ BAD:  useEffect(() => loadDossier(id), []);
   ✅ GOOD: useEffect(() => { if (id) loadDossier(id); }, [id]);

2️⃣ Vérifiez les appels API directs:
   ❌ BAD:  getDossier(dossier?.id)  // peut être undefined
   ✅ GOOD: if (dossier?.id) getDossier(dossier.id)

3️⃣ Vérifiez les props de navigation:
   ❌ BAD:  navigate(\`/dossiers/\${id}\`)  // id peut être null
   ✅ GOOD: if (id) navigate(\`/dossiers/\${id}\`)

4️⃣ Cherchez dans les fichiers (regex):
   • getDossier\\(.*null
   • /dossiers/\\$\\{.*\\}
   • useEffect\\(.*\\[\\s*\\]\\).*loadDossier
`);

// 4. Monitorer les prochaines requêtes
console.log('\n\n🎯 === SURVEILLANCE EN TEMPS RÉEL ===\n');
console.log('Surveillance active des prochaines requêtes /api/null...');
console.log('Reproduisez l\'erreur maintenant et la stack trace apparaîtra ci-dessus.');

// Nettoyer pour la prochaine exécution
// window.__INVALID_API_REQUESTS__ = [];
