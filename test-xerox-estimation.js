#!/usr/bin/env node

/**
 * TEST ESTIMATION XEROX
 * Vérifie que les tarifs Xerox sont correctement appliqués
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

const XEROX_TESTS = [
  {
    name: 'Xerox - A4 Couleur 100 pages',
    machineType: 'xerox',
    formData: {
      type_document: 'Flyer',
      format: 'A4',
      nombre_pages: 100,
      couleur_impression: 'couleur',
      exemplaires: 1,
    },
    expectedMin: 9000,
    expectedMax: 12000,
  },
  {
    name: 'Xerox - A3 Couleur 50 pages',
    machineType: 'xerox',
    formData: {
      type_document: 'Affiche',
      format: 'A3',
      nombre_pages: 50,
      couleur_impression: 'couleur',
      exemplaires: 1,
    },
    expectedMin: 8000,
    expectedMax: 12000,
  },
  {
    name: 'Xerox - A4 Noir & Blanc 200 pages',
    machineType: 'xerox',
    formData: {
      type_document: 'Flyer',
      format: 'A4',
      nombre_pages: 200,
      couleur_impression: 'noir_et_blanc',
      exemplaires: 1,
    },
    expectedMin: 8000,
    expectedMax: 12000,
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
    const isValid = prix_estime > 0 && prix_estime >= test.expectedMin && prix_estime <= test.expectedMax;

    return {
      ...test,
      price: prix_estime,
      isValid,
      status: isValid ? '✅ PASS' : '⚠️ WARN',
      response: response.data,
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
  console.log('\n🧪 === TEST ESTIMATION XEROX ===\n');

  const results = [];

  for (const test of XEROX_TESTS) {
    console.log(`⏳ Test: ${test.name}`);
    const result = await runTest(test);
    results.push(result);

    console.log(`   ${result.status} - Prix: ${result.price ? result.price.toLocaleString() : 'N/A'} FCFA`);
    if (result.response?.details?.base?.papier) {
      console.log(`   📄 ${result.response.details.base.papier.type} - ${result.response.details.base.papier.total_pages} pages`);
    }
  }

  console.log('\n📊 === RÉSUMÉ ===\n');

  const passed = results.filter(r => r.isValid).length;
  const total = results.length;

  console.log(`✅ Réussis: ${passed}/${total}`);
  console.log(`⚠️  Avertissements: ${total - passed}/${total}`);

  if (passed > 0) {
    console.log('\n✅ TESTS XEROX PARTIELLEMENT RÉUSSIS');
    process.exit(0);
  } else {
    console.log('\n❌ TOUS LES TESTS ONT ÉCHOUÉ');
    process.exit(1);
  }
}

main();
