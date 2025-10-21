#!/usr/bin/env node

/**
 * TEST SIMPLE: Vérifier que l'application frontend utilise la vraie API
 */

const axios = require('axios');

async function testFrontendAPI() {
  console.log('🔍 Test: Vérification de l\'API utilisée par le frontend\n');
  
  try {
    // Test de l'endpoint health du backend
    const backendResponse = await axios.get('http://localhost:5002/api/health');
    console.log('✅ Backend accessible:', backendResponse.data);
    
    // Si vous avez le frontend qui tourne, testez une requête typique
    console.log('\n💡 POUR TESTER LE FRONTEND:');
    console.log('1. Ouvrez votre navigateur sur http://localhost:3002 (ou le port utilisé)');
    console.log('2. Ouvrez les outils de développement (F12)');
    console.log('3. Allez dans l\'onglet Console');
    console.log('4. Cliquez sur un bouton d\'action sur un dossier');
    console.log('5. Vérifiez le message d\'erreur affiché');
    console.log('');
    console.log('✅ Si vous voyez: "Ce dossier n\'existe pas..." → API VRAIE utilisée');
    console.log('❌ Si vous voyez: "Dossier non trouvé" → API MOCK utilisée');
    
    console.log('\n🔧 Si l\'API MOCK est utilisée, ajoutez ceci dans frontend/.env:');
    console.log('REACT_APP_USE_REAL_API=true');
    console.log('REACT_APP_API_URL=http://localhost:5002/api');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFrontendAPI();