#!/usr/bin/env node
/**
 * Test complet des accès par rôle
 * Vérifie que chaque rôle voit/peut agir sur les bons dossiers
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Comptes de test pour chaque rôle - essayons les mots de passe standards
const testAccounts = {
  admin: { email: 'admin@imprimerie.local', password: 'admin123' },
  preparateur: { email: 'preparateur@imprimerie.local', password: 'admin123' },
  imprimeur_roland: { email: 'roland@imprimerie.local', password: 'admin123' },
  imprimeur_xerox: { email: 'xerox@imprimerie.local', password: 'admin123' },
  livreur: { email: 'livreur@imprimerie.local', password: 'admin123' },
};

async function loginAs(role) {
  const account = testAccounts[role];
  if (!account) throw new Error(`Compte non trouvé pour le rôle: ${role}`);
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, account);
    return response.data.token;
  } catch (error) {
    throw new Error(`Échec connexion ${role}: ${error.response?.data?.error || error.message}`);
  }
}

async function getDossiers(token, role) {
  try {
    const response = await axios.get(`${API_BASE}/dossiers?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.dossiers || [];
  } catch (error) {
    console.log(`❌ Erreur récupération dossiers pour ${role}: ${error.response?.data?.message || error.message}`);
    return [];
  }
}

async function getDossierDetails(dossierId, token, role) {
  try {
    const response = await axios.get(`${API_BASE}/dossiers/${dossierId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { success: true, dossier: response.data.dossier || response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      code: error.response?.data?.code
    };
  }
}

async function testRoleAccess(role) {
  console.log(`\n🧪 TEST RÔLE: ${role.toUpperCase()}`);
  console.log('='.repeat(50));
  
  try {
    // 1. Connexion
    const token = await loginAs(role);
    console.log('✅ Connexion réussie');
    
    // 2. Liste des dossiers
    const dossiers = await getDossiers(token, role);
    console.log(`📁 Dossiers visibles: ${dossiers.length}`);
    
    if (dossiers.length > 0) {
      console.log('   Détails des dossiers visibles:');
      dossiers.forEach((d, i) => {
        const type = d.type_formulaire || d.machine || d.type || 'N/A';
        console.log(`   ${i+1}. ${d.client} (${type}) - ${d.statut}`);
      });
    }
    
    // 3. Test d'accès aux détails
    console.log('\n🔍 Test d\'accès aux détails:');
    
    // Tester avec tous les dossiers existants (pas seulement ceux visibles)
    const allDossiersResponse = await axios.post(`${API_BASE}/auth/login`, testAccounts.admin)
      .then(r => axios.get(`${API_BASE}/dossiers?limit=100`, {
        headers: { Authorization: `Bearer ${r.data.token}` }
      }));
    
    const allDossiers = allDossiersResponse.data.dossiers || [];
    
    for (const dossier of allDossiers) {
      const result = await getDossierDetails(dossier.id, token, role);
      const type = dossier.type_formulaire || dossier.machine || dossier.type || 'N/A';
      
      if (result.success) {
        console.log(`   ✅ ${dossier.client} (${type}) - Accès autorisé`);
      } else {
        const statusEmoji = result.status === 403 ? '🚫' : '❌';
        console.log(`   ${statusEmoji} ${dossier.client} (${type}) - ${result.message}`);
      }
    }
    
    return {
      role,
      success: true,
      visibleDossiers: dossiers.length,
      totalDossiers: allDossiers.length
    };
    
  } catch (error) {
    console.log(`❌ Erreur test ${role}: ${error.message}`);
    return {
      role,
      success: false,
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('🚀 TESTS D\'ACCÈS PAR RÔLE');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Tester chaque rôle
  for (const role of Object.keys(testAccounts)) {
    const result = await testRoleAccess(role);
    results.push(result);
    
    // Pause entre les tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Résumé
  console.log('\n📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.role.padEnd(15)} - ${result.visibleDossiers}/${result.totalDossiers} dossiers accessibles`);
    } else {
      console.log(`❌ ${result.role.padEnd(15)} - Échec: ${result.error}`);
    }
  });
  
  // Recommandations
  console.log('\n💡 ANALYSE ATTENDUE:');
  console.log('   👑 admin          - Doit voir TOUS les dossiers (6/6)');
  console.log('   👨‍💼 preparateur     - Doit voir uniquement ses créations');
  console.log('   🖨️  imprimeur_roland - Doit voir dossiers Roland prêts/en impression');
  console.log('   🖨️  imprimeur_xerox  - Doit voir dossiers Xerox prêts/en impression');
  console.log('   🚚 livreur        - Doit voir dossiers terminés/en livraison');
  
  console.log('\n✅ Tests terminés!');
}

// Lancer les tests si appelé directement
if (require.main === module) {
  runAllTests().then(() => process.exit(0)).catch(err => {
    console.error('💥 Erreur fatale:', err);
    process.exit(1);
  });
}

module.exports = { runAllTests, testRoleAccess };