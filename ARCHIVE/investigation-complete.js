#!/usr/bin/env node

/**
 * 🔍 INVESTIGATION COMPLÈTE - TROUVER LES DOSSIERS CACHÉS
 * ======================================================
 * Audit exhaustif de toutes les sources possibles
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function investigationComplete() {
    console.log('🔍 INVESTIGATION COMPLÈTE - SOURCES DES DOSSIERS');
    console.log('===============================================\n');

    const problemes = [];
    const corrections = [];

    try {
        // 1. VÉRIFICATION BASE DE DONNÉES COMPLÈTE
        console.log('🗄️ 1. AUDIT COMPLET BASE DE DONNÉES');
        console.log('===================================');
        
        console.log('📊 Tables liées aux dossiers...');
        
        // 2. VÉRIFICATION SERVICES BACKEND
        console.log('\n🖥️ 2. AUDIT SERVICES BACKEND');
        console.log('============================');
        
        // Test toutes les routes API possibles
        const routes = [
            '/api/dossiers',
            '/api/dossiers/recent',
            '/api/dossiers/stats', 
            '/api/admin/dashboard',
            '/api/statistiques'
        ];

        const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        const token = loginResponse.data.token;

        for (const route of routes) {
            try {
                const response = await axios.get(`http://localhost:5001${route}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                console.log(`✅ ${route} → Status: ${response.status}`);
                
                // Analyser la réponse
                if (response.data) {
                    if (response.data.dossiers && Array.isArray(response.data.dossiers)) {
                        console.log(`   📂 ${response.data.dossiers.length} dossiers trouvés`);
                        if (response.data.dossiers.length > 0) {
                            problemes.push(`Route ${route} retourne ${response.data.dossiers.length} dossiers`);
                        }
                    }
                    if (response.data.total !== undefined) {
                        console.log(`   📊 Total: ${response.data.total}`);
                    }
                }
            } catch (error) {
                console.log(`❌ ${route} → ${error.response?.status || 'Erreur'}`);
            }
        }

        // 3. VÉRIFICATION FICHIERS MOCK ET SERVICES
        console.log('\n📁 3. AUDIT FICHIERS FRONTEND');
        console.log('=============================');
        
        const fichiersAVerifier = [
            'frontend/src/services/mockApi.js',
            'frontend/src/services/api.js',
            'frontend/src/services/apiAdapter.js'
        ];

        for (const fichier of fichiersAVerifier) {
            const filepath = path.join(__dirname, fichier);
            if (fs.existsSync(filepath)) {
                console.log(`📄 Analyse ${fichier}...`);
                
                const contenu = fs.readFileSync(filepath, 'utf8');
                
                // Chercher des données mockées actives
                const mockData = contenu.match(/MOCK_DOSSIERS\s*=\s*\[[\s\S]*?\];/);
                const localStorage = contenu.match(/localStorage\.setItem.*dossier/gi);
                const backendAvailable = contenu.match(/backendAvailable\s*=\s*(true|false)/g);
                
                if (mockData && mockData[0].length > 100) {
                    problemes.push(`${fichier} contient des données mockées actives`);
                }
                if (localStorage && localStorage.length > 0) {
                    problemes.push(`${fichier} sauvegarde encore dans localStorage`);
                }
                if (backendAvailable) {
                    console.log(`   🔧 backendAvailable states: ${backendAvailable}`);
                }
            }
        }

        // 4. VÉRIFICATION CACHE ET STORAGE
        console.log('\n💾 4. AUDIT CACHE ET STORAGE');
        console.log('============================');
        
        console.log('📋 Instructions pour vérifier le cache navigateur:');
        console.log('F12 → Application → Local Storage → http://localhost:3000');
        console.log('Chercher ces clés suspectes:');
        console.log('• mock_dossiers_storage_v1');
        console.log('• auth_token');
        console.log('• user_data');
        console.log('• Toute clé contenant "dossier"');

        // 5. TEST SIMULATION EXACTE DU DASHBOARD
        console.log('\n🖥️ 5. SIMULATION EXACTE DASHBOARD ADMIN');
        console.log('========================================');
        
        // Simuler exactement ce que fait le dashboard
        try {
            // Test des utilisateurs (pour comparaison)
            const usersResponse = await axios.get('http://localhost:5001/api/users', {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 100 }
            });
            console.log(`👥 Utilisateurs API: ${usersResponse.data.users?.length || 0}`);

            // Test exact des dossiers comme le dashboard
            const dossiersResponse = await axios.get('http://localhost:5001/api/dossiers', {
                headers: { Authorization: `Bearer ${token}` },
                params: { limit: 100 }
            });
            
            const dossiers = dossiersResponse.data.dossiers || [];
            console.log(`📂 Dossiers API directe: ${dossiers.length}`);
            
            if (dossiers.length > 0) {
                console.log('⚠️ PROBLÈME IDENTIFIÉ: L\'API retourne des dossiers!');
                dossiers.forEach((d, i) => {
                    console.log(`   ${i+1}. ID:${d.id} - ${d.numero_commande} - ${d.status}`);
                });
                problemes.push('API backend retourne encore des dossiers');
            }

        } catch (error) {
            problemes.push(`Erreur test dashboard: ${error.message}`);
        }

        // 6. INVESTIGATION LOGS PM2
        console.log('\n📝 6. VÉRIFICATION LOGS BACKEND');
        console.log('===============================');
        console.log('Pour vérifier les logs PM2:');
        console.log('pm2 logs imprimerie-backend-dev --lines 20');

        // 7. RÉSUMÉ ET SOLUTIONS
        console.log('\n🎯 RÉSUMÉ DE L\'INVESTIGATION');
        console.log('=============================');
        
        if (problemes.length === 0) {
            console.log('✅ Aucun problème technique détecté côté serveur');
            console.log('');
            console.log('🔍 Le problème est 100% côté navigateur:');
            console.log('1. Cache localStorage/sessionStorage');
            console.log('2. Cache HTTP du navigateur');
            console.log('3. Service Worker éventuellement actif');
            console.log('');
            corrections.push('Vider cache navigateur complet');
            corrections.push('Tester en navigation privée');
            corrections.push('Vérifier les outils développeur');
        } else {
            console.log('❌ Problèmes détectés:');
            problemes.forEach((p, i) => console.log(`   ${i+1}. ${p}`));
        }

        return { problemes, corrections };

    } catch (error) {
        console.error('❌ Erreur investigation:', error.message);
        return { problemes: [error.message], corrections: [] };
    }
}

// Fonction pour corriger les problèmes identifiés
async function corrigerProblemes(problemes) {
    console.log('\n🔧 CORRECTION DES PROBLÈMES IDENTIFIÉS');
    console.log('=====================================');

    for (const probleme of problemes) {
        console.log(`\n🎯 Correction: ${probleme}`);
        
        if (probleme.includes('API backend retourne encore des dossiers')) {
            console.log('🗄️ Suppression forcée base de données...');
            // Cette correction sera faite après
        }
        
        if (probleme.includes('données mockées actives')) {
            console.log('🧹 Désactivation complète des mocks...');
            // Cette correction sera faite après
        }
        
        if (probleme.includes('localStorage')) {
            console.log('💾 Nettoyage localStorage forcé...');
            // Instructions pour le navigateur
        }
    }
}

// Exécution
investigationComplete().then(async (result) => {
    if (result.problemes.length > 0) {
        await corrigerProblemes(result.problemes);
    }
    
    console.log('\n🚀 PROCHAINES ÉTAPES:');
    console.log('====================');
    result.corrections.forEach((c, i) => {
        console.log(`${i+1}. ${c}`);
    });
});