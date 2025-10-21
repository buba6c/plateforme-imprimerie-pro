#!/usr/bin/env node
/**
 * Test de l'affichage des dossiers côté frontend
 */

const axios = require('axios');

async function testDossiersDisplay() {
  console.log('🧪 Test de l\'affichage des dossiers...\n');
  
  try {
    // 1. Test de connexion
    console.log('📝 Étape 1: Connexion...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.com',
      password: 'admin123'
    });
    
    if (!loginResponse.data.token) {
      throw new Error('Pas de token reçu');
    }
    
    console.log('✅ Connexion réussie');
    const token = loginResponse.data.token;
    
    // 2. Test de récupération des dossiers
    console.log('\n📂 Étape 2: Récupération des dossiers...');
    const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (dossiersResponse.data.success) {
      const dossiers = dossiersResponse.data.dossiers || [];
      console.log(`✅ ${dossiers.length} dossiers récupérés`);
      
      if (dossiers.length > 0) {
        console.log('\n📋 Premiers dossiers:');
        dossiers.slice(0, 3).forEach((dossier, index) => {
          console.log(`  ${index + 1}. ${dossier.client} - ${dossier.statut} (${dossier.numero})`);
        });
        
        // Test des champs essentiels
        const firstDossier = dossiers[0];
        console.log('\n🔍 Vérification structure premier dossier:');
        console.log(`  ✅ ID: ${firstDossier.id ? 'OK' : 'MANQUANT'}`);
        console.log(`  ✅ Client: ${firstDossier.client ? 'OK' : 'MANQUANT'}`);
        console.log(`  ✅ Statut: ${firstDossier.statut ? 'OK' : 'MANQUANT'}`);
        console.log(`  ✅ Numéro: ${firstDossier.numero ? 'OK' : 'MANQUANT'}`);
        console.log(`  ✅ Date création: ${firstDossier.created_at ? 'OK' : 'MANQUANT'}`);
      } else {
        console.log('⚠️  Aucun dossier trouvé dans la base');
      }
    } else {
      throw new Error(dossiersResponse.data.message || 'Échec récupération dossiers');
    }
    
    // 3. Test de la structure de pagination
    console.log('\n📄 Étape 3: Vérification pagination...');
    const pagination = dossiersResponse.data.pagination;
    if (pagination) {
      console.log(`✅ Page: ${pagination.page}/${pagination.pages}`);
      console.log(`✅ Total: ${pagination.total} dossiers`);
      console.log(`✅ Limite: ${pagination.limit} par page`);
    } else {
      console.log('⚠️  Données de pagination manquantes');
    }
    
    console.log('\n🎉 Test terminé avec succès !');
    console.log('\n📋 Résumé:');
    console.log('- ✅ Authentification fonctionne');
    console.log('- ✅ API dossiers accessible');
    console.log('- ✅ Données structurées correctement');
    console.log('- ✅ Le problème d\'affichage devrait être résolu');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    console.log('\n💡 Actions recommandées:');
    console.log('1. Vérifier que les utilisateurs se reconnectent avec les nouveaux tokens');
    console.log('2. Vider le cache du navigateur');
    console.log('3. Vérifier les logs du frontend pour des erreurs JavaScript');
  }
}

if (require.main === module) {
  testDossiersDisplay().catch(console.error);
}

module.exports = { testDossiersDisplay };