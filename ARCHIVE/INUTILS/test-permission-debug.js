#!/usr/bin/env node

/**
 * Test pour diagnostiquer le problème des permissions "Dossier non trouvé"
 */

const axios = require('axios');

const API_URL = 'http://localhost:5002/api';
let authToken = null;

const api = {
  get: async (url, config = {}) => {
    return axios.get(`${API_URL}${url}`, {
      ...config,
      headers: {
        ...config.headers,
        Authorization: authToken ? `Bearer ${authToken}` : undefined
      }
    });
  },
  put: async (url, data, config = {}) => {
    return axios.put(`${API_URL}${url}`, data, {
      ...config,
      headers: {
        ...config.headers,
        Authorization: authToken ? `Bearer ${authToken}` : undefined
      }
    });
  },
  post: async (url, data, config = {}) => {
    return axios.post(`${API_URL}${url}`, data, {
      ...config,
      headers: {
        ...config.headers,
        Authorization: authToken ? `Bearer ${authToken}` : undefined
      }
    });
  }
};

async function authenticate(email, password = 'admin123') {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    authToken = response.data.token;
    console.log(`✅ Authentification réussie pour ${email}`);
    return { success: true, user: response.data.user };
  } catch (error) {
    console.log(`❌ Échec authentification pour ${email}: ${error.response?.data?.message || error.message}`);
    return { success: false, error: error.response?.data?.message };
  }
}

async function testRolePermissions() {
  console.log('🔍 TEST: Diagnostic des permissions par rôle\n');
  
  // 1. Connecté en tant qu'admin pour obtenir la liste des dossiers
  console.log('=== ÉTAPE 1: Connexion Admin pour récupérer les dossiers ===');
  const adminAuth = await authenticate('admin@imprimerie.local');
  if (!adminAuth.success) {
    console.log('❌ Impossible de se connecter en admin');
    return;
  }
  
  try {
    // Récupérer tous les dossiers en tant qu'admin
    const dossiersResponse = await api.get('/dossiers');
    const dossiers = dossiersResponse.data.dossiers || [];
    
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier trouvé pour tester');
      return;
    }
    
    console.log(`📁 ${dossiers.length} dossiers trouvés:`);
    dossiers.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d.numero || d.id} - ${d.client} - Machine: ${d.machine || d.type_formulaire} - Statut: ${d.statut}`);
    });
    
    // Prendre le premier dossier pour les tests
    const testDossier = dossiers[0];
    console.log(`\n🎯 Dossier de test: ${testDossier.numero || testDossier.id} (${testDossier.machine || testDossier.type_formulaire}, ${testDossier.statut})`);
    
    // 2. Tester différents rôles
    const testAccounts = [
      { email: 'preparateur@imprimerie.local', role: 'preparateur', password: 'admin123' },
      { email: 'imprimeur.roland@imprimerie.local', role: 'imprimeur_roland', password: 'admin123' },
      { email: 'imprimeur.xerox@imprimerie.local', role: 'imprimeur_xerox', password: 'admin123' },
      { email: 'livreur@imprimerie.local', role: 'livreur', password: 'admin123' }
    ];
    
    for (const account of testAccounts) {
      console.log(`\n=== ÉTAPE 2: Test ${account.role} (${account.email}) ===`);
      
      const auth = await authenticate(account.email, account.password);
      if (!auth.success) {
        console.log(`❌ Connexion échouée pour ${account.role}`);
        continue;
      }
      
      console.log(`👤 Connecté: ${auth.user.nom} (${auth.user.role})`);
      
      // Test 1: Liste des dossiers
      try {
        const dossiersResp = await api.get('/dossiers');
        const userDossiers = dossiersResp.data.dossiers || [];
        console.log(`📋 Dossiers visibles: ${userDossiers.length}`);
        
        if (userDossiers.length > 0) {
          userDossiers.slice(0, 3).forEach(d => {
            console.log(`    • ${d.numero || d.id} - ${d.statut} - ${d.machine || d.type_formulaire}`);
          });
        }
      } catch (error) {
        console.log(`❌ Erreur liste dossiers: ${error.response?.data?.message || error.message}`);
      }
      
      // Test 2: Accès au dossier spécifique
      try {
        const dossierResp = await api.get(`/dossiers/${testDossier.id}`);
        console.log(`✅ Accès au dossier autorisé`);
        
        // Test 3: Changement de statut
        try {
          const statusChangeResp = await api.put(`/dossiers/${testDossier.id}/statut`, {
            nouveau_statut: 'En cours',
            commentaire: `Test changement par ${account.role}`
          });
          console.log(`✅ Changement de statut autorisé`);
        } catch (statusError) {
          console.log(`❌ Changement de statut refusé: ${statusError.response?.data?.message || statusError.message}`);
        }
        
      } catch (accessError) {
        console.log(`❌ Accès au dossier refusé: ${accessError.response?.data?.message || accessError.message}`);
        
        // Analyser pourquoi l'accès est refusé
        if (accessError.response?.data?.message === 'Dossier non trouvé') {
          console.log(`🔍 ANALYSE: Le message "Dossier non trouvé" masque probablement un problème de permissions`);
          console.log(`   • Dossier machine: ${testDossier.machine || testDossier.type_formulaire}`);
          console.log(`   • Dossier statut: ${testDossier.statut}`);
          console.log(`   • Rôle utilisateur: ${account.role}`);
          
          if (account.role === 'imprimeur_roland' && !(testDossier.machine || testDossier.type_formulaire || '').toLowerCase().includes('roland')) {
            console.log(`   • 🎯 PROBLÈME: Imprimeur Roland essaie d'accéder à un dossier non-Roland`);
          }
          if (account.role === 'imprimeur_xerox' && !(testDossier.machine || testDossier.type_formulaire || '').toLowerCase().includes('xerox')) {
            console.log(`   • 🎯 PROBLÈME: Imprimeur Xerox essaie d'accéder à un dossier non-Xerox`);
          }
          if (account.role === 'livreur') {
            const statut = (testDossier.statut || '').toLowerCase();
            const allowedStatuses = ['termine', 'terminé', 'en_livraison', 'livre', 'livré', 'pret_livraison'];
            const hasAccess = allowedStatuses.some(s => statut.includes(s.toLowerCase()));
            if (!hasAccess) {
              console.log(`   • 🎯 PROBLÈME: Livreur essaie d'accéder à un dossier avec statut non-livraison`);
            }
          }
        }
      }
      
      console.log(''); // Ligne vide pour séparer
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC');
    console.log('='.repeat(80));
    console.log('Le problème "Dossier non trouvé" peut venir de:');
    console.log('1. Restrictions de machine (imprimeurs Roland/Xerox)');
    console.log('2. Restrictions de statut (livreurs)');
    console.log('3. Restrictions de propriété (préparateurs)');
    console.log('');
    console.log('Solution: Modifier le middleware pour retourner un message');
    console.log('d\'autorisation plus explicite au lieu de "Dossier non trouvé"');
    
  } catch (error) {
    console.log(`❌ Erreur générale: ${error.message}`);
  }
}

testRolePermissions().catch(console.error);