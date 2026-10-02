#!/usr/bin/env node

/**
 * Script de test pour l'API Sections
 * Usage: node test-sections-api.js
 */

const http = require('http');

const API_BASE = 'http://localhost:5001/api';

// Fonction helper pour les requêtes HTTP
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test data
const testDossierWithSections = {
  client_id: 1,
  type_formulaire: 'xerox',
  description: 'Test brochure multi-sections',
  amount: 15000,
  sections: [
    {
      type: 'Couverture',
      mode_impression: 'recto_verso',
      copies: 100,
      paper_types: [
        {
          format: 'A4',
          couleur: 'couleur',
          grammage: '250',
          pages: 2
        }
      ],
      finitions: ['plastification'],
      faconnage: []
    },
    {
      type: 'Intérieur',
      mode_impression: 'recto_verso',
      copies: 100,
      paper_types: [
        {
          format: 'A4',
          couleur: 'nb',
          grammage: '80',
          pages: 20
        }
      ],
      finitions: [],
      faconnage: ['reliure_spirale']
    }
  ]
};

const testDossierWithSupports = {
  client_id: 1,
  type_formulaire: 'roland',
  description: 'Test multi-supports Roland',
  amount: 25000,
  supports: [
    {
      type_support: 'bache',
      largeur: 2.5,
      hauteur: 1.5,
      unite: 'm',
      exemplaires: 3,
      finitions: ['oeillets']
    },
    {
      type_support: 'vinyle',
      largeur: 1,
      hauteur: 0.5,
      unite: 'm',
      exemplaires: 10,
      finitions: ['pelliculage']
    }
  ]
};

async function runTests() {
  console.log('🧪 Test API Sections/Supports\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Login
    console.log('\n📝 Test 1: Login admin...');
    const loginRes = await makeRequest('POST', '/auth/login', {
      email: 'admin@imprimerie.com',
      password: 'admin123'
    });

    if (loginRes.status !== 200 || !loginRes.data.token) {
      console.log('❌ Login échoué:', loginRes.data);
      return;
    }

    const token = loginRes.data.token;
    console.log('✅ Login OK, token obtenu');

    // Test 2: Créer dossier avec sections
    console.log('\n📝 Test 2: Créer dossier Xerox avec sections...');
    const createXeroxRes = await makeRequest('POST', '/dossiers', testDossierWithSections, token);

    if (createXeroxRes.status !== 201) {
      console.log('❌ Création échouée:', createXeroxRes.data);
    } else {
      const xeroxId = createXeroxRes.data.id;
      console.log('✅ Dossier Xerox créé, ID:', xeroxId);
      console.log('   - Sections:', createXeroxRes.data.sections?.length || 0);
      console.log('   - Amount:', createXeroxRes.data.amount);

      // Test 3: Récupérer le dossier
      console.log('\n📝 Test 3: Récupérer dossier Xerox...');
      const getXeroxRes = await makeRequest('GET', `/dossiers/${xeroxId}`, null, token);

      if (getXeroxRes.status === 200) {
        console.log('✅ Dossier récupéré');
        console.log('   - Sections:', getXeroxRes.data.sections?.length || 0);
        if (getXeroxRes.data.sections) {
          getXeroxRes.data.sections.forEach((s, i) => {
            console.log(`     Section ${i + 1}:`, s.type, '-', s.copies, 'copies');
          });
        }
      } else {
        console.log('❌ Récupération échouée:', getXeroxRes.data);
      }
    }

    // Test 4: Créer dossier avec supports
    console.log('\n📝 Test 4: Créer dossier Roland avec supports...');
    const createRolandRes = await makeRequest('POST', '/dossiers', testDossierWithSupports, token);

    if (createRolandRes.status !== 201) {
      console.log('❌ Création échouée:', createRolandRes.data);
    } else {
      const rolandId = createRolandRes.data.id;
      console.log('✅ Dossier Roland créé, ID:', rolandId);
      console.log('   - Supports:', createRolandRes.data.supports?.length || 0);
      console.log('   - Amount:', createRolandRes.data.amount);

      // Test 5: Récupérer le dossier
      console.log('\n📝 Test 5: Récupérer dossier Roland...');
      const getRolandRes = await makeRequest('GET', `/dossiers/${rolandId}`, null, token);

      if (getRolandRes.status === 200) {
        console.log('✅ Dossier récupéré');
        console.log('   - Supports:', getRolandRes.data.supports?.length || 0);
        if (getRolandRes.data.supports) {
          getRolandRes.data.supports.forEach((s, i) => {
            console.log(`     Support ${i + 1}:`, s.type_support, `-`, s.largeur, 'x', s.hauteur, s.unite);
          });
        }
      } else {
        console.log('❌ Récupération échouée:', getRolandRes.data);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tests terminés avec succès!\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  }
}

// Exécuter les tests
runTests();
