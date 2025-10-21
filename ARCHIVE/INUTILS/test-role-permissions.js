const fs = require('fs').promises;
const path = require('path');

const TEST_REPORT_PATH = path.join(__dirname, 'test-permissions-result.json');

const testRolePermissions = async () => {
  console.log('🧪 Test des permissions par rôle...');
  
  const testResults = [];
  
  // Simuler différents dossiers et utilisateurs
  const testCases = [
    {
      description: 'Admin accède à un dossier Roland',
      user: { id: 1, role: 'admin' },
      dossier: { id: 1, machine: 'Roland Machine', statut: 'en_cours' },
      action: 'view',
      expected: true
    },
    {
      description: 'Imprimeur Roland accède à un dossier Roland',
      user: { id: 2, role: 'imprimeur_roland' },
      dossier: { id: 1, machine: 'Roland Machine', statut: 'en_cours' },
      action: 'view',
      expected: true
    },
    {
      description: 'Imprimeur Roland change statut dossier Roland',
      user: { id: 2, role: 'imprimeur_roland' },
      dossier: { id: 1, machine: 'Roland Machine', statut: 'en_cours' },
      action: 'change_status',
      expected: true
    },
    {
      description: 'Imprimeur Roland télécharge fichier dossier Roland',
      user: { id: 2, role: 'imprimeur_roland' },
      dossier: { id: 1, machine: 'Roland Machine', statut: 'en_cours' },
      action: 'download',
      expected: true
    },
    {
      description: 'Imprimeur Roland accède à un dossier Xerox (lecture seule)',
      user: { id: 2, role: 'imprimeur_roland' },
      dossier: { id: 2, machine: 'Xerox Machine', statut: 'en_cours' },
      action: 'view',
      expected: true
    },
    {
      description: 'Imprimeur Roland ne peut pas changer statut dossier Xerox',
      user: { id: 2, role: 'imprimeur_roland' },
      dossier: { id: 2, machine: 'Xerox Machine', statut: 'en_cours' },
      action: 'change_status',
      expected: false
    },
    {
      description: 'Imprimeur Xerox accède à un dossier Xerox',
      user: { id: 3, role: 'imprimeur_xerox' },
      dossier: { id: 2, machine: 'Xerox Machine', statut: 'en_cours' },
      action: 'view',
      expected: true
    },
    {
      description: 'Imprimeur Xerox télécharge fichier dossier Xerox',
      user: { id: 3, role: 'imprimeur_xerox' },
      dossier: { id: 2, machine: 'Xerox Machine', statut: 'en_cours' },
      action: 'download',
      expected: true
    },
    {
      description: 'Livreur accède à un dossier terminé',
      user: { id: 4, role: 'livreur' },
      dossier: { id: 3, machine: 'Roland Machine', statut: 'termine' },
      action: 'view',
      expected: true
    },
    {
      description: 'Livreur télécharge fichier dossier en livraison',
      user: { id: 4, role: 'livreur' },
      dossier: { id: 3, machine: 'Roland Machine', statut: 'en_livraison' },
      action: 'download',
      expected: true
    },
    {
      description: 'Préparateur accède à tous les dossiers',
      user: { id: 5, role: 'preparateur' },
      dossier: { id: 1, machine: 'Roland Machine', statut: 'en_cours' },
      action: 'view',
      expected: true
    }
  ];
  
  // Charger la fonction canAccessDossier
  const { canAccessDossier } = require('./backend/middleware/permissions');
  
  for (const testCase of testCases) {
    try {
      const result = canAccessDossier(testCase.user, testCase.dossier, testCase.action);
      const passed = result === testCase.expected;
      
      testResults.push({
        ...testCase,
        actualResult: result,
        passed,
        status: passed ? '✅ PASSÉ' : '❌ ÉCHOUÉ'
      });
      
      console.log(`${passed ? '✅' : '❌'} ${testCase.description}: ${result} (attendu: ${testCase.expected})`);
    } catch (error) {
      testResults.push({
        ...testCase,
        actualResult: 'ERROR',
        passed: false,
        status: '❌ ERREUR',
        error: error.message
      });
      
      console.log(`❌ ${testCase.description}: ERREUR - ${error.message}`);
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
  
  console.log('\n📊 RÉSUMÉ DU TEST:');
  console.log(`Tests passés: ${summary.passed}/${summary.totalTests} (${summary.passRate}%)`);
  console.log(`Rapport sauvé: ${TEST_REPORT_PATH}`);
  
  return summary;
};

// Exécuter le test
if (require.main === module) {
  testRolePermissions()
    .then(() => {
      console.log('\n🎉 Test terminé avec succès');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Erreur durant le test:', error);
      process.exit(1);
    });
}

module.exports = { testRolePermissions };