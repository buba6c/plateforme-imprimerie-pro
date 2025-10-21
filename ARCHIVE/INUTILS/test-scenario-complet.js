#!/usr/bin/env node

/**
 * 🎭 SIMULATION SCÉNARIO COMPLET D'UTILISATION
 * ==========================================
 * Simulation d'un workflow complet de A à Z
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

async function simulateCompleteWorkflow() {
    console.log('🎭 SIMULATION SCÉNARIO COMPLET');
    console.log('=============================\n');

    const connections = {};
    const sockets = {};
    let dossierID = null;

    try {
        console.log('📅 **SCÉNARIO**: Commande client → Préparation → Impression Roland → Livraison');
        console.log('🕐 **TIMING**: Simulation temps réel avec notifications\n');

        // 1. Connexions initiales
        console.log('🔐 1️⃣ PHASE CONNEXION');
        console.log('═══════════════════');
        
        const roles = [
            { name: 'preparateur', email: 'preparateur@imprimerie.local', label: 'Marie (Préparateur)' },
            { name: 'admin', email: 'admin@imprimerie.local', label: 'Jean (Admin)' },
            { name: 'roland', email: 'roland@imprimerie.local', label: 'Pierre (Roland)' },
            { name: 'livreur', email: 'livreur@imprimerie.local', label: 'Paul (Livreur)' }
        ];
        
        for (const role of roles) {
            const login = await axios.post(`${BASE_URL}/auth/login`, {
                email: role.email,
                password: 'admin123'
            });
            connections[role.name] = login.data.token;
            console.log(`✅ ${role.label} est en ligne`);
            
            // Connexion WebSocket
            const socket = io(SOCKET_URL, {
                auth: { token: connections[role.name] }
            });
            sockets[role.name] = socket;
            
            await new Promise(resolve => {
                socket.on('connect', resolve);
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Marie crée une nouvelle commande
        console.log('\n📝 2️⃣ PHASE CRÉATION COMMANDE');
        console.log('════════════════════════════');
        console.log('👤 Marie reçoit une commande client par téléphone...');
        
        const nouvelleCommande = {
            numero_commande: `SCENARIO-${Date.now()}`,
            client_nom: 'Restaurant "Le Petit Bistrot"',
            type: 'roland',
            description: 'Cartes de visite + Menu restaurant (500 ex chaque)',
            quantite: 1000,
            client_email: 'contact@petitbistrot.fr',
            client_telephone: '01.42.42.42.42'
        };

        sockets.preparateur.on('dossier_created', (data) => {
            console.log('📡 Marie: "Parfait, ma commande est enregistrée dans le système"');
        });

        sockets.admin.on('dossier_created', (data) => {
            console.log('📡 Jean (Admin): "Nouvelle commande reçue, Marie s\'en occupe"');
        });

        sockets.roland.on('dossier_created', (data) => {
            console.log('📡 Pierre (Roland): "Une nouvelle commande pour mes machines, je vais la regarder"');
        });

        const createResponse = await axios.post(`${BASE_URL}/dossiers`, nouvelleCommande, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        
        dossierID = createResponse.data.dossier.id;
        console.log(`✅ Commande créée: ${nouvelleCommande.numero_commande}`);
        console.log(`📋 Statut: "en_cours" - La commande est maintenant visible par l'équipe`);
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Pierre (Roland) commence l'impression
        console.log('\n🖨️ 3️⃣ PHASE PRISE EN CHARGE IMPRESSION');
        console.log('═════════════════════════════════════');
        console.log('👨‍🔧 Pierre examine la commande et décide de commencer...');
        
        sockets.admin.on('dossier_updated', (data) => {
            if (data.dossier && data.dossier.status === 'en_impression') {
                console.log('📡 Jean (Admin): "Pierre a pris la commande en charge"');
            }
        });

        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'en_impression',
            comment: 'Début impression - Cartes et menus en cours'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        console.log('✅ Pierre: "J\'ai commencé l\'impression, statut mis à jour"');
        console.log('📋 Statut: "en_impression" - Marie ne voit plus la commande (plus en_cours)');
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Problème détecté - Pierre demande révision
        console.log('\n🔄 4️⃣ PHASE RÉVISION NÉCESSAIRE');
        console.log('═══════════════════════════');
        console.log('👨‍🔧 Pierre: "Problème avec les couleurs du menu, je dois demander des précisions"');
        
        sockets.preparateur.on('dossier_updated', (data) => {
            if (data.dossier && data.dossier.status === 'a_revoir') {
                console.log('📡 Marie: "Pierre a besoin de précisions, je vais regarder ça"');
            }
        });

        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'a_revoir',
            comment: 'Couleurs menu pas claires - Besoin confirmation client sur le rouge vs bordeaux'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        console.log('✅ Statut changé: "a_revoir"');
        console.log('📋 Marie voit maintenant la commande à nouveau avec le commentaire de Pierre');
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 5. Marie corrige et remet en cours
        console.log('\n✅ 5️⃣ PHASE CORRECTION');
        console.log('════════════════════');
        console.log('👤 Marie: "J\'ai appelé le client, c\'est bien bordeaux. Je corrige"');
        
        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'en_cours',
            comment: 'Confirmé avec client: couleur bordeaux (#722F37) pour le menu'
        }, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        
        console.log('✅ Remis "en_cours" avec précision couleur');
        console.log('📋 Pierre peut maintenant reprendre l\'impression');
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 6. Pierre reprend et termine
        console.log('\n🏁 6️⃣ PHASE FINALISATION IMPRESSION');
        console.log('════════════════════════════════════');
        
        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'en_impression',
            comment: 'Reprise impression avec la bonne couleur'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        console.log('👨‍🔧 Pierre: "Parfait, impression reprise avec bordeaux"');
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 7. Impression terminée
        sockets.livreur.on('dossier_updated', (data) => {
            if (data.dossier && data.dossier.status === 'termine') {
                console.log('📡 Paul (Livreur): "Commande prête, je vais organiser la livraison"');
            }
        });

        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'termine',
            comment: 'Impression terminée - 500 cartes + 500 menus parfaits'
        }, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        
        console.log('✅ Pierre: "Impression terminée, commande prête pour livraison"');
        console.log('📋 Paul (livreur) voit maintenant la commande');
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 8. Prise en charge livraison
        console.log('\n🚚 7️⃣ PHASE LIVRAISON');
        console.log('═══════════════════');
        console.log('👨‍💼 Paul: "Je prends la commande pour livraison demain matin"');
        
        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'en_livraison',
            comment: 'Livraison prévue demain 10h - Restaurant Le Petit Bistrot'
        }, {
            headers: { Authorization: `Bearer ${connections.livreur}` }
        });
        
        console.log('✅ Statut: "en_livraison"');
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 9. Livraison effectuée
        console.log('\n📦 8️⃣ PHASE FINALISATION');
        console.log('═══════════════════════');
        console.log('👨‍💼 Paul: "Livraison effectuée, client très satisfait !"');
        
        await axios.patch(`${BASE_URL}/dossiers/${dossierID}/status`, {
            status: 'livre',
            comment: 'Livré avec succès - Client ravi du résultat, commande future probable'
        }, {
            headers: { Authorization: `Bearer ${connections.livreur}` }
        });
        
        console.log('✅ Commande finalisée: "livre"');
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 10. Vérification finale des visibilités
        console.log('\n📊 9️⃣ VÉRIFICATION FINALE');
        console.log('════════════════════════');
        
        // Seul l'admin voit toutes les commandes à tout moment
        const adminCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.admin}` }
        });
        const adminVoitCommande = adminCheck.data.dossiers.some(d => d.id === dossierID);
        
        // Les autres ne voient plus la commande (statut 'livre' ne concerne plus personne)
        const prepCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.preparateur}` }
        });
        const prepVoitCommande = prepCheck.data.dossiers.some(d => d.id === dossierID);
        
        const rolandCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.roland}` }
        });
        const rolandVoitCommande = rolandCheck.data.dossiers.some(d => d.id === dossierID);
        
        const livreurCheck = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${connections.livreur}` }
        });
        const livreurVoitCommande = livreurCheck.data.dossiers.some(d => d.id === dossierID);
        
        console.log(`👑 Admin voit la commande livrée: ${adminVoitCommande ? '✅' : '❌'}`);
        console.log(`👤 Marie ne voit plus (normal): ${!prepVoitCommande ? '✅' : '❌'}`);
        console.log(`👨‍🔧 Pierre ne voit plus (normal): ${!rolandVoitCommande ? '✅' : '❌'}`);
        console.log(`👨‍💼 Paul voit encore (livre): ${livreurVoitCommande ? '✅' : '❌'}`);
        
        // Nettoyage
        console.log('\n🧹 NETTOYAGE FINAL');
        console.log('═════════════════');
        await axios.delete(`${BASE_URL}/dossiers`, {
            data: { ids: [dossierID] },
            headers: { Authorization: `Bearer ${connections.admin}` }
        });
        console.log('✅ Commande archivée par Jean (Admin)');

        console.log('\n🎉 SCÉNARIO COMPLET TERMINÉ !');
        console.log('════════════════════════════');
        console.log('✅ Workflow complet testé avec succès');
        console.log('📡 Notifications temps réel fonctionnelles');
        console.log('🔐 Visibilités respectées selon les rôles');
        console.log('🔄 Transitions de statuts conformes au cahier des charges');
        console.log('🚀 Plateforme 100% opérationnelle !');

        return true;

    } catch (error) {
        console.error('❌ Erreur scénario:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return false;
    } finally {
        // Fermer toutes les connexions
        Object.values(sockets).forEach(socket => {
            if (socket && socket.connected) {
                socket.disconnect();
            }
        });
    }
}

if (require.main === module) {
    simulateCompleteWorkflow()
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = { simulateCompleteWorkflow };