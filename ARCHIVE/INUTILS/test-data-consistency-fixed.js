#!/usr/bin/env node

/**
 * Test de cohérence des données entre l'API réelle et les données mock
 * Vérifie que les dossiers affichés sont identiques pour tous les rôles
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testDataConsistency() {
    console.log('🧪 Test de cohérence des données');
    console.log('================================\n');

    try {
        let adminDossiers = null;
        let prepDossiers = null;
        
        // Test 1: Connexion admin
        console.log('1️⃣ Test connexion Admin...');
        const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        
        if (adminLogin.data.token) {
            console.log('✅ Admin connecté');
            
            // Récupérer les dossiers pour l'admin
            adminDossiers = await axios.get(`${BASE_URL}/dossiers`, {
                headers: { Authorization: `Bearer ${adminLogin.data.token}` }
            });
            
            console.log(`📊 Admin voit ${adminDossiers.data.dossiers.length} dossiers:`);
            adminDossiers.data.dossiers.forEach(d => {
                console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
            });
        } else {
            console.log('❌ Connexion admin échouée:', adminLogin.data);
        }
        
        console.log('\n2️⃣ Test connexion Préparateur...');
        // Test 2: Connexion préparateur  
        const prepLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'preparateur@imprimerie.local', 
            password: 'admin123'
        });
        
        if (prepLogin.data.token) {
            console.log('✅ Préparateur connecté');
            
            // Récupérer les dossiers pour le préparateur
            prepDossiers = await axios.get(`${BASE_URL}/dossiers`, {
                headers: { Authorization: `Bearer ${prepLogin.data.token}` }
            });
            
            console.log(`📊 Préparateur voit ${prepDossiers.data.dossiers.length} dossiers:`);
            prepDossiers.data.dossiers.forEach(d => {
                console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
            });
        } else {
            console.log('❌ Connexion préparateur échouée:', prepLogin.data);
        }

        console.log('\n🔍 Comparaison des résultats...');
        // Comparaison entre admin et préparateur
        if (adminDossiers && prepDossiers) {
            const adminDossierIds = adminDossiers.data.dossiers.map(d => d.numero_commande).sort();
            const prepDossierIds = prepDossiers.data.dossiers.map(d => d.numero_commande).sort();
            
            const identical = JSON.stringify(adminDossierIds) === JSON.stringify(prepDossierIds);
            
            console.log(`🔄 Cohérence des données: ${identical ? '✅ IDENTIQUES' : '❌ DIFFÉRENTES'}`);
            
            if (!identical) {
                console.log('❗ Admin uniquement:', adminDossierIds.filter(x => !prepDossierIds.includes(x)));
                console.log('❗ Préparateur uniquement:', prepDossierIds.filter(x => !adminDossierIds.includes(x)));
            }
        } else {
            console.log('⚠️ Impossible de comparer - données manquantes');
        }
        
        console.log('\n✅ Test de cohérence terminé !');
        
    } catch (error) {
        console.log('❌ Erreur pendant le test:', error.message);
        if (error.response) {
            console.log('Response:', error.response.data);
        }
    }
}

// Lancement du test
testDataConsistency();