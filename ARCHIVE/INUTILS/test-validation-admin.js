#!/usr/bin/env node

const axios = require('axios');

async function testValidationAsAdmin() {
  try {
    const baseURL = 'http://localhost:5001/api';
    
    // Authenticate as admin
    console.log('🔑 Authenticating as admin...');
    const authResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    const dossierId = 'b2a629d1-2a6b-442d-a7b0-21e53181376d';
    
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
      statut_details: {
        value: getDossierResponse.data.dossier?.statut,
        type: typeof getDossierResponse.data.dossier?.statut,
        length: getDossierResponse.data.dossier?.statut?.length,
        charCodes: Array.from(getDossierResponse.data.dossier?.statut || '').map(c => c.charCodeAt(0))
      }
    });
    
    // Try to validate
    console.log('✅ Attempting validation...');
    const validateResponse = await axios.put(`${baseURL}/dossiers/${dossierId}/valider`, {
      commentaire: 'Test validation with improved debug'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Validation successful:', JSON.stringify(validateResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.data?.debug) {
      console.log('🔍 Debug information:', JSON.stringify(error.response.data.debug, null, 2));
    }
  }
}

if (require.main === module) {
  testValidationAsAdmin();
}

module.exports = { testValidationAsAdmin };