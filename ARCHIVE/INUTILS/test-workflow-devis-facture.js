/**
 * 🧪 Test complet du workflow Devis → Dossier → Facture
 * 
 * Ce script teste l'ensemble du processus :
 * 1. Création d'un devis
 * 2. Conversion en dossier
 * 3. Changement de statut jusqu'à "Livré"
 * 4. Vérification de la génération automatique de facture
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Tokens de test (à adapter selon votre configuration)
const TOKENS = {
  admin: process.env.TEST_ADMIN_TOKEN || 'your_admin_token_here',
  preparateur: process.env.TEST_PREP_TOKEN || 'your_prep_token_here',
  livreur: process.env.TEST_LIVREUR_TOKEN || 'your_livreur_token_here'
};

const log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  const emoji = {
    'info': 'ℹ️',
    'success': '✅',
    'error': '❌',
    'warning': '⚠️'
  };
  console.log(`${emoji[level]} [${timestamp}] ${message}`);
};

class WorkflowTester {
  constructor() {
    this.devisId = null;
    this.dossierId = null;
    this.factureId = null;
  }

  async makeRequest(method, endpoint, data = null, token) {
    try {
      const config = {
        method,
        url: `${API_BASE}${endpoint}`,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (data) config.data = data;
      
      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.message,
        status: error.response?.status
      };
    }
  }

  // 📋 ÉTAPE 1: Créer un devis
  async createDevis() {
    log('📋 ÉTAPE 1: Création d\'un devis de test');
    
    const devisData = {
      machine_type: 'xerox',
      data_json: {
        type_document: 'Flyers',
        format: 'A4',
        mode_impression: 'recto_simple',
        couleur_impression: 'couleur',
        nombre_exemplaires: 100,
        grammage: '90g',
        finition: ['Découpe'],
        faconnage: [],
        conditionnement: ['Liasse']
      },
      client_nom: 'Client Test Workflow',
      client_contact: 'test@workflow.com',
      notes: 'Test automatique du workflow complet'
    };

    const result = await this.makeRequest('POST', '/devis', devisData, TOKENS.preparateur);
    
    if (result.success) {
      this.devisId = result.data.devis.id;
      log(`✅ Devis créé avec succès: ${result.data.devis.numero} (ID: ${this.devisId})`, 'success');
      log(`   Prix estimé: ${result.data.devis.prix_estime} FCFA`);
      return true;
    } else {
      log(`❌ Erreur création devis: ${result.error}`, 'error');
      return false;
    }
  }

  // ✅ ÉTAPE 2: Valider le devis
  async validateDevis() {
    log('✅ ÉTAPE 2: Validation du devis');
    
    const result = await this.makeRequest('PUT', `/devis/${this.devisId}`, {
      statut: 'valide',
      prix_final: 15000
    }, TOKENS.preparateur);

    if (result.success) {
      log('✅ Devis validé avec succès', 'success');
      return true;
    } else {
      log(`❌ Erreur validation devis: ${result.error}`, 'error');
      return false;
    }
  }

  // 🔄 ÉTAPE 3: Convertir en dossier
  async convertToDossier() {
    log('🔄 ÉTAPE 3: Conversion du devis en dossier');
    
    const result = await this.makeRequest('POST', `/devis/${this.devisId}/convert`, {}, TOKENS.preparateur);
    
    if (result.success) {
      this.dossierId = result.data.folder_id;
      log(`✅ Devis converti en dossier: ${this.dossierId}`, 'success');
      return true;
    } else {
      log(`❌ Erreur conversion: ${result.error}`, 'error');
      return false;
    }
  }

  // 🖨️ ÉTAPE 4: Simuler l'impression (Terminé)
  async markAsCompleted() {
    log('🖨️ ÉTAPE 4: Marquage du dossier comme terminé (impression finie)');
    
    const result = await this.makeRequest('PUT', `/dossiers/${this.dossierId}/statut`, {
      nouveau_statut: 'Terminé',
      commentaire: 'Impression terminée - Test automatique'
    }, TOKENS.admin);

    if (result.success) {
      log('✅ Dossier marqué comme terminé', 'success');
      return true;
    } else {
      log(`❌ Erreur changement statut: ${result.error}`, 'error');
      return false;
    }
  }

  // 🚚 ÉTAPE 5: Simuler la livraison (Livré)
  async markAsDelivered() {
    log('🚚 ÉTAPE 5: Marquage du dossier comme livré (génération auto facture)');
    
    const result = await this.makeRequest('PUT', `/dossiers/${this.dossierId}/statut`, {
      nouveau_statut: 'Livré',
      commentaire: 'Livraison effectuée - Test automatique',
      mode_paiement: 'especes',
      montant_cfa: 15000
    }, TOKENS.livreur);

    if (result.success) {
      log('✅ Dossier marqué comme livré', 'success');
      log('⏳ Attente de la génération automatique de facture...');
      
      // Attendre un peu pour la génération automatique
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    } else {
      log(`❌ Erreur changement statut: ${result.error}`, 'error');
      return false;
    }
  }

  // 💰 ÉTAPE 6: Vérifier la facture
  async checkInvoiceGeneration() {
    log('💰 ÉTAPE 6: Vérification de la génération automatique de facture');
    
    const result = await this.makeRequest('GET', '/factures', null, TOKENS.admin);
    
    if (result.success) {
      const factures = result.data.factures || [];
      const factureGenerated = factures.find(f => f.dossier_id === this.dossierId);
      
      if (factureGenerated) {
        this.factureId = factureGenerated.id;
        log(`✅ Facture générée automatiquement: ${factureGenerated.numero} (ID: ${this.factureId})`, 'success');
        log(`   Montant TTC: ${factureGenerated.montant_ttc} FCFA`);
        log(`   Mode de paiement: ${factureGenerated.mode_paiement}`);
        log(`   Statut: ${factureGenerated.statut_paiement}`);
        return true;
      } else {
        log('❌ Aucune facture trouvée pour ce dossier', 'error');
        return false;
      }
    } else {
      log(`❌ Erreur récupération factures: ${result.error}`, 'error');
      return false;
    }
  }

  // 📄 ÉTAPE 7: Tester le PDF de la facture
  async testInvoicePDF() {
    log('📄 ÉTAPE 7: Test de génération du PDF facture');
    
    try {
      const response = await axios.get(`${API_BASE}/factures/${this.factureId}/pdf`, {
        headers: { Authorization: `Bearer ${TOKENS.admin}` },
        responseType: 'blob'
      });

      if (response.status === 200) {
        log('✅ PDF de facture généré avec succès', 'success');
        log(`   Taille: ${response.data.size} octets`);
        return true;
      } else {
        log('❌ Erreur génération PDF facture', 'error');
        return false;
      }
    } catch (error) {
      log(`❌ Erreur PDF facture: ${error.message}`, 'error');
      return false;
    }
  }

  // 🧹 ÉTAPE 8: Nettoyage (optionnel)
  async cleanup() {
    log('🧹 ÉTAPE 8: Nettoyage des données de test');
    
    // Supprimer la facture (si nécessaire)
    if (this.factureId) {
      // Note: Généralement on ne supprime pas les factures, mais pour les tests...
      log('   Facture conservée pour audit (normal)');
    }

    // Supprimer le dossier (si nécessaire)
    if (this.dossierId) {
      log('   Dossier conservé pour historique (normal)');
    }

    // Le devis ne peut pas être supprimé car il est converti
    log('   Devis conservé car converti (normal)');
  }

  // 🚀 EXÉCUTION COMPLÈTE
  async runCompleteTest() {
    log('🚀 DÉMARRAGE DU TEST COMPLET DU WORKFLOW DEVIS → DOSSIER → FACTURE');
    log('='.repeat(80));

    const steps = [
      { name: 'Création devis', fn: () => this.createDevis() },
      { name: 'Validation devis', fn: () => this.validateDevis() },
      { name: 'Conversion dossier', fn: () => this.convertToDossier() },
      { name: 'Marquage terminé', fn: () => this.markAsCompleted() },
      { name: 'Marquage livré', fn: () => this.markAsDelivered() },
      { name: 'Vérification facture', fn: () => this.checkInvoiceGeneration() },
      { name: 'Test PDF facture', fn: () => this.testInvoicePDF() },
      { name: 'Nettoyage', fn: () => this.cleanup() }
    ];

    let successCount = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      log(`\n📍 ${i + 1}/${steps.length}: ${step.name}`);
      
      const success = await step.fn();
      if (success) {
        successCount++;
      } else {
        log(`⚠️ Étape "${step.name}" échouée, arrêt du test`, 'warning');
        break;
      }
    }

    // 📊 RÉSUMÉ
    log('\n' + '='.repeat(80));
    log('📊 RÉSUMÉ DU TEST');
    log('='.repeat(80));
    log(`✅ Étapes réussies: ${successCount}/${steps.length}`);
    
    if (successCount === steps.length) {
      log('🎉 WORKFLOW COMPLET RÉUSSI ! Le système devis → dossier → facture fonctionne parfaitement', 'success');
    } else {
      log('⚠️ Test incomplet, vérifiez la configuration et les tokens', 'warning');
    }

    // Détails des éléments créés
    if (this.devisId) log(`   📋 Devis créé: ID ${this.devisId}`);
    if (this.dossierId) log(`   📁 Dossier créé: ID ${this.dossierId}`);
    if (this.factureId) log(`   💰 Facture créée: ID ${this.factureId}`);
  }
}

// 🏃‍♂️ LANCEMENT DU TEST
async function main() {
  const tester = new WorkflowTester();
  await tester.runCompleteTest();
}

// Exécuter si c'est le fichier principal
if (require.main === module) {
  main().catch(error => {
    log(`💥 Erreur fatale: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = WorkflowTester;