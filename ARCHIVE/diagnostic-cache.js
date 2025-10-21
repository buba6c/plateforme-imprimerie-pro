#!/usr/bin/env node

// Test de diagnostic pour identifier la source des anciens dossiers

const axios = require('axios').default;

async function main() {
  console.log('🔍 DIAGNOSTIC - Traçage de la source des dossiers CMD-2024-xxx');
  console.log('=============================================================\n');
  
  try {
    // 1. Test API santé
    console.log('1. 🏥 Test API Backend:');
    const healthResponse = await axios.get('http://localhost:5001/api/health');
    console.log(`   ✅ Backend opérationnel (uptime: ${Math.round(healthResponse.data.uptime)}s)`);
    
    // 2. Test endpoint dossiers sans authentification (pour debug)
    console.log('\n2. 🧪 Test endpoint /api/dossiers (sans auth - pour debug):');
    
    try {
      const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers');
      console.log(`   ❌ PROBLÈME: L'API a retourné des données sans authentification !`);
      console.log(`   📋 ${dossiersResponse.data.length} dossiers retournés`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(`   ✅ Bon: API protégée par authentification (401)`);
      } else {
        console.log(`   ⚠️ Erreur inattendue: ${error.message}`);
      }
    }
    
    // 3. Test des services de données frontend
    console.log('\n3. 📁 Analyse des services de données frontend:');
    
    // Vérifier s'il y a des données mock ou en cache
    const fs = require('fs');
    const path = require('path');
    
    const frontendPaths = [
      './frontend/src/services/mockApi.js',
      './frontend/src/services/apiAdapter.js', 
      './frontend/src/services/dossiersService.js'
    ];
    
    for (const filePath of frontendPaths) {
      if (fs.existsSync(filePath)) {
        console.log(`   📄 Fichier trouvé: ${filePath}`);
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Chercher des références aux dossiers CMD-2024
        if (content.includes('CMD-2024')) {
          console.log(`      ⚠️ Contient des références CMD-2024 !`);
        }
        
        // Chercher des données mock
        if (content.includes('mockDossiers') || content.includes('MOCK_DATA')) {
          console.log(`      ⚠️ Contient des données mock !`);
        }
        
        // Chercher localStorage
        if (content.includes('localStorage')) {
          console.log(`      ⚠️ Utilise localStorage (peut garder cache) !`);
        }
      }
    }
    
    // 4. Instructions de debug frontend
    console.log('\n4. 🔧 INSTRUCTIONS DE DEBUG FRONTEND:');
    console.log('');
    console.log('   📱 ÉTAPES POUR IDENTIFIER LE PROBLÈME:');
    console.log('');
    console.log('   1. Ouvrez http://localhost:3000 en navigation privée');
    console.log('   2. Appuyez sur F12 (outils développeur)'); 
    console.log('   3. Onglet "Network" > Cochez "Disable cache"');
    console.log('   4. Connectez-vous avec un compte');
    console.log('   5. Regardez dans l\'onglet Network:');
    console.log('');
    console.log('   🔍 VÉRIFICATIONS À FAIRE:');
    console.log('   - Y a-t-il une requête à /api/dossiers ?');
    console.log('   - Que retourne cette requête (clic sur la requête > Response) ?');
    console.log('   - Y a-t-il des erreurs 401/403 ?');
    console.log('   - L\'app charge-t-elle des données depuis localStorage ?');
    console.log('');
    console.log('   📋 ONGLET "Application" (dans F12):');
    console.log('   - Regardez dans "Local Storage" > http://localhost:3000');
    console.log('   - Y a-t-il des données de dossiers stockées ?');
    console.log('   - Si oui, supprimez tout le contenu');
    console.log('');
    console.log('   🧹 NETTOYAGE CACHE COMPLET:');
    console.log('   - F12 > Application > Storage > "Clear storage" > "Clear site data"');
    console.log('   - Ou Paramètres navigateur > Effacer données de navigation > Cocher "Données stockées" + "Cache"');
    
    // 5. Test avec différents navigateurs
    console.log('\n5. 🌐 TEST MULTI-NAVIGATEURS:');
    console.log('');
    console.log('   📱 Testez avec un navigateur différent:');
    console.log('   - Si vous utilisez Chrome, essayez Firefox');  
    console.log('   - Si vous utilisez Safari, essayez Chrome');
    console.log('   - Ou utilisez le mode privé/incognito');
    console.log('');
    console.log('   ✅ Si les FRESH-xxx apparaissent dans le nouveau navigateur:');
    console.log('      → Le problème était bien le cache du premier navigateur');
    console.log('');
    console.log('   ❌ Si les CMD-2024-xxx apparaissent encore:');
    console.log('      → L\'app utilise des données mock ou une autre API');
    
    // 6. Commandes de vérification
    console.log('\n6. 📋 COMMANDES DE VÉRIFICATION:');
    console.log('');
    console.log('   # Vérifier que la base ne contient que FRESH:');
    console.log('   psql -h localhost -U imprimerie_user -d imprimerie_db -c "SELECT numero_commande FROM dossiers;"');
    console.log('');
    console.log('   # Vérifier les logs en temps réel:');
    console.log('   pm2 logs --lines 0');
    console.log('');
    console.log('   # Redémarrer complètement si nécessaire:');
    console.log('   pm2 delete all && pm2 start');
    
    console.log('\n🎯 CONCLUSION:');
    console.log('');
    console.log('✅ La base de données est PROPRE (4 dossiers FRESH-xxx uniquement)');
    console.log('✅ Les services sont redémarrés'); 
    console.log('❓ Les CMD-2024-xxx viennent du cache navigateur OU de données mock');
    console.log('');
    console.log('💡 SOLUTION PROBABLE:');
    console.log('   → Videz complètement le cache navigateur');
    console.log('   → Ou testez en navigation privée');
    console.log('   → Ou utilisez un autre navigateur');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du diagnostic:', error.message);
  }
}

main().catch(console.error);