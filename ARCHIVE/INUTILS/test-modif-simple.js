// Test simple de modification de dossier
const axios = require('axios');

async function testModification() {
  console.log('🧪 Test simple modification');
  
  try {
    // Login préparateur
    const prepLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    const prepToken = prepLogin.data.token;
    console.log('✅ Préparateur connecté, ID:', prepLogin.data.user.id, 'Type:', typeof prepLogin.data.user.id);

    // Créer un dossier
    const nouveauDossier = {
      client: 'Test Simple',
      machine: 'Roland',
      description: 'Test simple',
      quantite: 1
    };

    const createResponse = await axios.post('http://localhost:5001/api/dossiers', nouveauDossier, {
      headers: { Authorization: `Bearer ${prepToken}` }
    });

    const dossier = createResponse.data.dossier;
    console.log('✅ Dossier créé:', dossier.numero_commande);
    console.log('   ID dossier:', dossier.id);
    console.log('   Created by:', dossier.created_by, 'Type:', typeof dossier.created_by);

    // Tenter la modification
    console.log('\nTentative de modification...');
    const updateData = { description: 'Modifié' };
    
    const updateResponse = await axios.put(`http://localhost:5001/api/dossiers/${dossier.id}`, updateData, {
      headers: { Authorization: `Bearer ${prepToken}` }
    });

    console.log('✅ Modification réussie');

    // Nettoyage
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    await axios.delete(`http://localhost:5001/api/dossiers/${dossier.id}`, {
      headers: { Authorization: `Bearer ${adminLogin.data.token}` }
    });
    console.log('🗑️ Dossier nettoyé');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testModification();