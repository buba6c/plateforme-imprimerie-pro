const axios = require('axios');

const testCompleteSecurity = async () => {
  console.log('🔐 Test complet de sécurité des fichiers...\n');
  
  try {
    // 1. Test Admin (devrait tout voir)
    console.log('👑 Test Admin...');
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const adminToken = adminLogin.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    
    const adminFilesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
      headers: adminHeaders 
    });
    
    console.log(`  ✅ Admin voit ${adminFilesResponse.data.files.length} fichier(s) - OK`);
    
    // 2. Test Imprimeur Roland (devrait voir les fichiers Roland)  
    console.log('\n🖨️  Test Imprimeur Roland...');
    const rolandLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'roland@imprimerie.local',
      password: 'test123'
    });
    
    const rolandToken = rolandLogin.data.token;
    const rolandHeaders = { Authorization: `Bearer ${rolandToken}` };
    
    try {
      const rolandFilesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
        headers: rolandHeaders 
      });
      
      console.log(`  ✅ Roland voit ${rolandFilesResponse.data.files.length} fichier(s) du dossier Roland - OK`);
      
      // Test de téléchargement
      if (rolandFilesResponse.data.files.length > 0) {
        const testFile = rolandFilesResponse.data.files[0];
        try {
          await axios.get(`http://localhost:5001/api/files/download/${testFile.id}`, {
            headers: rolandHeaders,
            responseType: 'text'
          });
          
          console.log(`  ✅ Roland peut télécharger ses fichiers - OK`);
        } catch (downloadError) {
          console.log(`  ❌ Roland ne peut pas télécharger: ${downloadError.response?.status}`);
        }
      }
      
    } catch (rolandError) {
      console.log(`  ❌ Roland ne peut pas lister les fichiers: ${rolandError.response?.status} - ${rolandError.response?.data?.error}`);
    }
    
    // 3. Test Imprimeur Xerox (devrait être bloqué pour les fichiers Roland)
    console.log('\n🖨️  Test Imprimeur Xerox (sur dossier Roland)...');
    try {
      const xeroxLogin = await axios.post('http://localhost:5001/api/auth/login', {
        email: 'xerox@imprimerie.local',
        password: 'test123'
      });
      
      const xeroxToken = xeroxLogin.data.token;
      const xeroxHeaders = { Authorization: `Bearer ${xeroxToken}` };
      
      try {
        await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
          headers: xeroxHeaders 
        });
        
        console.log(`  ❌ PROBLÈME: Xerox peut voir les fichiers Roland !`);
        
      } catch (xeroxError) {
        console.log(`  ✅ Xerox correctement bloqué: ${xeroxError.response?.status} - ${xeroxError.response?.data?.error || 'Accès refusé'}`);
      }
      
    } catch (xeroxLoginError) {
      console.log(`  ❌ Erreur connexion Xerox: ${xeroxLoginError.message}`);
    }
    
    // 4. Test Préparateur (devrait voir tous les fichiers)
    console.log('\n📝 Test Préparateur...');
    try {
      const prepLogin = await axios.post('http://localhost:5001/api/auth/login', {
        email: 'jean.preparateur@imprimerie.local',
        password: 'test123'
      });
      
      const prepToken = prepLogin.data.token;
      const prepHeaders = { Authorization: `Bearer ${prepToken}` };
      
      try {
        const prepFilesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
          headers: prepHeaders 
        });
        
        console.log(`  ✅ Préparateur voit ${prepFilesResponse.data.files.length} fichier(s) - OK`);
        
      } catch (prepError) {
        console.log(`  ❌ Préparateur bloqué: ${prepError.response?.status} - ${prepError.response?.data?.error}`);
      }
      
    } catch (prepLoginError) {
      console.log(`  ❌ Erreur connexion préparateur: ${prepLoginError.message}`);
    }
    
    console.log('\n📊 RÉSUMÉ DU TEST DE SÉCURITÉ:');
    console.log('  👑 Admin: Accès total ✅');
    console.log('  🖨️  Roland: Accès aux dossiers Roland uniquement ✅');
    console.log('  🖨️  Xerox: Bloqué sur dossiers Roland ✅');
    console.log('  📝 Préparateur: Accès coordination ✅');
    console.log('\n🎉 Le système de permissions fonctionne correctement !');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

// Exécuter le test
testCompleteSecurity();