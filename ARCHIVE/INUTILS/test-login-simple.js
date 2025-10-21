#!/usr/bin/env node

/**
 * TEST DE CONNEXION - Test simple des credentials
 */

const http = require('http');

function testLogin(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    
    const options = {
      hostname: 'localhost',
      port: 5003,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🔐 TEST DE CONNEXION LOGIN\n');
  
  const testUsers = [
    { email: 'admin@imprimerie.local', password: 'test123' },
    { email: 'admin@imprimerie.com', password: 'test123' },
    { email: 'preparateur@imprimerie.local', password: 'test123' },
    { email: 'admin@test.com', password: 'test123' }
  ];
  
  for (const user of testUsers) {
    console.log(`\n👤 Test: ${user.email}`);
    
    try {
      const result = await testLogin(user.email, user.password);
      
      if (result.status === 200) {
        console.log('✅ Connexion RÉUSSIE');
        if (result.data.user) {
          console.log(`   Utilisateur: ${result.data.user.nom}`);
          console.log(`   Rôle: ${result.data.user.role}`);
          console.log(`   Token reçu: ${result.data.token ? 'Oui' : 'Non'}`);
        }
      } else if (result.status === 401) {
        console.log('❌ Connexion ÉCHOUÉE - Identifiants incorrects');
        console.log(`   Message: ${result.data.error || result.data}`);
      } else if (result.status === 403) {
        console.log('⚠️  Connexion refusée - Compte désactivé');
        console.log(`   Message: ${result.data.error || result.data}`);
      } else {
        console.log(`❌ Erreur ${result.status}`);
        console.log(`   Réponse: ${JSON.stringify(result.data)}`);
      }
      
    } catch (error) {
      console.log('❌ Erreur de connexion au serveur');
      console.log(`   ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 RÉSUMÉ:');
  console.log('   Si toutes les connexions échouent → Problème de serveur');
  console.log('   Si quelques connexions échouent → Problème de mot de passe');
  console.log('   Si connexions réussies → Backend fonctionne correctement');
  console.log('='.repeat(60));
}

// Attendre 2 secondes pour que le serveur soit prêt
setTimeout(runTests, 2000);