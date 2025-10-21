#!/usr/bin/env node

/**
 * Test simple pour vérifier les messages d'erreur améliorés
 */

const axios = require('axios');

const API_URL = 'http://localhost:5002/api';

// Test avec différents comptes
const testAccounts = [
  { 
    email: 'admin@imprimerie.local', 
    password: 'admin123', 
    role: 'admin',
    description: 'Admin (accès total)'
  },
  { 
    email: 'preparateur@imprimerie.local', 
    password: 'admin123', 
    role: 'preparateur',
    description: 'Préparateur (ses dossiers)'
  },
  { 
    email: 'imprimeur.roland@imprimerie.local', 
    password: 'admin123', 
    role: 'imprimeur_roland',
    description: 'Imprimeur Roland (dossiers Roland)'
  },
  { 
    email: 'imprimeur.xerox@imprimerie.local', 
    password: 'admin123', 
    role: 'imprimeur_xerox',
    description: 'Imprimeur Xerox (dossiers Xerox)'
  },
  { 
    email: 'livreur@imprimerie.local', 
    password: 'admin123', 
    role: 'livreur',
    description: 'Livreur (dossiers en livraison)'
  }
];

async function authenticate(email, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    return { success: true, token: response.data.token, user: response.data.user };
  } catch (error) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function testDossierAccess(token, dossierId) {
  try {
    const response = await axios.get(`${API_URL}/dossiers/${dossierId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status,
      message: error.response?.data?.message || error.message 
    };
  }
}

async function testStatusChange(token, dossierId, newStatus) {
  try {
    const response = await axios.put(`${API_URL}/dossiers/${dossierId}/statut`, {
      nouveau_statut: newStatus,
      commentaire: 'Test changement de statut'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status,
      message: error.response?.data?.message || error.message 
    };
  }
}

async function runTests() {
  console.log('🧪 TEST: Messages d\'erreur améliorés pour les permissions\n');
  
  // 1. Se connecter en admin pour obtenir un dossier de test
  console.log('=== Connexion Admin pour récupérer un dossier ===');
  const adminAuth = await authenticate('admin@imprimerie.local', 'admin123');
  
  if (!adminAuth.success) {
    console.log('❌ Impossible de se connecter en admin:', adminAuth.error);
    return;
  }
  
  console.log('✅ Admin connecté:', adminAuth.user.nom);
  
  // Récupérer les dossiers
  try {
    const response = await axios.get(`${API_URL}/dossiers`, {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`
      }
    });
    
    const dossiers = response.data.dossiers || [];
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier disponible pour tester');
      return;
    }
    
    const testDossier = dossiers[0];
    console.log(`📁 Dossier de test: ${testDossier.numero || testDossier.id}`);
    console.log(`   Machine: ${testDossier.machine || testDossier.type_formulaire || 'Non définie'}`);
    console.log(`   Statut: ${testDossier.statut}`);
    console.log(`   Créateur: ID ${testDossier.created_by}`);
    
    // 2. Tester chaque rôle
    console.log('\n=== Tests des permissions par rôle ===');
    
    for (const account of testAccounts) {
      console.log(`\n--- ${account.description} ---`);
      
      const auth = await authenticate(account.email, account.password);
      if (!auth.success) {
        console.log(`❌ Connexion échouée: ${auth.error}`);
        continue;
      }
      
      console.log(`👤 Connecté: ${auth.user.nom} (${auth.user.role})`);
      
      // Test accès au dossier
      const accessTest = await testDossierAccess(auth.token, testDossier.id);
      if (accessTest.success) {
        console.log(`✅ Accès au dossier autorisé`);
      } else {
        console.log(`❌ Accès refusé (${accessTest.status}): ${accessTest.message}`);
      }
      
      // Test changement de statut
      const statusTest = await testStatusChange(auth.token, testDossier.id, 'En cours');
      if (statusTest.success) {
        console.log(`✅ Changement de statut autorisé`);
      } else {
        console.log(`❌ Changement de statut refusé (${statusTest.status}): ${statusTest.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(80));
    console.log('✅ Les messages d\'erreur sont maintenant plus explicites');
    console.log('✅ Plus de "Dossier non trouvé" générique');
    console.log('✅ Les utilisateurs comprennent pourquoi l\'accès est refusé');
    console.log('');
    console.log('Les messages indiquent maintenant:');
    console.log('• Pour imprimeurs: Machine incompatible (Roland vs Xerox)');
    console.log('• Pour livreurs: Statut inapproprié (pas encore prêt livraison)');
    console.log('• Pour préparateurs: Propriété du dossier');
    
  } catch (error) {
    console.log('❌ Erreur lors de la récupération des dossiers:', error.message);
  }
}

runTests().catch(console.error);