const axios = require('axios');
const BASE_URL = 'http://localhost:5001/api';

// Token d'authentification (vous devrez peut-être le remplacer)
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmZyIn0.test';

async function testCreateDevisWithIA() {
  console.log('\n🤖 TEST: Créer Devis avec estimation IA\n');

  // Test 1: Roland via IA
  console.log('📋 Test 1: Créer devis ROLAND');
  try {
    const response = await axios.post(
      `${BASE_URL}/devis`,
      {
        machine_type: 'roland',
        client_nom: 'Test Client',
        client_contact: 'test@example.com',
        data_json: JSON.stringify({
          type_support: 'Bâche',
          largeur: 100,
          hauteur: 60,
          unite: 'cm',
          nombre_exemplaires: 1
        }),
        notes: 'Test creation'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Devis créé:');
    console.log('   ID:', response.data.devis?.id);
    console.log('   Numéro:', response.data.devis?.numero);
    console.log('   Prix estimé:', response.data.estimation?.prix_estime, 'FCFA');
    console.log('   IA utilisée:', response.data.estimation?.ia_used);
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data?.error || error.message);
  }

  // Test 2: Xerox via IA
  console.log('\n📋 Test 2: Créer devis XEROX');
  try {
    const response = await axios.post(
      `${BASE_URL}/devis`,
      {
        machine_type: 'xerox',
        client_nom: 'Test Client',
        client_contact: 'test@example.com',
        data_json: JSON.stringify({
          format: 'A4',
          type_document: 'Flyer',
          nombre_pages: 100,
          nombre_exemplaires: 1,
          couleur_impression: 'couleur'
        }),
        notes: 'Test creation'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Devis créé:');
    console.log('   ID:', response.data.devis?.id);
    console.log('   Numéro:', response.data.devis?.numero);
    console.log('   Prix estimé:', response.data.estimation?.prix_estime, 'FCFA');
    console.log('   IA utilisée:', response.data.estimation?.ia_used);
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data?.error || error.message);
  }
}

testCreateDevisWithIA();
