#!/usr/bin/env node

/**
 * 🧪 Test de synchronisation temps réel
 * Teste la création/suppression de dossiers et vérifie la synchronisation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testRealTimeSync() {
    console.log('🧪 Test de synchronisation temps réel');
    console.log('====================================\n');

    try {
        // 1. Connexion préparateur
        console.log('1️⃣ Connexion préparateur...');
        const prepLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'preparateur@imprimerie.local',
            password: 'admin123'
        });
        
        if (!prepLogin.data.token) {
            throw new Error('Connexion préparateur échouée');
        }
        console.log('✅ Préparateur connecté');
        
        // 2. Créer un nouveau dossier
        console.log('\n2️⃣ Création dossier par préparateur...');
        const nouveauDossier = {
            numero_commande: `SYNC-TEST-${Date.now()}`,
            client_nom: 'Client Test Sync',
            type: 'roland',
            description: 'Test synchronisation temps réel',
            quantite: 1,
            client_email: 'test@sync.com',
            client_telephone: '01.23.45.67.89'
        };
        
        const createResponse = await axios.post(`${BASE_URL}/dossiers`, nouveauDossier, {
            headers: { Authorization: `Bearer ${prepLogin.data.token}` }
        });
        
        const dossierCree = createResponse.data.dossier;
        console.log(`✅ Dossier créé: ${dossierCree.numero_commande} (ID: ${dossierCree.id})`);
        
        // 3. Vérifier visibilité pour préparateur
        console.log('\n3️⃣ Vérification visibilité préparateur...');
        const prepDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${prepLogin.data.token}` }
        });
        
        const prepVoitNouveau = prepDossiers.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`📊 Préparateur voit le nouveau dossier: ${prepVoitNouveau ? '✅' : '❌'}`);
        
        // 4. Connexion admin
        console.log('\n4️⃣ Connexion admin...');
        const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        
        // 5. Vérifier visibilité pour admin
        console.log('5️⃣ Vérification visibilité admin...');
        const adminDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${adminLogin.data.token}` }
        });
        
        const adminVoitNouveau = adminDossiers.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`📊 Admin voit le nouveau dossier: ${adminVoitNouveau ? '✅' : '❌'}`);
        
        // 6. Connexion imprimeur Roland
        console.log('\n6️⃣ Connexion imprimeur Roland...');
        const rolandLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'roland@imprimerie.local',
            password: 'admin123'
        });
        
        // 7. Vérifier visibilité pour imprimeur Roland
        console.log('7️⃣ Vérification visibilité imprimeur Roland...');
        const rolandDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${rolandLogin.data.token}` }
        });
        
        const rolandVoitNouveau = rolandDossiers.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`📊 Roland voit le nouveau dossier (type=${dossierCree.type}): ${rolandVoitNouveau ? '✅' : '❌'}`);
        
        // 8. Supprimer le dossier de test
        console.log('\n8️⃣ Suppression du dossier test...');
        await axios.delete(`${BASE_URL}/dossiers`, {
            data: { ids: [dossierCree.id] },
            headers: { Authorization: `Bearer ${adminLogin.data.token}` }
        });
        console.log('✅ Dossier supprimé');
        
        // 9. Résumé
        console.log('\n📊 RÉSUMÉ DU TEST:');
        console.log(`   • Préparateur voit son dossier: ${prepVoitNouveau ? '✅' : '❌'}`);
        console.log(`   • Admin voit tous les dossiers: ${adminVoitNouveau ? '✅' : '❌'}`);  
        console.log(`   • Roland voit dossiers Roland: ${rolandVoitNouveau ? '✅' : '❌'}`);
        
        const allGood = prepVoitNouveau && adminVoitNouveau && rolandVoitNouveau;
        console.log(`\n🎯 Synchronisation: ${allGood ? '🟢 PARFAITE' : '🔴 À CORRIGER'}`);
        
        if (allGood) {
            console.log('\n🎉 Les dossiers créés par Préparateur apparaissent immédiatement chez Admin et Imprimeur !');
        }
        
    } catch (error) {
        console.error('❌ Erreur pendant le test:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testRealTimeSync();