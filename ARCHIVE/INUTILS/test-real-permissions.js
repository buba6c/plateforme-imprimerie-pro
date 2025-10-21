const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_BASE = 'http://localhost:3001/api';

const TEST_REPORT_PATH = path.join(__dirname, 'test-real-permissions-result.json');

const testRealPermissions = async () => {
  console.log('🧪 Test des permissions réelles via API...');
  
  const testResults = [];
  
  // Différents utilisateurs de test (vous devrez ajuster selon vos données)
  const testUsers = [
    {
      role: 'admin',
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Admin Test'
    },
    {
      role: 'imprimeur_roland',
      email: 'roland@test.com', 
      password: 'roland123',
      name: 'Imprimeur Roland'
    },
    {
      role: 'imprimeur_xerox',
      email: 'xerox@test.com',
      password: 'xerox123', 
      name: 'Imprimeur Xerox'
    }
  ];
  
  // Dossiers de test (remplacez par des IDs réels de votre DB)
  const testDossiers = [
    { id: '1', name: 'Dossier Roland', expectedMachine: 'roland' },
    { id: '2', name: 'Dossier Xerox', expectedMachine: 'xerox' }
  ];

  for (const user of testUsers) {
    console.log(`\n👤 Tests pour ${user.name} (${user.role})`);
    
    try {
      // 1. Connexion
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: user.email,
        password: user.password
      });
      
      const token = loginResponse.data.token;
      const headers = { Authorization: `Bearer ${token}` };
      
      console.log(`✅ Connexion réussie pour ${user.name}`);
      
      // 2. Test d'accès aux dossiers
      for (const dossier of testDossiers) {
        try {
          const dossierResponse = await axios.get(`${API_BASE}/dossiers/${dossier.id}`, { headers });
          
          testResults.push({
            user: user.role,
            test: `Accès dossier ${dossier.name}`,
            status: 'success',
            message: `✅ Accès réussi (${dossierResponse.status})`,
            expected: user.role === 'admin' ? 'success' : 'depends',
            passed: true
          });
          
          console.log(`✅ ${user.name} peut accéder au ${dossier.name}`);
          
          // 3. Test de téléchargement de fichiers si accessible
          try {
            const filesResponse = await axios.get(`${API_BASE}/files?dossier_id=${dossier.id}`, { headers });
            
            if (filesResponse.data.files && filesResponse.data.files.length > 0) {
              const firstFile = filesResponse.data.files[0];
              
              try {
                const downloadResponse = await axios.get(`${API_BASE}/files/download/${firstFile.id}`, { 
                  headers,
                  timeout: 5000
                });
                
                testResults.push({
                  user: user.role,
                  test: `Téléchargement fichier ${dossier.name}`,
                  status: 'success', 
                  message: `✅ Téléchargement réussi`,
                  expected: 'success',
                  passed: true
                });
                
                console.log(`✅ ${user.name} peut télécharger les fichiers du ${dossier.name}`);
              } catch (downloadError) {
                testResults.push({
                  user: user.role,
                  test: `Téléchargement fichier ${dossier.name}`,
                  status: 'error',
                  message: `❌ Erreur téléchargement: ${downloadError.response?.data?.error || downloadError.message}`,
                  expected: 'success',
                  passed: false
                });
                
                console.log(`❌ ${user.name} ne peut pas télécharger les fichiers du ${dossier.name}: ${downloadError.response?.data?.error || downloadError.message}`);
              }
            } else {
              console.log(`ℹ️ Aucun fichier trouvé dans ${dossier.name} pour tester le téléchargement`);
            }
          } catch (filesError) {
            console.log(`⚠️ ${user.name} ne peut pas lister les fichiers du ${dossier.name}: ${filesError.response?.data?.error || filesError.message}`);
          }
          
        } catch (dossierError) {
          const isExpectedError = user.role !== 'admin' && 
            (dossier.expectedMachine === 'roland' && user.role === 'imprimeur_xerox' ||
             dossier.expectedMachine === 'xerox' && user.role === 'imprimeur_roland');
            
          testResults.push({
            user: user.role,
            test: `Accès dossier ${dossier.name}`,
            status: 'error',
            message: `❌ Accès refusé: ${dossierError.response?.data?.error || dossierError.message}`,
            expected: isExpectedError ? 'error' : 'success',
            passed: isExpectedError
          });
          
          if (isExpectedError) {
            console.log(`✅ ${user.name} correctement bloqué pour ${dossier.name} (comportement attendu)`);
          } else {
            console.log(`❌ ${user.name} ne peut pas accéder au ${dossier.name}: ${dossierError.response?.data?.error || dossierError.message}`);
          }
        }
      }
      
    } catch (loginError) {
      testResults.push({
        user: user.role,
        test: 'Connexion',
        status: 'error',
        message: `❌ Connexion échouée: ${loginError.response?.data?.error || loginError.message}`,
        expected: 'success',
        passed: false
      });
      
      console.log(`❌ Connexion échouée pour ${user.name}: ${loginError.response?.data?.error || loginError.message}`);
    }
  }
  
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: testResults.length,
    passed: testResults.filter(r => r.passed).length,
    failed: testResults.filter(r => !r.passed).length,
    passRate: Math.round((testResults.filter(r => r.passed).length / testResults.length) * 100),
    results: testResults
  };
  
  // Sauvegarder le rapport
  await fs.writeFile(TEST_REPORT_PATH, JSON.stringify(summary, null, 2));
  
  console.log('\n📊 RÉSUMÉ DU TEST RÉEL:');
  console.log(`Tests passés: ${summary.passed}/${summary.totalTests} (${summary.passRate}%)`);
  console.log(`Rapport sauvé: ${TEST_REPORT_PATH}`);
  
  if (summary.failed > 0) {
    console.log('\n❌ Échecs détectés:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.user}: ${r.test} - ${r.message}`);
    });
  }
  
  return summary;
};

// Exécuter le test
if (require.main === module) {
  testRealPermissions()
    .then(() => {
      console.log('\n🎉 Test réel terminé');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Erreur durant le test réel:', error);
      process.exit(1);
    });
}

module.exports = { testRealPermissions };