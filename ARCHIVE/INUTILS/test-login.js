const axios = require('axios');
const API_BASE = 'http://localhost:5001/api';

async function testLogin() {
  const accounts = [
    { email: 'admin@imprimerie.local', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' },
    { email: 'admin@evocomprint.com', password: 'admin123' },
    { email: 'preparateur@imprimerie.local', password: 'prep123' },
  ];

  for (const account of accounts) {
    try {
      console.log(`Essai: ${account.email}`);
      const response = await axios.post(`${API_BASE}/auth/login`, account);
      if (response.data?.success) {
        console.log(`  ✅ Connexion réussie!`);
        console.log(`  Token: ${response.data.token.substring(0, 20)}...`);
        return account;
      } else {
        console.log(`  ❌ Pas de success dans la réponse`);
      }
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.response?.data?.error || error.message}`);
    }
  }
}

testLogin();