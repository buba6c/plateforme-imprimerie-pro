const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testXeroxEnvoi() {
  try {
    console.log('🔍 TEST: Envoi direct avec nombre_exemplaires = 100');
    console.log('=========================================\n');

    // Simuler exactement ce que le frontend envoie
    const xeroxData = {
      client: '',
      type_document: 'xerox',
      format: 'A4',
      nombre_exemplaires: '100',
      couleur_impression: 'couleur',
      mode_impression: 'recto_simple',
      grammage: '80',
      finition: [],
      faconnage: [],
      conditionnement: [],
    };

    console.log('📤 Envoi du formulaire Xerox:');
    console.log(JSON.stringify(xeroxData, null, 2));
    console.log('\n');

    // Test 1: Real-time estimation
    console.log('📡 Appel API: /devis/estimate-realtime');
    const response = await axios.post(
      `${API_URL}/devis/estimate-realtime`,
      { formData: xeroxData, machineType: 'xerox' }
    );

    console.log('✅ Réponse reçue:');
    console.log(`Prix: ${response.data.prix_estime} FCFA`);
    console.log(`Breakdown: pages_par_document=${response.data.details.base.pages.pages_par_document}, `);
    console.log(`nombre_exemplaires=${response.data.details.base.pages.nombre_exemplaires}, `);
    console.log(`total_pages=${response.data.details.base.pages.total_pages}`);

    if (response.data.details.base.pages.nombre_exemplaires === 1) {
      console.log('\n❌ PROBLÈME: nombre_exemplaires reçu en tant que 1, pas 100!');
      console.log('Cela signifie que la valeur n\'est pas bien transmise du frontend.');
    } else if (response.data.details.base.pages.nombre_exemplaires === 100) {
      console.log('\n✅ CORRECT: nombre_exemplaires reçu correctement comme 100');
    }
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testXeroxEnvoi();
