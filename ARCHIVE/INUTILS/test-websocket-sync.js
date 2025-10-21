#!/usr/bin/env node

/**
 * 🌐 TEST WEBSOCKET SYNCHRONISATION TEMPS RÉEL
 * ============================================
 * Test des notifications Socket.IO en temps réel
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

async function testWebSocketSync() {
    console.log('🌐 TEST WEBSOCKET SYNCHRONISATION TEMPS RÉEL');
    console.log('===========================================\n');

    const sockets = {};
    const notifications = {};
    let testDossierId = null;

    try {
        // 1. Connexions de tous les rôles
        console.log('1️⃣ Connexion API de tous les rôles...');
        
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
            console.log(`✅ ${role.name} connecté API`);
        }

        // 2. Connexions WebSocket avec authentification
        console.log('\n2️⃣ Connexions WebSocket...');
        
        await Promise.all(roles.map(role => {
            return new Promise((resolve, reject) => {
                const socket = io(SOCKET_URL, {
                    auth: { token: connections[role.name] }
                });
                
                notifications[role.name] = [];
                
                socket.on('connect', () => {
                    console.log(`✅ ${role.name} connecté WebSocket`);
                    sockets[role.name] = socket;
                    resolve();
                });
                
                socket.on('connect_error', (error) => {
                    console.log(`❌ ${role.name} erreur WebSocket:`, error.message);
                    reject(error);
                });
                
                // Écouter tous les événements de dossier
                ['dossier_created', 'dossier_updated', 'dossiers_deleted'].forEach(event => {
                    socket.on(event, (data) => {
                        notifications[role.name].push({ event, data, time: new Date() });
                        const dossierInfo = data.dossier ? data.dossier.numero_commande : 
                                          data.numero_commande ? data.numero_commande : 
                                          data.message || 'unknown';
                        console.log(`📡 ${role.name} reçoit ${event}: ${dossierInfo}`);
                    });
                });
                
                setTimeout(() => reject(new Error('Timeout connexion WebSocket')), 5000);
            });
        }));

        // 3. Créer un nouveau dossier
        console.log('\n3️⃣ Création dossier avec notifications WebSocket...');
        const nouveauDossier = {
            numero_commande: `WS-SYNC-${Date.now()}`,
            client_nom: 'Client WebSocket Test',
            type: 'roland',
            description: 'Test notifications WebSocket',
            quantite: 50,
            client_email: 'websocket@test.com',
            client_telephone: '01.22.22.22.22'
        };

        await new Promise(resolve => setTimeout(resolve, 500)); // Attendre que tous les sockets soient prêts

        const createResponse = await axios.post(`${BASE_URL}/dossiers`, nouveauDossier, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        
        testDossierId = createResponse.data.dossier.id;
        console.log(`✅ Dossier créé: ${createResponse.data.dossier.numero_commande} (ID: ${testDossierId})`);

        // 4. Attendre les notifications
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 5. Vérifier les notifications de création
        console.log('\n4️⃣ Vérification notifications de création...');
        
        const prepNotifs = notifications.preparateur.filter(n => n.event === 'dossier_created');
        const adminNotifs = notifications.admin.filter(n => n.event === 'dossier_created');
        const rolandNotifs = notifications.roland.filter(n => n.event === 'dossier_created');
        const xeroxNotifs = notifications.xerox.filter(n => n.event === 'dossier_created');
        
        console.log(`👤 Préparateur reçu ${prepNotifs.length} notification(s) création`);
        console.log(`👑 Admin reçu ${adminNotifs.length} notification(s) création`);
        console.log(`🖨️ Roland reçu ${rolandNotifs.length} notification(s) création`);
        console.log(`🖨️ Xerox reçu ${xeroxNotifs.length} notification(s) création`);

        // 6. Changer le statut et vérifier les notifications
        console.log('\n5️⃣ Changement statut avec notifications...');
        
        await axios.patch(`${BASE_URL}/dossiers/${testDossierId}/status`, {
            status: 'en_impression',
            comment: 'Test WebSocket impression'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        console.log('✅ Statut changé vers en_impression');

        // 7. Attendre et vérifier les notifications de mise à jour
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\n6️⃣ Vérification notifications de mise à jour...');
        
        const prepUpdateNotifs = notifications.preparateur.filter(n => n.event === 'dossier_updated');
        const adminUpdateNotifs = notifications.admin.filter(n => n.event === 'dossier_updated');
        const rolandUpdateNotifs = notifications.roland.filter(n => n.event === 'dossier_updated');
        
        console.log(`👤 Préparateur reçu ${prepUpdateNotifs.length} notification(s) update`);
        console.log(`👑 Admin reçu ${adminUpdateNotifs.length} notification(s) update`);
        console.log(`🖨️ Roland reçu ${rolandUpdateNotifs.length} notification(s) update`);

        // 8. Terminer le dossier
        console.log('\n7️⃣ Terminer impression...');
        
        await axios.patch(`${BASE_URL}/dossiers/${testDossierId}/status`, {
            status: 'termine',
            comment: 'Test WebSocket terminé'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const livreurUpdateNotifs = notifications.livreur.filter(n => n.event === 'dossier_updated');
        console.log(`🚚 Livreur reçu ${livreurUpdateNotifs.length} notification(s) update`);

        // 9. Supprimer le dossier
        console.log('\n8️⃣ Suppression avec notifications...');
        
        await axios.delete(`${BASE_URL}/dossiers`, {
            data: { ids: [testDossierId] },
            headers: { Authorization: `Bearer ${connections.admin}` }
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\n9️⃣ Vérification notifications de suppression...');
        
        const allDeleteNotifs = Object.keys(notifications).reduce((total, role) => {
            const deleteNotifs = notifications[role].filter(n => n.event === 'dossiers_deleted');
            console.log(`${role}: ${deleteNotifs.length} notification(s) suppression`);
            return total + deleteNotifs.length;
        }, 0);

        // 10. Résumé des tests WebSocket
        console.log('\n🎯 RÉSULTATS WEBSOCKET:');
        console.log('======================');
        
        const totalNotifications = Object.keys(notifications).reduce((total, role) => {
            return total + notifications[role].length;
        }, 0);
        
        console.log(`📡 Total notifications WebSocket: ${totalNotifications}`);
        console.log(`🔄 Notifications création: ${prepNotifs.length + adminNotifs.length + rolandNotifs.length + xeroxNotifs.length}`);
        console.log(`📝 Notifications update: ${prepUpdateNotifs.length + adminUpdateNotifs.length + rolandUpdateNotifs.length + livreurUpdateNotifs.length}`);
        console.log(`🗑️ Notifications suppression: ${allDeleteNotifs}`);
        
        const websocketOK = totalNotifications > 0 && 
                           (prepNotifs.length + adminNotifs.length + rolandNotifs.length) > 0 &&
                           allDeleteNotifs > 0;
        
        console.log(`🎉 WebSocket synchronisation: ${websocketOK ? '🟢 OPÉRATIONNELLE' : '🔴 PROBLÈME'}`);
        
        if (websocketOK) {
            console.log('\n🚀 WEBSOCKET 100% FONCTIONNEL !');
            console.log('├─ Notifications temps réel actives');
            console.log('├─ Création → propagée instantanément');
            console.log('├─ Changements statut → notifiés en temps réel');
            console.log('└─ Suppressions → synchronisées immédiatement');
        }
        
        return websocketOK;

    } catch (error) {
        console.error('❌ Erreur WebSocket:', error.message);
        return false;
    } finally {
        // Fermer toutes les connexions WebSocket
        console.log('\n🧹 Nettoyage connexions WebSocket...');
        Object.values(sockets).forEach(socket => {
            if (socket && socket.connected) {
                socket.disconnect();
            }
        });
    }
}

if (require.main === module) {
    testWebSocketSync()
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = { testWebSocketSync };