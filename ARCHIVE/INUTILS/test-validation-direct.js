#!/usr/bin/env node

// Test de validation direct sans axios
const http = require('http');

function makeRequest(hostname, port, path, method, headers, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testDirectValidation() {
  try {
    console.log('🔑 Test direct de validation...');
    
    // D'abord authentification
    const authResponse = await makeRequest('localhost', 5001, '/api/auth/login', 'POST', {
      'Content-Type': 'application/json'
    }, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    if (authResponse.status !== 200) {
      console.error('❌ Échec authentification:', authResponse);
      return;
    }
    
    const token = authResponse.data.token;
    console.log('✅ Authentification réussie');
    
    // Maintenant test de validation
    const dossierId = 'b2a629d1-2a6b-442d-a7b0-21e53181376d';
    const validationResponse = await makeRequest('localhost', 5001, `/api/dossiers/${dossierId}/valider`, 'PUT', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }, {
      commentaire: 'Test validation direct'
    });
    
    console.log('📋 Réponse validation:', {
      status: validationResponse.status,
      data: validationResponse.data
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

if (require.main === module) {
  testDirectValidation();
}