#!/usr/bin/env node

const axios = require('axios');
const { ROLAND_SUPPORT_MAP } = require('./backend/utils/tariffMapping');

const API_URL = 'http://localhost:5001/api';

async function testAllSupports() {
  console.log('\n🧪 === TEST TOUS LES SUPPORTS ROLAND ===\n');
  
  const results = [];
  
  for (const [supportLabel, tarifKey] of Object.entries(ROLAND_SUPPORT_MAP)) {
    try {
      const response = await axios.post(
        `${API_URL}/devis/estimate-realtime`,
        {
          formData: {
            type_support: supportLabel,
            largeur: 100,
            hauteur: 100,
            unite: 'cm',
            nombre_exemplaires: 1,
          },
          machineType: 'roland'
        }
      );
      
      const { prix_estime, details } = response.data;
      const tarifTrouve = details?.breakdown?.base?.support?.tarif_cle;
      const ok = tarifTrouve === tarifKey && prix_estime > 0;
      
      results.push({
        support: supportLabel,
        tarifKey,
        tarifTrouve,
        prix: prix_estime,
        ok: ok ? '✅' : '❌'
      });
      
      console.log(`${ok ? '✅' : '❌'} ${supportLabel.padEnd(20)} → ${tarifKey.padEnd(20)} = ${prix_estime} FCFA`);
      
    } catch (error) {
      console.log(`❌ ${supportLabel.padEnd(20)} → ERREUR: ${error.message}`);
      results.push({
        support: supportLabel,
        tarifKey,
        ok: false,
        error: error.message
      });
    }
  }
  
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  
  console.log(`\n📊 Résumé: ${passed}/${total} supports fonctionnels\n`);
  process.exit(passed === total ? 0 : 1);
}

testAllSupports();
