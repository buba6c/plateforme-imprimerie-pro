#!/usr/bin/env node

/**
 * TEST ESTIMATION TEMPS RÉEL
 * Vérifie que l'API retourne le bon prix (pas 0 FCFA)
 */

const axios = require('axios');
const dbHelper = require('./backend/utils/dbHelper');
const { mapRolandSupport } = require('./backend/utils/tariffMapping');

const API_URL = 'http://localhost:5001/api';

async function testEstimation() {
  console.log('\n🧪 === TEST ESTIMATION TEMPS RÉEL ===\n');
  
  try {
    // 1. Vérifier le mapping
    console.log('📍 Étape 1: Tester le mapping des supports');
    console.log('━'.repeat(50));
    
    const testSupports = ['Bâche', 'Vinyle', 'Tissu', 'Kakemono'];
    for (const support of testSupports) {
      const mapped = mapRolandSupport(support);
      console.log(`  "${support}" → "${mapped}"`);
    }
    
    // 2. Récupérer les tarifs depuis la DB
    console.log('\n📍 Étape 2: Vérifier les tarifs en base');
    console.log('━'.repeat(50));
    
    const [rolandTarifs] = await dbHelper.query(
      'SELECT cle, label, valeur, unite FROM tarifs_config WHERE type_machine = $1 AND actif = TRUE',
      ['roland']
    );
    
    console.log(`✅ Trouvé ${rolandTarifs.length} tarifs Roland:\n`);
    for (const t of rolandTarifs.slice(0, 5)) {
      console.log(`  • ${t.cle}: ${t.label} (${t.valeur} FCFA/${t.unite})`);
    }
    
    // 3. Tester l'API d'estimation
    console.log('\n📍 Étape 3: Tester l\'API /api/devis/estimate-realtime');
    console.log('━'.repeat(50));
    
    const testData = {
      formData: {
        type_support: 'Bâche',        // Label UI
        largeur: 200,
        hauteur: 300,
        unite: 'cm',
        nombre_exemplaires: 1,
      },
      machineType: 'roland'
    };
    
    console.log('\n📤 Données envoyées à l\'API:');
    console.log(JSON.stringify(testData, null, 2));
    
    // Appeler l'API sans authentification (elle accepte les requêtes publiques)
    const response = await axios.post(
      `${API_URL}/devis/estimate-realtime`,
      testData
    );
    
    console.log('\n📥 Réponse de l\'API:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 4. Vérifier le résultat
    console.log('\n📍 Étape 4: Analyse du résultat');
    console.log('━'.repeat(50));
    
    const { prix_estime, details, error, message } = response.data;
    
    if (error) {
      console.log(`❌ ERREUR: ${message}`);
      return false;
    }
    
    if (prix_estime === 0 || prix_estime === '0') {
      console.log(`❌ PROBLÈME: Estimation à 0 FCFA!`);
      console.log(`\nDébug infos:`);
      console.log(`  • Prix base: ${details?.base?.support?.prix_total}`);
      console.log(`  • Surface: ${details?.base?.dimensions?.surface_m2}`);
      console.log(`  • Support trouvé: ${details?.base?.support?.type}`);
      console.log(`  • Tarif clé: ${details?.base?.support?.tarif_cle}`);
      return false;
    }
    
    console.log(`✅ SUCCÈS! Estimation calculée: ${prix_estime.toLocaleString()} FCFA`);
    console.log(`\n📊 Détails:`);
    console.log(`  • Surface: ${details?.base?.dimensions?.surface_m2} m²`);
    console.log(`  • Support: ${details?.base?.support?.type}`);
    console.log(`  • Prix/m²: ${details?.base?.support?.prix_unitaire} FCFA`);
    console.log(`  • Quantité: ${details?.base?.quantite || 1}`);
    
    // 5. Calcul manuel pour vérification
    const surface = (200 * 300) / 10000; // m²
    const tarifParM2 = 7000; // Bâche standard
    const expected = Math.round(surface * tarifParM2);
    
    console.log(`\n📐 Vérification mathématique:`);
    console.log(`  • Surface: ${surface}m²`);
    console.log(`  • Tarif: ${tarifParM2} FCFA/m²`);
    console.log(`  • Attendu: ${expected} FCFA`);
    console.log(`  • Obtenu: ${prix_estime} FCFA`);
    console.log(`  • Match: ${prix_estime === expected ? '✅ OUI' : '❌ NON'}`);
    
    return prix_estime > 0 && prix_estime === expected;
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
    if (error.response?.data) {
      console.error('Réponse API:', error.response.data);
    }
    return false;
  }
}

// Exécuter le test
testEstimation().then(success => {
  console.log('\n' + '━'.repeat(50));
  console.log(success ? '✅ TEST RÉUSSI' : '❌ TEST ÉCHOUÉ');
  console.log('━'.repeat(50) + '\n');
  process.exit(success ? 0 : 1);
});
