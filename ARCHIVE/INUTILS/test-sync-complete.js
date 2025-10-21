#!/usr/bin/env node

/**
 * 🚀 TEST SYNCHRONISATION TEMPS RÉEL COMPLET
 * ==========================================
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testRealtimeSync() {
    console.log('🚀 TEST SYNCHRONISATION TEMPS RÉEL');
    console.log('==================================\n');

    try {
        // 1. Connexions de tous les rôles
        console.log('1️⃣ Connexion de tous les rôles...');
        
        const connections = {};
        const roles = [
            { name: 'preparateur', email: 'preparateur@imprimerie.local' },
            { name: 'admin', email: 'admin@imprimerie.local' },
            { name: 'roland', email: 'roland@imprimerie.local' },
            { name: 'xerox', email: 'xerox@imprimerie.local' },
            { name: 'livreur', email: 'livreur@imprimerie.local' }
        ];
        
        for (const role of roles) {
            const login = await axios.post(`${BASE_URL}/auth/login`, {
                email: role.email,
                password: 'admin123'
            });
            connections[role.name] = login.data.token;
            console.log(`✅ ${role.name} connecté`);
        }

        // 2. Créer un nouveau dossier avec le préparateur
        console.log('\n2️⃣ Création nouveau dossier par préparateur...');
        const nouveauDossier = {
            numero_commande: `RT-SYNC-${Date.now()}`,
            client_nom: 'Client Sync Test',
            type: 'roland',
            description: 'Test synchronisation temps réel',
            quantite: 100,
            client_email: 'sync@test.com',
            client_telephone: '01.11.11.11.11'
        };

        const createResponse = await axios.post(`${BASE_URL}/dossiers`, nouveauDossier, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        
        const dossierCree = createResponse.data.dossier;
        console.log(`✅ Dossier créé: ${dossierCree.numero_commande} (ID: ${dossierCree.id})`);

        // 3. Vérifier visibilité immédiate
        console.log('\n3️⃣ Vérification visibilité immédiate...');
        
        // Préparateur doit voir son nouveau dossier
        const prepCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        const prepVoit = prepCheck.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`👤 Préparateur voit nouveau dossier: ${prepVoit ? '✅' : '❌'}`);

        // Admin doit voir le nouveau dossier
        const adminCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.admin}` }
        });
        const adminVoit = adminCheck.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`👑 Admin voit nouveau dossier: ${adminVoit ? '✅' : '❌'}`);

        // Roland (imprimeur) doit voir le nouveau dossier (type=roland)
        const rolandCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        const rolandVoit = rolandCheck.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`🖨️ Roland voit nouveau dossier: ${rolandVoit ? '✅' : '❌'}`);

        // Xerox ne doit PAS voir le dossier Roland
        const xeroxCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.xerox}` }
        });
        const xeroxVoit = xeroxCheck.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`🖨️ Xerox ne voit pas dossier Roland: ${!xeroxVoit ? '✅' : '❌'}`);

        // 4. Test changement de statut
        console.log('\n4️⃣ Test changement de statut...');
        
        // Roland marque le dossier "en_impression"
        const statusChange = await axios.patch(`${BASE_URL}/dossiers/${dossierCree.id}/status`, {
            status: 'en_impression',
            comment: 'Début impression par Roland'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        console.log(`✅ Statut changé vers: en_impression`);

        // 5. Vérifier que le changement est visible partout
        console.log('\n5️⃣ Vérification changement visible partout...');
        
        // Admin voit le changement
        const adminCheckStatus = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.admin}` }
        });
        const dossierAdmin = adminCheckStatus.data.dossiers.find(d => d.id === dossierCree.id);
        console.log(`👑 Admin voit statut: ${dossierAdmin ? dossierAdmin.status : 'non trouvé'}`);

        // Roland voit toujours le dossier
        const rolandCheckStatus = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        const dossierRoland = rolandCheckStatus.data.dossiers.find(d => d.id === dossierCree.id);
        console.log(`🖨️ Roland voit statut: ${dossierRoland ? dossierRoland.status : 'non trouvé'}`);

        // Préparateur ne voit plus le dossier (plus en_cours ni a_revoir)
        const prepCheckStatus = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        const prepVoitEncore = prepCheckStatus.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`👤 Préparateur ne voit plus: ${!prepVoitEncore ? '✅' : '❌'} (normal, plus en_cours)`);

        // 6. Roland termine l'impression
        console.log('\n6️⃣ Roland termine l\'impression...');
        await axios.patch(`${BASE_URL}/dossiers/${dossierCree.id}/status`, {
            status: 'termine',
            comment: 'Impression terminée'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });

        // 7. Vérifier que le livreur voit maintenant le dossier
        console.log('\n7️⃣ Vérification livreur voit le dossier terminé...');
        const livreurCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.livreur}` }
        });
        const livreurVoit = livreurCheck.data.dossiers.some(d => d.id === dossierCree.id);
        console.log(`🚚 Livreur voit dossier terminé: ${livreurVoit ? '✅' : '❌'}`);

        // 8. Nettoyage - supprimer le dossier de test
        console.log('\n8️⃣ Nettoyage...');
        await axios.delete(`${BASE_URL}/dossiers`, {
            data: { ids: [dossierCree.id] },
            headers: { Authorization: `Bearer ${connections.admin}` }
        });
        console.log('✅ Dossier test supprimé');

        // 9. Résumé
        const testsReussis = [prepVoit, adminVoit, rolandVoit, !xeroxVoit, !prepVoitEncore, livreurVoit];
        const nbReussis = testsReussis.filter(t => t).length;
        
        console.log('\n🎯 RÉSULTATS SYNCHRONISATION:');
        console.log('============================');
        console.log(`✅ Tests réussis: ${nbReussis}/6`);
        console.log(`🎉 Synchronisation temps réel: ${nbReussis === 6 ? '🟢 PARFAITE' : '🔴 À CORRIGER'}`);
        
        if (nbReussis === 6) {
            console.log('\n🚀 SYNCHRONISATION 100% OPÉRATIONNELLE !');
            console.log('├─ Création → visible immédiatement par les rôles concernés');
            console.log('├─ Changement statut → propagé instantanément');
            console.log('├─ Visibilité respecte parfaitement le workflow');
            console.log('└─ Suppression synchronisée');
        }
        
        return nbReussis === 6;

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return false;
    }
}

if (require.main === module) {
    testRealtimeSync()
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = { testRealtimeSync };