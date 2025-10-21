#!/usr/bin/env node

/**
 * Test du bouton "Remettre en impression" pour admin
 * Vérifie la transition COMPLETED → IN_PROGRESS (termine → en_impression)
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Test la transition "Remettre en impression"
async function testRemettreEnImpression() {
  console.log('🔧 TEST: Bouton "Remettre en impression" (Admin)');
  console.log('=' * 50);

  // 1. Login admin
  console.log('1️⃣ Connexion admin...');
  try {
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    console.log('✅ Login admin réussi');
    
    // 2. Test de la route PATCH /status avec la transition termine → en_impression
    const dossierId = '0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1';
    
    console.log('\n2️⃣ Test transition "Remettre en impression"...');
    console.log('   Statut actuel: termine (COMPLETED)');
    console.log('   Nouveau statut: en_impression (IN_PROGRESS)');
    console.log('   Action: "◀️ Remettre en impression"');
    
    try {
      const statusResponse = await axios.patch(
        `${BASE_URL}/dossiers/${dossierId}/status`,
        {
          status: 'en_impression',
          comment: 'Test remettre en impression depuis admin'
        },
        { headers }
      );
      
      console.log('✅ Transition réussie !');
      console.log('   Nouvelle données dossier:');
      console.log(`   - Statut: ${statusResponse.data.dossier?.statut || statusResponse.data.statut || 'Non défini'}`);
      console.log(`   - Commentaire: ${statusResponse.data.message || 'Aucun'}`);
      
    } catch (error) {
      console.log('❌ Échec de la transition:');
      console.log(`   Erreur: ${error.response?.data?.message || error.message}`);
      console.log(`   Détails: ${JSON.stringify(error.response?.data, null, 2)}`);
      
      // Si c'est un problème de permission, on l'indique
      if (error.response?.status === 403) {
        console.log('   💡 Problème de permission détecté');
      } else if (error.response?.status === 404) {
        console.log('   💡 Dossier non trouvé - vérifiez l\'ID');
      }
    }
    
    // 3. Test de récupération du dossier pour voir l'état actuel
    console.log('\n3️⃣ Vérification état actuel du dossier...');
    try {
      const dossierResponse = await axios.get(`${BASE_URL}/dossiers/${dossierId}`, { headers });
      console.log(`   Statut actuel: ${dossierResponse.data.dossier?.statut || dossierResponse.data.statut}`);
      
      // 4. Test des transitions possibles selon le workflow
      console.log('\n4️⃣ Transitions possibles selon workflow:');
      console.log('   Depuis COMPLETED (termine):');
      console.log('   - ✅ Status.IN_PROGRESS (en_impression) ← "Remettre en impression"');
      console.log('   - ✅ Status.IN_DELIVERY (en_livraison) ← "Prendre en livraison"');
      console.log('');
      console.log('   Configuration ACTION_LABELS:');
      console.log('   - [Status.COMPLETED][Status.IN_PROGRESS]: "◀️ Remettre en impression"');
      console.log('   - [Status.COMPLETED][Status.IN_DELIVERY]: "🚚 Prendre en livraison"');
      
    } catch (error) {
      console.log(`   ❌ Impossible de récupérer le dossier: ${error.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Échec login admin: ${error.response?.data?.message || error.message}`);
    return;
  }
  
  // 5. Résumé du diagnostic
  console.log('\n📋 DIAGNOSTIC:');
  console.log('   Si la transition échoue, les causes possibles sont:');
  console.log('   1. Permission insuffisante (doit utiliser permission "change_status")');
  console.log('   2. Statut mapping incorrect (termine ≠ en_impression dans le backend)');
  console.log('   3. Validation workflow côté serveur bloque la transition');
  console.log('   4. Fonction handleStatusChange non correctement connectée à PATCH /status');
  console.log('');
  console.log('   Solution attendue:');
  console.log('   ✅ Admin doit pouvoir faire: termine → en_impression via PATCH /status');
  console.log('   ✅ Bouton "◀️ Remettre en impression" doit appeler handleStatusChange("en_impression")');
  console.log('   ✅ Service changeStatus doit utiliser PATCH /status (déjà corrigé)');
}

async function checkServerHealth() {
  try {
    await axios.get(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    console.log('❌ Serveur backend non accessible');
    console.log('   Démarrez avec: cd backend && node server.js');
    return false;
  }
}

async function main() {
  console.log('🧪 TEST DIAGNOSTIC - BOUTON "REMETTRE EN IMPRESSION"');
  console.log('Objectif: Vérifier que l\'admin peut faire la transition termine → en_impression');
  console.log('');
  
  if (!(await checkServerHealth())) {
    process.exit(1);
  }
  
  await testRemettreEnImpression();
  
  console.log('\n🎯 CONCLUSION:');
  console.log('Le bouton "Remettre en impression" doit permettre à l\'admin de');
  console.log('repasser un dossier terminé en statut d\'impression active.');
  console.log('');
  console.log('Workflow: COMPLETED → IN_PROGRESS (termine → en_impression)');
  console.log('Route API: PATCH /dossiers/:id/status avec permission "change_status"');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Erreur:', error.message);
    process.exit(1);
  });
}

module.exports = { testRemettreEnImpression };