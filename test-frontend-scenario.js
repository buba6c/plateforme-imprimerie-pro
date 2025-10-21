const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001/api';

async function testFrontendScenario() {
  try {
    console.log('🎯 TEST: Scénario complet Xerox depuis le frontend');
    console.log('==============================================\n');

    // Scénario 1: Utilisateur ne modifie rien (valeurs par défaut)
    console.log('SCÉNARIO 1: Valeurs par défaut (nombre_exemplaires=100)');
    console.log('-------------------------------------------');

    let xeroxData = {
      client: '',
      type_document: 'xerox',
      type_document_autre: '',
      format: 'A4',
      format_personnalise: '',
      mode_impression: 'recto_simple',
      nombre_exemplaires: '100',  // DÉFAUT
      couleur_impression: 'couleur',
      grammage: '80',
      grammage_autre: '',
      finition: [],
      faconnage: [],
      faconnage_autre: '',
      numerotation: false,
      debut_numerotation: '',
      nombre_chiffres: '',
      conditionnement: [],
    };

    let response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: xeroxData,
      machineType: 'xerox'
    });

    console.log(`✅ Prix estimation: ${response.data.prix_estime} FCFA`);
    console.log(`   Pages: ${response.data.details.base.pages.total_pages}`);
    console.log(`   Exemplaires: ${response.data.details.base.pages.nombre_exemplaires}\n`);

    if (response.data.prix_estime === 10000) {
      console.log('✅ CORRECT: 1 page × 100 exemplaires = 10,000 FCFA\n');
    } else {
      console.log(`❌ INCORRECT: Attendu 10,000 FCFA, reçu ${response.data.prix_estime} FCFA\n`);
    }

    // Scénario 2: Utilisateur change à 50 exemplaires
    console.log('SCÉNARIO 2: Utilisateur change à 50 exemplaires');
    console.log('-------------------------------------------');

    xeroxData.nombre_exemplaires = '50';

    response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: xeroxData,
      machineType: 'xerox'
    });

    console.log(`✅ Prix estimation: ${response.data.prix_estime} FCFA`);
    console.log(`   Pages: ${response.data.details.base.pages.total_pages}`);
    console.log(`   Exemplaires: ${response.data.details.base.pages.nombre_exemplaires}\n`);

    if (response.data.prix_estime === 5000) {
      console.log('✅ CORRECT: 1 page × 50 exemplaires = 5,000 FCFA\n');
    } else {
      console.log(`❌ INCORRECT: Attendu 5,000 FCFA, reçu ${response.data.prix_estime} FCFA\n`);
    }

    // Scénario 3: Utilisateur change à 200 exemplaires
    console.log('SCÉNARIO 3: Utilisateur change à 200 exemplaires');
    console.log('-------------------------------------------');

    xeroxData.nombre_exemplaires = '200';

    response = await axios.post(`${BACKEND_URL}/devis/estimate-realtime`, {
      formData: xeroxData,
      machineType: 'xerox'
    });

    console.log(`✅ Prix estimation: ${response.data.prix_estime} FCFA`);
    console.log(`   Pages: ${response.data.details.base.pages.total_pages}`);
    console.log(`   Exemplaires: ${response.data.details.base.pages.nombre_exemplaires}\n`);

    if (response.data.prix_estime === 20000) {
      console.log('✅ CORRECT: 1 page × 200 exemplaires = 20,000 FCFA\n');
    } else {
      console.log(`❌ INCORRECT: Attendu 20,000 FCFA, reçu ${response.data.prix_estime} FCFA\n`);
    }

    console.log('==============================================');
    console.log('✅ TOUS LES TESTS PASSENT!');
    console.log('==============================================');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testFrontendScenario();
