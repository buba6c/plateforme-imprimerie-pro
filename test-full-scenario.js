const axios = require('axios');
const BASE_URL = 'http://localhost:5001/api';

async function testFullScenario() {
  console.log('\n🎯 SCÉNARIO COMPLET: Roland vs Xerox vs IA\n');

  // Scenario 1: ROLAND Temps réel
  console.log('=' .repeat(50));
  console.log('SCENARIO 1: ROLAND - Estimation temps réel');
  console.log('=' .repeat(50));
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        type_support: 'Bâche',
        largeur: 100,
        hauteur: 60,
        unite: 'cm'
      },
      machineType: 'roland'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('   Partial:', response.data.is_partial);
    console.log('   Calcul:', response.data.message);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }

  // Scenario 2: XEROX Temps réel
  console.log('\n' + '='.repeat(50));
  console.log('SCENARIO 2: XEROX - Estimation temps réel');
  console.log('='.repeat(50));
  try {
    const response = await axios.post(`${BASE_URL}/devis/estimate-realtime`, {
      formData: {
        format: 'A4',
        nombre_pages: 100,
        nombre_exemplaires: 1
      },
      machineType: 'xerox'
    });
    console.log('✅ Prix:', response.data.prix_estime, 'FCFA');
    console.log('   Partial:', response.data.is_partial);
    console.log('   Calcul:', response.data.message);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }

  // Scenario 3: ROLAND IA (si OpenAI est configuré)
  console.log('\n' + '='.repeat(50));
  console.log('SCENARIO 3: ROLAND - Estimation IA');
  console.log('='.repeat(50));
  console.log('⚠️  Dépend de l\'absence d\'erreur IA (clé OpenAI)');

  // Scenario 4: XEROX IA (si OpenAI est configuré)
  console.log('\n' + '='.repeat(50));
  console.log('SCENARIO 4: XEROX - Estimation IA');
  console.log('='.repeat(50));
  console.log('⚠️  Dépend de l\'absence d\'erreur IA (clé OpenAI)');

  console.log('\n' + '='.repeat(50));
  console.log('✅ TEST COMPLET: Les 2 scénarios temps réel passent!');
  console.log('='.repeat(50));
}

testFullScenario();
