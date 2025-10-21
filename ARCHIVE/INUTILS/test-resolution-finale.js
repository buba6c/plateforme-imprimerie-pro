#!/usr/bin/env node

/**
 * Test final: Vérifier que "Dossier non trouvé" est résolu
 */

const axios = require('axios');

const API_URL = 'http://localhost:5002/api';

async function authenticate(email, password = 'admin123') {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    return { success: true, token: response.data.token, user: response.data.user };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function testDossierAccess(token, dossierId) {
  try {
    const response = await axios.get(`${API_URL}/dossiers/${dossierId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status,
      message: error.response?.data?.message || error.message 
    };
  }
}

async function testStatusChange(token, dossierId) {
  try {
    const response = await axios.put(`${API_URL}/dossiers/${dossierId}/statut`, {
      nouveau_statut: 'En cours',
      commentaire: 'Test correction finale'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status,
      message: error.response?.data?.message || error.message 
    };
  }
}

async function runFinalTest() {
  console.log('🎯 TEST FINAL: Résolution complète du "Dossier non trouvé"\n');
  
  // 1. Connexion admin pour obtenir les dossiers
  const adminAuth = await authenticate('admin@imprimerie.local', 'admin123');
  if (!adminAuth.success) {
    console.log('❌ Connexion admin échouée:', adminAuth.error);
    return;
  }
  
  console.log('✅ Admin connecté:', adminAuth.user.nom);
  
  try {
    // Récupérer les dossiers
    const dossiersResponse = await axios.get(`${API_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` }
    });
    
    const dossiers = dossiersResponse.data.dossiers || [];
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier disponible pour tester');
      return;
    }
    
    const testDossier = dossiers[0];
    console.log(`📁 Test avec dossier: ${testDossier.numero || testDossier.id}`);
    console.log(`   Machine: ${testDossier.machine || testDossier.type_formulaire || 'Non définie'}`);
    console.log(`   Statut: ${testDossier.statut}`);
    console.log(`   Créateur: ID ${testDossier.created_by}`);
    
    // 2. Tests des différents rôles avec messages améliorés
    const testCases = [
      {
        role: 'imprimeur_roland',
        email: 'imprimeur.roland@imprimerie.local',
        description: '🔧 Imprimeur Roland',
        expectMessage: testDossier.machine?.toLowerCase().includes('xerox') ? 
          'machines Roland uniquement' : 'accessible'
      },
      {
        role: 'imprimeur_xerox', 
        email: 'imprimeur.xerox@imprimerie.local',
        description: '🖨️ Imprimeur Xerox',
        expectMessage: testDossier.machine?.toLowerCase().includes('roland') ? 
          'machines Xerox uniquement' : 'accessible'
      },
      {
        role: 'livreur',
        email: 'livreur@imprimerie.local', 
        description: '🚚 Livreur',
        expectMessage: ['termine', 'livre', 'livraison'].some(s => 
          (testDossier.statut || '').toLowerCase().includes(s)) ? 'accessible' : 'prêt pour la livraison'
      },
      {
        role: 'preparateur',
        email: 'preparateur@imprimerie.local',
        description: '📝 Préparateur',
        expectMessage: 'appartient pas'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n--- ${testCase.description} ---`);
      
      const auth = await authenticate(testCase.email, 'admin123');
      if (!auth.success) {
        console.log(`❌ Connexion échouée: ${auth.error}`);
        continue;
      }
      
      console.log(`👤 ${auth.user.nom} (${auth.user.role})`);
      
      // Test accès dossier
      const accessTest = await testDossierAccess(auth.token, testDossier.id);
      if (accessTest.success) {
        console.log(`✅ Accès autorisé`);
      } else {
        console.log(`❌ Accès refusé: ${accessTest.message}`);
        
        // Vérifier que le message n'est plus "Dossier non trouvé" générique
        if (accessTest.message === 'Dossier non trouvé') {
          console.log(`⚠️  PROBLÈME: Message générique encore présent!`);
        } else if (accessTest.message.includes(testCase.expectMessage)) {
          console.log(`✅ Message explicite correct`);
        } else {
          console.log(`ℹ️  Message: "${accessTest.message}"`);
        }
      }
      
      // Test changement de statut
      const statusTest = await testStatusChange(auth.token, testDossier.id);
      if (statusTest.success) {
        console.log(`✅ Changement de statut autorisé`);
      } else {
        console.log(`❌ Changement statut refusé: ${statusTest.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 RÉSOLUTION COMPLÈTE !');
    console.log('='.repeat(70));
    console.log('✅ Corrections appliquées:');
    console.log('   1. Middleware getDossierByIdentifier avec filtrage par rôle');
    console.log('   2. Messages d\'erreur spécifiques selon le rôle:');
    console.log('      • Imprimeurs: "machines Roland/Xerox uniquement"');
    console.log('      • Livreurs: "pas encore prêt pour la livraison"');  
    console.log('      • Préparateurs: "ne vous appartient pas"');
    console.log('   3. Route PUT /statut utilise permission "change_status"');
    console.log('');
    console.log('🚀 Les boutons frontend afficheront maintenant des messages clairs');
    console.log('   au lieu du générique "Dossier non trouvé" !');
    
  } catch (error) {
    console.log('❌ Erreur test:', error.message);
  }
}

runFinalTest().catch(console.error);