/**
 * Test complet du système IA Intelligent
 * À exécuter après l'implémentation pour valider
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001/api';
const TEST_TOKEN = 'YOUR_AUTH_TOKEN'; // À remplacer

// Couleurs pour console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

class AIIntelligenceTests {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  log(message, type = 'info') {
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '⚙️';
    console.log(`${prefix} ${message}`);
  }

  async test(name, fn) {
    this.totalTests++;
    try {
      console.log(`\n${colors.blue}📋 Test: ${name}${colors.reset}`);
      await fn();
      this.passedTests++;
      this.results.push({ name, status: 'PASS' });
      this.log('Test réussi', 'success');
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      this.log(`Erreur: ${error.message}`, 'error');
    }
  }

  async runAll() {
    console.log(`\n${colors.bright}🤖 Test du Système IA Intelligent${colors.reset}\n`);

    // Test 1: Vérifier la disponibilité de l'API
    await this.test('Disponibilité de l\'API /ai-agent/analyze', async () => {
      const response = await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'Test simple: 100 flyers A5',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      if (!response.data.success) {
        throw new Error('Réponse success = false');
      }
      this.log('API répondant correctement', 'success');
    });

    // Test 2: Vérifier le processus de réflexion
    await this.test('Processus de réflexion en 5 étapes', async () => {
      const response = await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'J\'ai besoin de 500 flyers A4 couleur brillant',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      if (!response.data.thinking_process || response.data.thinking_process.length < 5) {
        throw new Error('Processus de réflexion incomplet');
      }

      const stepNames = response.data.thinking_process.map(s => s.name);
      this.log(`Étapes détectées: ${stepNames.join(' → ')}`, 'info');
    });

    // Test 3: Vérifier les propositions multiples
    await this.test('Propositions multiples ranksées', async () => {
      const response = await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'Besoin d\'impression grand format: 10m² de bâche',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      if (!response.data.proposals || response.data.proposals.length < 1) {
        throw new Error('Aucune proposition générée');
      }

      this.log(`Propositions générées: ${response.data.proposals.length}`, 'info');
      response.data.proposals.forEach((p, idx) => {
        this.log(`  Proposition ${idx + 1}: ${p.title || p.machine_recommended} - ${p.price || p.estimated_price} FCFA`, 'info');
      });
    });

    // Test 4: Vérifier la confiance de l'analyse
    await this.test('Score de confiance de l\'analyse', async () => {
      const response = await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'Devis très clair: 1000 flyers A5, couleur',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      const confidence = response.data.confidence_score || 0;
      this.log(`Confiance: ${(confidence * 100).toFixed(0)}%`, 'info');

      if (confidence < 0.5) {
        throw new Error(`Confiance trop basse: ${confidence}`);
      }
    });

    // Test 5: Vérifier le feedback
    await this.test('Enregistrement du feedback utilisateur', async () => {
      const response = await axios.post(`${API_URL}/ai-agent/feedback`, {
        quote_id: 1,
        proposal_accepted: true,
        user_feedback: {
          score: 5,
          notes: 'Excellente recommandation'
        }
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      if (!response.data.success) {
        throw new Error('Feedback non enregistré');
      }
    });

    // Test 6: Vérifier le contexte tarifaire
    await this.test('Chargement du contexte tarifaire', async () => {
      const response = await axios.get(`${API_URL}/ai-agent/context`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      if (!response.data.success) {
        throw new Error('Contexte non chargé');
      }

      this.log(`Tarifs Xerox: ${response.data.context.xerox_tariffs_count}`, 'info');
      this.log(`Tarifs Roland: ${response.data.context.roland_tariffs_count}`, 'info');
      this.log(`Finitions: ${response.data.context.finitions_count}`, 'info');
    });

    // Test 7: Performance - temps de réponse
    await this.test('Performance - Temps de réponse < 10s', async () => {
      const startTime = Date.now();
      
      await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'Test de performance: demande complexe avec multiples paramètres',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      const duration = Date.now() - startTime;
      this.log(`Temps: ${duration}ms`, 'info');

      if (duration > 10000) {
        throw new Error(`Trop lent: ${duration}ms`);
      }
    });

    // Test 8: Adaptabilité aux modifications
    await this.test('Adaptabilité aux modifications', async () => {
      const firstResponse = await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'Je voudrais 100 flyers',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      const secondResponse = await axios.post(`${API_URL}/ai-agent/analyze`, {
        description: 'En fait, j\'en ai besoin de 500 flyers',
        currentForm: {}
      }, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` }
      });

      // Les prix devraient être différents
      const price1 = firstResponse.data.proposals?.[0]?.price || firstResponse.data.final_recommendation?.price;
      const price2 = secondResponse.data.proposals?.[0]?.price || secondResponse.data.final_recommendation?.price;

      if (price1 === price2) {
        throw new Error('Propositions identiques malgré modifications');
      }

      this.log(`Prix 100 flyers: ${price1}`, 'info');
      this.log(`Prix 500 flyers: ${price2}`, 'info');
    });

    // Résumé
    this.printSummary();
  }

  printSummary() {
    console.log(`\n${colors.bright}📊 Résumé des Tests${colors.reset}\n`);

    this.results.forEach(result => {
      const status = result.status === 'PASS' 
        ? `${colors.green}✅ PASS${colors.reset}`
        : `${colors.red}❌ FAIL${colors.reset}`;
      console.log(`${status} - ${result.name}`);
      if (result.error) {
        console.log(`   Erreur: ${result.error}`);
      }
    });

    const percentage = ((this.passedTests / this.totalTests) * 100).toFixed(0);
    console.log(`\n${colors.bright}Résultat: ${this.passedTests}/${this.totalTests} (${percentage}%)${colors.reset}\n`);

    if (this.passedTests === this.totalTests) {
      console.log(`${colors.green}${colors.bright}🎉 TOUS LES TESTS PASSENT! 🎉${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}${colors.bright}❌ Certains tests ont échoué${colors.reset}\n`);
      process.exit(1);
    }
  }
}

// Exécuter les tests
const tester = new AIIntelligenceTests();
tester.runAll().catch(err => {
  console.error('Erreur critique:', err);
  process.exit(1);
});
