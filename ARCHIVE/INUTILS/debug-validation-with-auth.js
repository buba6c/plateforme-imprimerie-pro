#!/usr/bin/env node

const axios = require('axios');

async function getAuthToken() {
  try {
    const baseURL = 'http://localhost:5001/api';
    
    // Try to authenticate as preparateur
    console.log('🔑 Attempting to authenticate...');
    const authResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'password123' // Default password, may need adjustment
    });
    
    console.log('✅ Authentication successful');
    return authResponse.data.token;
    
  } catch (error) {
    console.error('❌ Authentication failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Try with different credentials
    try {
      console.log('🔑 Trying alternative credentials...');
      const baseURL = 'http://localhost:5001/api';
      const authResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'prep@test.com',
        password: 'prep123'
      });
      
      console.log('✅ Authentication successful with alternative credentials');
      return authResponse.data.token;
      
    } catch (error2) {
      console.error('❌ Alternative authentication failed:', {
        status: error2.response?.status,
        data: error2.response?.data
      });
      return null;
    }
  }
}

async function testValidationWithAuth() {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.log('❌ Could not get authentication token');
      return;
    }
    
    console.log('🔍 Testing dossier validation with token:', token.substring(0, 20) + '...');
    
    const dossierId = 'b2a629d1-2a6b-442d-a7b0-21e53181376d';
    const baseURL = 'http://localhost:5001/api';
    
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
      },
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
  }
}

if (require.main === module) {
  testValidationWithAuth();
}

module.exports = { testValidationWithAuth, getAuthToken };