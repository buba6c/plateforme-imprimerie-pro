#!/usr/bin/env node

/**
 * 🔍 DIAGNOSTIC DASHBOARD ADMIN
 * ===========================
 * Test spécifique de ce que voit le dashboard admin
 */

const axios = require('axios');

async function testDashboardAdmin() {
    console.log('🔍 DIAGNOSTIC DASHBOARD ADMIN');
    console.log('===========================\n');

    try {
        // 1. Connexion admin comme le fait le dashboard
        console.log('🔐 1. Connexion admin (simulation dashboard)...');
        const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        const user = loginResponse.data.user;
        console.log('✅ Admin connecté');
        console.log(`   Rôle: ${user.role}`);

        // 2. Test exact de ce que fait le dashboard - getDossiers avec limite 100
        console.log('\n📊 2. Test getDossiers() exactement comme le dashboard...');
        
        const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            params: { limit: 100 }  // Comme dans le dashboard
        });
        
        console.log('Response status:', dossiersResponse.status);
        console.log('Response structure:', Object.keys(dossiersResponse.data));
        
        // Le dashboard cherche dossiersData.data || dossiersData.dossiers
        const dossiers = dossiersResponse.data.data || dossiersResponse.data.dossiers || [];
        
        console.log(`📂 Dossiers trouvés: ${dossiers.length}`);
        
        if (dossiers.length > 0) {
            console.log('⚠️  PROBLÈME: L\'API retourne encore des dossiers!');
            dossiers.forEach((d, index) => {
                console.log(`   ${index + 1}. ${d.numero_commande} - ${d.status} (ID: ${d.id})`);
            });
        } else {
            console.log('✅ L\'API retourne bien 0 dossiers');
        }

        // 3. Calcul des statistiques comme le dashboard
        console.log('\n📈 3. Calcul statistiques comme le dashboard...');
        
        const stats = {
            total: dossiers.length,
            nouveau: dossiers.filter(d => d.status === 'nouveau').length,
            en_cours: dossiers.filter(d => ['en_preparation', 'pret_impression', 'en_impression', 'imprime', 'pret_livraison', 'en_livraison'].includes(d.status)).length,
            termines: dossiers.filter(d => ['livre', 'termine'].includes(d.status)).length
        };

        console.log('Statistiques calculées:');
        console.log(`   📁 Total: ${stats.total}`);
        console.log(`   🆕 Nouveau: ${stats.nouveau}`);
        console.log(`   ⏳ En cours: ${stats.en_cours}`);
        console.log(`   ✅ Terminés: ${stats.termines}`);

        // 4. Test users pour comparaison
        console.log('\n👥 4. Test statistiques utilisateurs...');
        try {
            const usersResponse = await axios.get('http://localhost:5001/api/users', {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 100 }
            });
            
            const users = usersResponse.data.users || [];
            console.log(`👤 Utilisateurs trouvés: ${users.length}`);
        } catch (error) {
            console.log(`❌ Erreur users: ${error.response?.status || error.message}`);
        }

        // 5. Conclusion
        console.log('\n🎯 CONCLUSION:');
        console.log('=============');
        
        if (dossiers.length === 0) {
            console.log('✅ L\'API backend fonctionne correctement');
            console.log('✅ 0 dossiers dans la base de données');
            console.log('');
            console.log('🌐 Le problème vient du CACHE NAVIGATEUR');
            console.log('');
            console.log('🛠️  SOLUTION IMMÉDIATE:');
            console.log('Dans votre navigateur admin (F12 → Console):');
            console.log('');
            console.log('   // Vider complètement le cache');
            console.log('   Object.keys(localStorage).forEach(k => {');
            console.log('       console.log("Suppression:", k, localStorage.getItem(k));');
            console.log('       localStorage.removeItem(k);');
            console.log('   });');
            console.log('   sessionStorage.clear();');
            console.log('   location.reload(true);');
            console.log('');
            console.log('📱 Alternative: Mode navigation privée');
            console.log('   Ctrl+Shift+N → http://localhost:3000');
        } else {
            console.log('❌ Problème: L\'API retourne encore des dossiers');
            console.log('   → Vérifier la base de données');
        }

    } catch (error) {
        console.error('❌ Erreur test dashboard:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testDashboardAdmin();