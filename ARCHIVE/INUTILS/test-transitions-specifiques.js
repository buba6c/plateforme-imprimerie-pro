#!/usr/bin/env node

/**
 * Test spécifique des changements de statut après corrections
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function authenticate() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    console.log(`✅ Connexion réussie`);
    return response.data.token;
  } catch (error) {
    console.log(`❌ Échec connexion: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testStatusChanges() {
  console.log('🚀 TEST SPÉCIFIQUE: Changements de statut\n');
  
  const token = await authenticate();
  if (!token) {
    console.log('❌ Impossible de s\'authentifier');
    return;
  }
  
  try {
    // Récupérer les dossiers
    const dossiersResponse = await axios.get(`${API_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const dossiers = dossiersResponse.data.dossiers || [];
    console.log(`📋 ${dossiers.length} dossiers disponibles`);
    
    if (dossiers.length === 0) {
      console.log('❌ Aucun dossier pour tester');
      return;
    }
    
    // Tester avec les 3 premiers dossiers
    for (let i = 0; i < Math.min(3, dossiers.length); i++) {
      const dossier = dossiers[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎯 Dossier: ${dossier.numero} - Statut: ${dossier.statut}`);
      
      // Transitions logiques selon l'état actuel
      const nextTransitions = getValidTransitionsForAdmin(dossier.statut);
      
      if (nextTransitions.length === 0) {
        console.log('   ⚠️  Aucune transition définie pour cet état');
        continue;
      }
      
      // Tester la première transition valide
      const targetStatus = nextTransitions[0];
      console.log(`   🔄 Test: ${dossier.statut} → ${targetStatus}`);
      
      try {
        const response = await axios.put(`${API_URL}/dossiers/${dossier.id}/statut`, {
          nouveau_statut: targetStatus
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.status === 200) {
          console.log(`   ✅ Changement réussi !`);
          console.log(`   📄 Message: ${response.data.message}`);
        }
      } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        if (status === 403) {
          console.log(`   ❌ Non autorisé: ${message}`);
        } else if (status === 400) {
          console.log(`   ❌ Requête invalide: ${message}`);
        } else {
          console.log(`   ❌ Erreur ${status}: ${message}`);
        }
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 TEST TERMINÉ');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.log(`❌ Erreur test: ${error.message}`);
  }
}

function getValidTransitionsForAdmin(currentStatus) {
  // Transitions valides pour admin selon les règles modifiées
  const adminTransitions = {
    'À revoir': ['En cours', 'En impression', 'Prêt impression', 'Imprimé', 'Terminé'],
    'En cours': ['À revoir', 'Prêt impression', 'En impression', 'Imprimé', 'Terminé'],
    'Prêt impression': ['En impression', 'À revoir', 'En cours', 'Imprimé', 'Terminé'],
    'En impression': ['Imprimé', 'À revoir', 'En cours', 'Prêt impression', 'Terminé'],
    'Imprimé': ['Prêt livraison', 'En impression', 'À revoir', 'En cours', 'Terminé'],
    'Prêt livraison': ['En livraison', 'Imprimé', 'En impression', 'Terminé'],
    'En livraison': ['Livré', 'Prêt livraison', 'Imprimé', 'Terminé'],
    'Livré': ['Terminé', 'Prêt livraison', 'En livraison', 'En cours', 'Imprimé'],
    'Terminé': ['Livré', 'En cours', 'À revoir'],
    'termine': ['Livré', 'En cours', 'À revoir'], // format underscore
    'en_cours': ['À revoir', 'Prêt impression', 'En impression', 'Imprimé', 'Terminé'],
    'en_impression': ['Imprimé', 'À revoir', 'En cours', 'Prêt impression', 'Terminé'],
  };
  
  return adminTransitions[currentStatus] || ['En cours'];
}

testStatusChanges().catch(console.error);