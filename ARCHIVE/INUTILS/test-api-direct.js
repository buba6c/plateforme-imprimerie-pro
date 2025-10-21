#!/usr/bin/env node

/**
 * 🔍 TEST API EN DIRECT
 * ====================
 * Teste directement l'API pour vérifier qu'elle est bien vide
 */

const axios = require('axios');

async function testApiDirect() {
    const BASE_URL = 'http://localhost:5001/api';
    
    console.log('🔍 TEST API EN DIRECT');
    console.log('===================\n');

    try {
        // 1. Test connexion admin
        console.log('1️⃣ Connexion admin...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Connexion admin réussie');

        // 2. Récupérer les dossiers
        console.log('\n2️⃣ Récupération dossiers API...');
        const dossiersResponse = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const dossiers = dossiersResponse.data.dossiers;
        console.log(`📊 Nombre de dossiers dans l'API : ${dossiers.length}`);
        
        if (dossiers.length === 0) {
            console.log('✅ L\'API est bien vide (comme prévu)');
            console.log('\n🎯 CONCLUSION :');
            console.log('==============');
            console.log('• La base de données est vide ✅');
            console.log('• L\'API retourne 0 dossiers ✅');
            console.log('• Le problème vient du cache navigateur');
            console.log('\n🌐 Dans votre navigateur :');
            console.log('1. Ouvrir http://localhost:3000');
            console.log('2. Appuyer F12 (outils développeur)');
            console.log('3. Console → Taper: localStorage.clear(); location.reload();');
            console.log('4. Ou Ctrl+Shift+R pour vider le cache');
            console.log('\n📱 Alternative: mode navigation privée');
            
        } else {
            console.log('⚠️  L\'API retourne encore des dossiers :');
            dossiers.forEach(d => {
                console.log(`   - ${d.numero_commande} (${d.status})`);
            });
        }

    } catch (error) {
        console.error('❌ Erreur test API:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        
        console.log('\n🔧 VÉRIFICATIONS :');
        console.log('• PM2 est-il démarré ? → pm2 status');
        console.log('• Backend répond-il ? → curl http://localhost:5001/api/auth/me');
    }
}

testApiDirect();