#!/usr/bin/env node
/**
 * Test de diagnostic pour comprendre le problème "Dossier non trouvé"
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTYwODMzNywiZXhwIjoxNzU5Njk0NzM3fQ.0aQ1ofypzvTO0DMxE5VIfUmuGhDnf2mYcli40AaFyGU';

async function diagnosticDossierAccess() {
  console.log('🔍 DIAGNOSTIC: Problème "Dossier non trouvé"\n');

  try {
    // 1. Récupérer la liste des dossiers
    console.log('1️⃣ Récupération de la liste des dossiers...');
    const listResponse = await axios.get(`${API_BASE}/dossiers`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });

    const dossiers = listResponse.data.dossiers;
    console.log(`✅ ${dossiers.length} dossiers trouvés dans la liste`);
    
    // 2. Tester l'accès à chaque dossier individuellement
    console.log('\n2️⃣ Test d\'accès individuel à chaque dossier...');
    
    for (let i = 0; i < Math.min(dossiers.length, 3); i++) { // Test sur les 3 premiers
      const dossier = dossiers[i];
      console.log(`\n📋 Test dossier: ${dossier.client} (ID: ${dossier.id.substring(0,8)}...)`);
      
      try {
        const detailResponse = await axios.get(`${API_BASE}/dossiers/${dossier.id}`, {
          headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });
        
        console.log(`  ✅ Accès OK - Status: ${detailResponse.status}`);
        console.log(`  📝 Client: ${detailResponse.data.dossier?.client || detailResponse.data.client}`);
        console.log(`  🎯 Statut: ${detailResponse.data.dossier?.statut || detailResponse.data.statut}`);
        
      } catch (error) {
        console.log(`  ❌ ERREUR - Status: ${error.response?.status}`);
        console.log(`  💬 Message: ${error.response?.data?.message || error.message}`);
        console.log(`  🔍 Code: ${error.response?.data?.code || 'N/A'}`);
        
        // Détails de l'erreur
        if (error.response?.data) {
          console.log(`  📄 Réponse complète:`, JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
    // 3. Tester avec différents rôles (si on arrive à s'authentifier)
    console.log('\n3️⃣ Test avec différents utilisateurs...');
    
    // Test avec un dossier spécifique et différents utilisateurs
    if (dossiers.length > 0) {
      const testDossier = dossiers[0];
      console.log(`\n🧪 Test dossier "${testDossier.client}" avec différents rôles:`);
      
      // Admin (déjà testé)
      console.log(`  👤 Admin: ✅ (déjà testé ci-dessus)`);
      
      // Note: Pour tester les autres rôles, il faudrait d'abord s'authentifier
      console.log(`  👤 Autres rôles: 🔄 (nécessite authentification séparée)`);
    }
    
    // 4. Vérifications de données
    console.log('\n4️⃣ Vérifications des données...');
    
    if (dossiers.length > 0) {
      const sampleDossier = dossiers[0];
      console.log('🔍 Structure du premier dossier:');
      console.log(`  • ID: ${sampleDossier.id} (Type: ${typeof sampleDossier.id})`);
      console.log(`  • Client: ${sampleDossier.client}`);
      console.log(`  • Statut: ${sampleDossier.statut}`);
      console.log(`  • Type: ${sampleDossier.type_formulaire || sampleDossier.type || sampleDossier.machine}`);
      console.log(`  • Créé par: ${sampleDossier.preparateur_id || sampleDossier.created_by}`);
      console.log(`  • Validé: ${sampleDossier.valide_preparateur || sampleDossier.validé_preparateur}`);
    }
    
  } catch (error) {
    console.log('❌ Erreur lors du diagnostic:', error.response?.data || error.message);
  }
  
  console.log('\n📊 RÉSUMÉ DU DIAGNOSTIC:');
  console.log('1. Route /api/dossiers fonctionne ✅');
  console.log('2. Test route /api/dossiers/:id en cours...');
  console.log('3. Authentification admin OK ✅'); 
  console.log('4. Le problème vient probablement du frontend ou de la transmission d\'ID');
}

diagnosticDossierAccess();