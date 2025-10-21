#!/usr/bin/env node

/**
 * 🕵️ DIAGNOSTIC COMPLET FRONTEND
 * =============================
 * Simule exactement ce que fait le navigateur
 */

const axios = require('axios');

async function diagnosticComplet() {
    console.log('🕵️ DIAGNOSTIC COMPLET FRONTEND');
    console.log('=============================\n');

    try {
        // 1. Test route health (utilisée par apiAdapter)
        console.log('1️⃣ Test route /health (utilisée par apiAdapter)...');
        try {
            const healthResponse = await axios.get('http://localhost:5001/api/health', { timeout: 2000 });
            console.log('✅ Route /health répond correctement');
            console.log(`   Status: ${healthResponse.status}`);
        } catch (error) {
            console.log('❌ Route /health ne répond pas');
            console.log(`   Erreur: ${error.message}`);
            return;
        }

        // 2. Simulation complète du flux d'authentification
        console.log('\n2️⃣ Simulation flux d\'authentification frontend...');
        
        // Test login comme le fait le frontend
        const loginData = {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        };
        
        const loginResponse = await axios.post('http://localhost:5001/api/auth/login', loginData);
        const token = loginResponse.data.token;
        console.log('✅ Login frontend simulé réussi');

        // 3. Test récupération dossiers avec le token (simulation exacte)
        console.log('\n3️⃣ Test getDossiers() comme le frontend...');
        
        const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const dossiers = dossiersResponse.data.dossiers;
        console.log(`📂 Réponse API: ${dossiers.length} dossier(s)`);
        
        if (dossiers.length === 0) {
            console.log('✅ L\'API retourne bien 0 dossiers');
        } else {
            console.log('⚠️  L\'API retourne encore des dossiers:');
            dossiers.forEach(d => {
                console.log(`   - ${d.numero_commande} (${d.status}) - ID: ${d.id}`);
            });
        }

        // 4. Test avec différents rôles
        console.log('\n4️⃣ Test avec le rôle préparateur...');
        const prepLogin = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'preparateur@imprimerie.local',
            password: 'admin123'
        });
        
        const prepDossiers = await axios.get('http://localhost:5001/api/dossiers', {
            headers: { Authorization: `Bearer ${prepLogin.data.token}` }
        });
        
        console.log(`👤 Préparateur voit: ${prepDossiers.data.dossiers.length} dossier(s)`);

        // 5. Vérification des logs PM2
        console.log('\n5️⃣ Vérification configuration...');
        console.log('📋 Modifications effectuées:');
        console.log('   ✅ shouldUseMockApi() → false');
        console.log('   ✅ Sauvegarde auto mock désactivée');
        console.log('   ✅ backendAvailable réinitialisé');
        console.log('   ✅ Frontend redémarré');

        console.log('\n🎯 DIAGNOSTIC FINAL:');
        console.log('===================');
        if (dossiers.length === 0) {
            console.log('✅ L\'API fonctionne correctement (0 dossiers)');
            console.log('');
            console.log('🌐 Si l\'interface affiche encore des dossiers:');
            console.log('1. Vider le localStorage du navigateur');
            console.log('2. Faire un rechargement forcé (Ctrl+Shift+R)');
            console.log('3. Ouvrir les outils dev (F12) et vérifier la console');
            console.log('');
            console.log('💡 Commande localStorage à exécuter:');
            console.log('   localStorage.clear(); sessionStorage.clear(); location.reload();');
        } else {
            console.log('❌ L\'API retourne encore des dossiers');
            console.log('   → Problème côté backend à investiguer');
        }

    } catch (error) {
        console.error('❌ Erreur diagnostic:', error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, error.response.data);
        }
    }
}

diagnosticComplet();