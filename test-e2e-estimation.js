#!/usr/bin/env node

/**
 * TEST E2E - ESTIMATION EN TEMPS RÉEL
 * Teste plusieurs configurations pour vérifier que tout fonctionne
 */

const axios = require('axios');
const { mapRolandSupport, mapXeroxDocument } = require('./backend/utils/tariffMapping');

const API_URL = 'http://localhost:5001/api';

const TESTS = [
  {
    name: 'Roland - Bâche 200x300cm',
    machineType: 'roland',
    formData: {
      type_support: 'Bâche',
      largeur: 200,
      hauteur: 300,
      unite: 'cm',
      nombre_exemplaires: 1,
    },
    expectedMin: 40000,
    expectedMax: 45000,
  },
  {
    name: 'Roland - Vinyle 150x100cm',
    machineType: 'roland',
    formData: {
      type_support: 'Vinyle',
      largeur: 150,
      hauteur: 100,
      unite: 'cm',
      nombre_exemplaires: 2,
    },
    expectedMin: 28500,
    expectedMax: 32000,
  },
  {
    name: 'Roland - Tissu 1m x 0.5m',
    machineType: 'roland',
    formData: {
      type_support: 'Tissu',
      largeur: 1,
      hauteur: 0.5,
      unite: 'm',
      nombre_exemplaires: 1,
    },
    expectedMin: 5000,
    expectedMax: 7000,
  },
];

async function runTest(test) {
  try {
    const response = await axios.post(
      `${API_URL}/devis/estimate-realtime`,
      {
        formData: test.formData,
        machineType: test.machineType
      }
    );

    const { prix_estime } = response.data;
    const isValid = prix_estime >= test.expectedMin && prix_estime <= test.expectedMax;

    return {
      ...test,
      price: prix_estime,
      isValid,
      status: isValid ? '✅ PASS' : '❌ FAIL',
    };
  } catch (error) {
    return {
      ...test,
      price: null,
      isValid: false,
      status: '❌ ERROR',
      error: error.message,
    };
  }
}

async function main() {
  console.log('\n🧪 === TEST E2E ESTIMATION TEMPS RÉEL ===\n');

  const results = [];

  for (const test of TESTS) {
    console.log(`⏳ Test: ${test.name}`);
    const result = await runTest(test);
    results.push(result);

    if (result.status === '✅ PASS') {
      console.log(`   ${result.status} - Prix: ${result.price.toLocaleString()} FCFA`);
    } else {
      console.log(`   ${result.status} - Prix: ${result.price} FCFA (attendu: ${test.expectedMin}-${test.expectedMax})`);
      if (result.error) console.log(`   Erreur: ${result.error}`);
    }
  }

  console.log('\n📊 === RÉSUMÉ ===\n');

  const passed = results.filter(r => r.isValid).length;
  const total = results.length;

  console.log(`Réussis: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n✅ TOUS LES TESTS SONT PASSÉS!');
    process.exit(0);
  } else {
    console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ');
    process.exit(1);
  }
}

main();
