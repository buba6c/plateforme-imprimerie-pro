#!/usr/bin/env node
/**
 * Générateur de tokens frais pour les tests
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Test credentials
const credentials = [
  { email: 'admin@imprimerie.com', password: 'admin123', role: 'admin' },
  { email: 'preparateur@imprimerie.com', password: 'prep123', role: 'preparateur' },
  { email: 'roland@imprimerie.com', password: 'roland123', role: 'imprimeur_roland' },
  { email: 'xerox@imprimerie.com', password: 'xerox123', role: 'imprimeur_xerox' },
  { email: 'livreur@imprimerie.com', password: 'livreur123', role: 'livreur' }
];

async function generateTokens() {
  console.log('🔑 Génération de nouveaux tokens...\n');
  
  const tokens = {};
  
  for (const cred of credentials) {
    try {
      // Essayons plusieurs variations du mot de passe
      const passwordVariants = [
        cred.password,
        '123456',
        'password',
        cred.role + '123'
      ];
      
      let success = false;
      
      for (const password of passwordVariants) {
        try {
          const response = await axios.post(`${API_BASE}/auth/login`, {
            email: cred.email,
            password: password
          });
          
          tokens[cred.role] = response.data.token;
          console.log(`✅ ${cred.role}: Token généré`);
          success = true;
          break;
        } catch (err) {
          // Continuez à essayer
        }
      }
      
      if (!success) {
        console.log(`❌ ${cred.role}: Échec authentification`);
      }
      
    } catch (error) {
      console.log(`❌ ${cred.role}: ${error.response?.data?.error || error.message}`);
    }
  }
  
  console.log('\n📋 TOKENS GÉNÉRÉS:');
  console.log('const TOKENS = {');
  Object.entries(tokens).forEach(([role, token]) => {
    console.log(`  ${role}: '${token}',`);
  });
  console.log('};');
  
  // Test direct des routes API avec les nouveaux tokens
  if (tokens.admin) {
    console.log('\n🔍 Test rapide des routes avec admin token...');
    try {
      const dossiers = await axios.get(`${API_BASE}/dossiers`, {
        headers: { 'Authorization': `Bearer ${tokens.admin}` }
      });
      console.log(`✅ /api/dossiers: ${dossiers.data.length} dossiers trouvés`);
    } catch (error) {
      console.log(`❌ /api/dossiers: ${error.response?.data?.error || error.message}`);
    }
  }
}

generateTokens();