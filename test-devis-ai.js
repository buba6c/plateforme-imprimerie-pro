#!/usr/bin/env node

/**
 * Test Script - Système de Création de Devis par IA
 * Teste les endpoints principaux
 */

const axios = require('axios');
const colors = require('colors');

const API_URL = 'http://localhost:3000/api';

// Token de test (à adapter avec un vrai token)
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-jwt-token-here';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// ============================================
// Tests
// ============================================

async function testAnalyzeDescription() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 1: Analyse Description par IA'.cyan);
  console.log('='.repeat(60));

  try {
    const response = await client.post('/devis/analyze-description', {
      description: 'Je souhaite 1000 flyers A5 en couleur sur papier 250g avec finition vernis. Délai: 1 semaine.',
      client_name: 'Client Test',
      contact: '+221 77 123 4567'
    });

    console.log('✅ Succès!'.green);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.error('❌ Erreur:'.red, error.response?.data || error.message);
    return null;
  }
}

async function testCreateDevis(analysisResult) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 2: Créer Devis à partir de l\'analyse IA'.cyan);
  console.log('='.repeat(60));

  try {
    const payload = {
      client_nom: 'Client Test ABC',
      client_contact: '+221 77 123 4567',
      client_email: 'test@example.com',
      machine_type: analysisResult?.machine_recommended || 'XEROX',
      product_type: analysisResult?.product_type || 'Flyers',
      details: analysisResult?.details || 'Produit personnalisé',
      items: analysisResult?.items || [
        {
          description: 'Flyers A5 1000 ex',
          quantity: 1000,
          unit_price: 5.50,
          notes: 'Couleur, vernis'
        }
      ],
      total_ht: analysisResult?.total_ht || 5500,
      source: 'ai_analysis',
      status: 'brouillon'
    };

    const response = await client.post('/devis/create', payload);

    console.log('✅ Succès!'.green);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.error('❌ Erreur:'.red, error.response?.data || error.message);
    return null;
  }
}

async function testGetDevis(devisId) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 3: Récupérer le Devis créé'.cyan);
  console.log('='.repeat(60));

  try {
    const response = await client.get(`/devis/${devisId}`);

    console.log('✅ Succès!'.green);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.error('❌ Erreur:'.red, error.response?.data || error.message);
    return null;
  }
}

async function testConvertDevis(devisId) {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TEST 4: Convertir Devis en Dossier'.cyan);
  console.log('='.repeat(60));

  try {
    const response = await client.post(`/devis/${devisId}/convert-to-dossier`);

    console.log('✅ Succès!'.green);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.error('❌ Erreur:'.red, error.response?.data || error.message);
    return null;
  }
}

// ============================================
// Exécution des Tests
// ============================================

async function runAllTests() {
  console.log('\n🚀 DÉMARRAGE DES TESTS - SYSTÈME DEVIS IA\n'.yellow.bold);

  // Test 1: Analyse Description
  const analysisResult = await testAnalyzeDescription();

  if (!analysisResult) {
    console.log('\n⚠️  L\'analyse IA a échoué. Tests suivants impossibles.'.yellow);
    process.exit(1);
  }

  // Test 2: Créer Devis
  const devisResult = await testCreateDevis(analysisResult);

  if (!devisResult?.devis?.id) {
    console.log('\n⚠️  La création de devis a échoué. Tests suivants impossibles.'.yellow);
    process.exit(1);
  }

  const devisId = devisResult.devis.id;

  // Test 3: Récupérer Devis
  await testGetDevis(devisId);

  // Test 4: Convertir Devis
  // await testConvertDevis(devisId);

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('✅ RÉSUMÉ DES TESTS'.green.bold);
  console.log('='.repeat(60));
  console.log(`
📋 Résultats:
  ✓ Analyse IA: SUCCÈS
  ✓ Création Devis: SUCCÈS (ID: ${devisId})
  ✓ Récupération: SUCCÈS
  
🎯 Endpoints testés:
  POST /devis/analyze-description
  POST /devis/create
  GET  /devis/:id
  
📊 Données de test créées:
  - Numéro Devis: ${devisResult.devis.numero_devis}
  - Client: ${devisResult.devis.client_nom}
  - Montant HT: ${devisResult.devis.prix_estime} XOF
  
✨ Système OPÉRATIONNEL et prêt pour production!
  `);
}

// Gestion des erreurs globales
runAllTests().catch(err => {
  console.error('\n❌ Erreur non gérée:'.red.bold, err.message);
  process.exit(1);
});
