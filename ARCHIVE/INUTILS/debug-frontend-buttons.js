#!/usr/bin/env node
/**
 * Debug: Test des boutons frontend en simulant les appels API
 * Reproduit le problème "dossier non trouvé" lors des clics de boutons
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function debugFrontendButtons() {
  console.log('🔧 DEBUG: Simulation des clics de boutons frontend\n');

  try {
    // 1. Authentification admin
    console.log('1️⃣ Connexion admin...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });

    if (!loginResponse.data?.token) {
      throw new Error('Échec connexion admin - pas de token');
    }

    const token = loginResponse.data.token;
    console.log('   ✅ Admin connecté');

    // 2. Récupérer la liste des dossiers (comme l'interface)
    console.log('\n2️⃣ Récupération des dossiers...');
    const dossiersResponse = await axios.get(`${API_BASE}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`   📁 ${dossiersResponse.data.dossiers.length} dossiers trouvés`);
    
    // Afficher tous les dossiers pour voir leurs statuts
    console.log('\n📋 Liste des dossiers disponibles:');
    dossiersResponse.data.dossiers.forEach((d, i) => {
      console.log(`   ${i+1}. ${d.id.substring(0,8)}... - ${d.client} - Statut: ${d.statut} - Validé: ${d.valide_preparateur}`);
    });

    if (dossiersResponse.data.dossiers.length === 0) {
      console.log('⚠️ Aucun dossier pour tester les boutons');
      return;
    }

    // 3. Prendre un dossier à revoir ou en cours (pas livré)
    const testDossier = dossiersResponse.data.dossiers.find(d => 
      d.statut === 'a_revoir'
    ) || dossiersResponse.data.dossiers.find(d => 
      d.statut === 'en_cours'
    ) || dossiersResponse.data.dossiers.find(d => 
      ['En cours', 'À revoir', 'En impression'].includes(d.statut)
    ) || dossiersResponse.data.dossiers[0];
    console.log(`\n3️⃣ Test sur dossier: ${testDossier.id.substring(0, 8)}...`);
    console.log(`   Client: ${testDossier.client}`);
    console.log(`   Statut: ${testDossier.statut}`);
    console.log(`   Validé préparateur: ${testDossier.valide_preparateur || 'false'}`);

    // 4. Tester l'accès aux détails (comme quand on clique sur un dossier)
    console.log('\n4️⃣ Test accès détails dossier...');
    try {
      const detailsResponse = await axios.get(`${API_BASE}/dossiers/${testDossier.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('   ✅ Accès détails: OK');
      console.log(`   Dossier chargé: ${detailsResponse.data.dossier?.client || 'N/A'}`);
    } catch (detailsError) {
      console.log('   ❌ Erreur accès détails:');
      console.log(`      Status: ${detailsError.response?.status}`);
      console.log(`      Message: ${detailsError.response?.data?.message}`);
      console.log(`      URL: ${detailsError.config?.url}`);
      return;
    }

    // 5. Tester les actions admin selon le statut actuel
    console.log('\n5️⃣ Test des actions admin...');

    const actions = [];
    
    // Selon le statut actuel, déterminer les actions possibles
    console.log(`   🔍 Statut exact du dossier: "${testDossier.statut}"`);
    switch (testDossier.statut) {
      case 'en_cours':
      case 'En cours':
        actions.push({ label: 'Marquer à revoir', status: 'a_revoir', requires_comment: true });
        actions.push({ label: 'Valider pour impression', status: 'en_impression' });
        break;
      case 'a_revoir':
      case 'À revoir':
        actions.push({ label: 'Remettre en cours', status: 'en_cours' });
        actions.push({ label: 'Valider pour impression', status: 'en_impression' });
        break;
      case 'en_impression':
      case 'En impression':
        actions.push({ label: 'Marquer terminé', status: 'termine' });
        actions.push({ label: 'Remettre à revoir', status: 'a_revoir', requires_comment: true });
        break;
      case 'termine':
      case 'Terminé':
        actions.push({ label: 'Programmer livraison', status: 'en_livraison' });
        break;
    }

    console.log(`   Actions possibles: ${actions.length}`);

    // 6. Tester chaque action
    for (let i = 0; i < actions.length && i < 2; i++) { // Limiter à 2 tests
      const action = actions[i];
      console.log(`\n6️⃣.${i+1} Test action: ${action.label}`);
      
      try {
        // Simuler l'appel API frontend -> backend
        const payload = {
          nouveau_statut: {
            'en_cours': 'En cours',
            'a_revoir': 'À revoir', 
            'en_impression': 'En impression',
            'termine': 'Terminé',
            'en_livraison': 'En livraison'
          }[action.status] || action.status,
          commentaire: action.requires_comment ? 'Test de changement de statut' : null
        };

        console.log(`   📡 PUT /dossiers/${testDossier.id}/statut`);
        console.log(`   📦 Payload:`, JSON.stringify(payload, null, 2));

        const actionResponse = await axios.put(
          `${API_BASE}/dossiers/${testDossier.id}/statut`, 
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (actionResponse.data?.success) {
          console.log(`   ✅ Action réussie: ${action.label}`);
          console.log(`   📄 Nouveau statut: ${actionResponse.data.dossier?.statut}`);
        } else {
          console.log(`   ⚠️ Action échouée (pas de success=true)`);
        }

      } catch (actionError) {
        console.log(`   ❌ ERREUR lors de l'action "${action.label}":`);
        console.log(`      Status HTTP: ${actionError.response?.status}`);
        console.log(`      Message: ${actionError.response?.data?.message}`);
        console.log(`      Code: ${actionError.response?.data?.code}`);
        console.log(`      URL: ${actionError.config?.url}`);
        
        if (actionError.response?.data?.message?.includes('non trouvé')) {
          console.log('   🔍 BINGO! Voici l\'erreur "dossier non trouvé"');
          console.log('      Analysons les détails...');
          console.log(`      Dossier ID utilisé: ${testDossier.id}`);
          console.log(`      Token valide: ${!!token}`);
          console.log(`      Headers envoyés:`, actionError.config?.headers || 'N/A');
        }
      }

      // Petite pause entre les tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 7. Test spécifique validateDossier si pas encore validé
    if (!testDossier.valide_preparateur) {
      console.log('\n7️⃣ Test validateDossier (route spécifique)...');
      try {
        const validateResponse = await axios.put(
          `${API_BASE}/dossiers/${testDossier.id}/valider`,
          { commentaire: 'Test validation' },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('   ✅ Validation réussie');
      } catch (validateError) {
        console.log('   ❌ Erreur validation:');
        console.log(`      Status: ${validateError.response?.status}`);
        console.log(`      Message: ${validateError.response?.data?.message}`);
      }
    }

    console.log('\n✅ Tests terminés!');

  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
    
    if (error.response) {
      console.error('📋 Détails erreur:');
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   URL:', error.config?.url || 'N/A');
    }
  }
}

// Test direct si appelé en ligne de commande
if (require.main === module) {
  debugFrontendButtons().then(() => process.exit(0)).catch(err => {
    console.error('💥 Erreur fatale:', err);
    process.exit(1);
  });
}

module.exports = { debugFrontendButtons };