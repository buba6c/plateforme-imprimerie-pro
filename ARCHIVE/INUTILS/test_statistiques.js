#!/usr/bin/env node

/**
 * Script de test pour l'onglet Statistiques
 * Teste tous les endpoints et vérifie le bon fonctionnement
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

// Token d'authentification (à remplacer par un vrai token)
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMzQyNjc4NSwiZXhwIjoxNzM0MDMxNTg1fQ.rXcD8L6gtaqQw2t-s1Pcx8VYfkUiaW8bGTvTzRoY9OY';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testStatistics() {
  console.log('🚀 Test de l\'onglet Statistiques');
  console.log('===============================\n');

  const tests = [
    {
      name: 'Dashboard complet',
      url: '/statistiques/dashboard?periode=month',
      expected: ['statistiques_generales', 'performances_utilisateurs', 'evolution_dossiers']
    },
    {
      name: 'Statistiques générales',
      url: '/statistiques/generales?periode=week',
      expected: ['total_dossiers', 'taux_reussite', 'chiffre_affaires']
    },
    {
      name: 'Performances utilisateurs',
      url: '/statistiques/performances?periode=month',
      expected: []
    },
    {
      name: 'Évolution des dossiers',
      url: '/statistiques/evolution?periode=month',
      expected: []
    },
    {
      name: 'Répartition machines',
      url: '/statistiques/machines?periode=month',
      expected: []
    },
    {
      name: 'Alertes',
      url: '/statistiques/alertes',
      expected: ['dossiers_a_revoir', 'dossiers_urgents_en_retard']
    },
    {
      name: 'Résumé rapide',
      url: '/statistiques/summary',
      expected: ['dossiers_actifs', 'nouveaux_aujourd_hui']
    },
  ];

  let successCount = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`📊 Test: ${test.name}`);
      
      const startTime = Date.now();
      const response = await apiClient.get(test.url);
      const responseTime = Date.now() - startTime;
      
      if (response.data.success) {
        console.log(`  ✅ Succès (${responseTime}ms)`);
        
        if (test.expected.length > 0) {
          const data = response.data.data;
          let hasAllFields = true;
          
          for (const field of test.expected) {
            if (!(field in data)) {
              console.log(`  ⚠️  Champ manquant: ${field}`);
              hasAllFields = false;
            }
          }
          
          if (hasAllFields) {
            console.log(`  ✅ Tous les champs requis sont présents`);
          }
        }
        
        // Afficher un aperçu des données
        if (response.data.data) {
          const preview = JSON.stringify(response.data.data, null, 2).slice(0, 200);
          console.log(`  📋 Aperçu: ${preview}${preview.length >= 200 ? '...' : ''}`);
        }
        
        successCount++;
      } else {
        console.log(`  ❌ Échec: ${response.data.message}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.response?.data?.message || error.message}`);
      if (error.response?.status === 401) {
        console.log(`  🔑 Authentification requise - Vérifiez le token`);
      }
    }
    
    console.log('');
  }

  // Test de performance et charge
  console.log('⚡ Test de performance');
  console.log('====================\n');
  
  try {
    const startTime = Date.now();
    const promises = Array.from({ length: 5 }, () => 
      apiClient.get('/statistiques/dashboard?periode=today')
    );
    
    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ 5 requêtes simultanées en ${totalTime}ms (moyenne: ${Math.round(totalTime/5)}ms)`);
  } catch (error) {
    console.log(`❌ Test de performance échoué: ${error.message}`);
  }

  // Résumé
  console.log('\n📈 Résumé des tests');
  console.log('==================');
  console.log(`Tests réussis: ${successCount}/${totalTests}`);
  console.log(`Taux de réussite: ${Math.round((successCount/totalTests) * 100)}%`);
  
  if (successCount === totalTests) {
    console.log('🎉 Tous les tests sont passés ! L\'onglet Statistiques est fonctionnel.');
  } else {
    console.log('⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.');
  }
}

// Test de la connexion initiale
async function testConnection() {
  try {
    const response = await apiClient.get('/auth/me');
    if (response.data.success) {
      console.log(`👤 Connecté en tant que: ${response.data.data.nom} (${response.data.data.role})`);
      return true;
    }
  } catch (error) {
    console.log('❌ Échec de l\'authentification');
    console.log('🔑 Assurez-vous d\'être connecté et d\'avoir un token valide');
    return false;
  }
}

// Exécuter les tests
async function main() {
  console.log('🔧 Vérification de la connexion...\n');
  
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('\n💡 Pour obtenir un token valide:');
    console.log('1. Connectez-vous sur http://localhost:3000');
    console.log('2. Ouvrez les outils de développement (F12)');
    console.log('3. Allez dans Application > Local Storage');
    console.log('4. Copiez la valeur de "auth_token"');
    console.log('5. Remplacez AUTH_TOKEN dans ce script');
    return;
  }
  
  console.log('');
  await testStatistics();
}

main().catch(console.error);