#!/usr/bin/env node

const axios = require('axios');

async function testValidation() {
  try {
    console.log('🔍 Testing dossier validation...');
    
    // First get the dossier to see its current status
    const dossierId = 'b2a629d1-2a6b-442d-a7b0-21e53181376d';
    const baseURL = 'http://localhost:5001/api';
    
    // You'll need to provide a valid JWT token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInVzZXJuYW1lIjoicHJlcGFyYXRldXIiLCJyb2xlIjoicHJlcGFyYXRldXIiLCJpYXQiOjE3Mjg0MTEzNjksImV4cCI6MTcyODQ5Nzc2OX0.placeholder'; // Replace with actual token
    
    console.log('📋 Getting dossier details...');
    const getDossierResponse = await axios.get(`${baseURL}/dossiers/${dossierId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Dossier details:', {
      id: getDossierResponse.data.dossier?.id,
      folder_id: getDossierResponse.data.dossier?.folder_id,
      statut: getDossierResponse.data.dossier?.statut,
      type: typeof getDossierResponse.data.dossier?.statut,
      length: getDossierResponse.data.dossier?.statut?.length,
      'validé_preparateur': getDossierResponse.data.dossier?.['validé_preparateur'] || getDossierResponse.data.dossier?.valide_preparateur
    });
    
    // Try to validate
    console.log('✅ Attempting validation...');
    const validateResponse = await axios.put(`${baseURL}/dossiers/${dossierId}/valider`, {
      commentaire: 'Test validation debug'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Validation successful:', validateResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      console.log('🔑 Need to get a valid authentication token first');
    }
  }
}

if (require.main === module) {
  testValidation();
}

module.exports = { testValidation };