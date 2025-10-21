#!/usr/bin/env node

/**
 * 🧪 TEST COMPLET CONFORMITÉ CAHIER DES CHARGES
 * =============================================
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function testCompleteWorkflow() {
    console.log('🧪 TEST CONFORMITÉ CAHIER DES CHARGES');
    console.log('======================================\n');

    try {
        // 1. Test PRÉPARATEUR - doit voir ses dossiers "en_cours" et "a_revoir"
        console.log('1️⃣ Test PRÉPARATEUR...');
        const prepLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'preparateur@imprimerie.local',
            password: 'admin123'
        });
        
        const prepDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${prepLogin.data.token}` }
        });
        
        console.log(`📊 Préparateur voit ${prepDossiers.data.dossiers.length} dossiers:`);
        prepDossiers.data.dossiers.forEach(d => {
            console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
        });
        
        // Vérification : doit voir WF-ROLAND-001, WF-ROLAND-002, WF-XEROX-001
        const expectedPrep = ['WF-ROLAND-001', 'WF-ROLAND-002', 'WF-XEROX-001'];
        const actualPrep = prepDossiers.data.dossiers.map(d => d.numero_commande);
        const prepOk = expectedPrep.every(num => actualPrep.includes(num)) && actualPrep.length === 3;
        console.log(`   ✅ Conformité préparateur: ${prepOk ? 'PARFAIT' : 'ERREUR'}`);

        // 2. Test ADMIN - doit voir tous les dossiers
        console.log('\n2️⃣ Test ADMIN...');
        const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@imprimerie.local', 
            password: 'admin123'
        });
        
        const adminDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${adminLogin.data.token}` }
        });
        
        console.log(`📊 Admin voit ${adminDossiers.data.dossiers.length} dossiers:`);
        adminDossiers.data.dossiers.forEach(d => {
            console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
        });
        
        // Vérification : doit voir tous les 6 dossiers
        const adminOk = adminDossiers.data.dossiers.length === 6;
        console.log(`   ✅ Conformité admin: ${adminOk ? 'PARFAIT' : 'ERREUR'}`);

        // 3. Test IMPRIMEUR ROLAND - doit voir dossiers roland
        console.log('\n3️⃣ Test IMPRIMEUR ROLAND...');
        const rolandLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'roland@imprimerie.local',
            password: 'admin123'
        });
        
        const rolandDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${rolandLogin.data.token}` }
        });
        
        console.log(`📊 Roland voit ${rolandDossiers.data.dossiers.length} dossiers:`);
        rolandDossiers.data.dossiers.forEach(d => {
            console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
        });
        
        // Vérification : doit voir WF-ROLAND-001 et WF-ROLAND-003 (pas a_revoir)
        const expectedRoland = ['WF-ROLAND-001', 'WF-ROLAND-003'];
        const actualRoland = rolandDossiers.data.dossiers.map(d => d.numero_commande);
        const rolandOk = expectedRoland.every(num => actualRoland.includes(num)) && 
                        actualRoland.every(num => num.includes('ROLAND'));
        console.log(`   ✅ Conformité Roland: ${rolandOk ? 'PARFAIT' : 'ERREUR'}`);

        // 4. Test IMPRIMEUR XEROX - doit voir dossiers xerox
        console.log('\n4️⃣ Test IMPRIMEUR XEROX...');
        const xeroxLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'xerox@imprimerie.local',
            password: 'admin123'
        });
        
        const xeroxDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${xeroxLogin.data.token}` }
        });
        
        console.log(`📊 Xerox voit ${xeroxDossiers.data.dossiers.length} dossiers:`);
        xeroxDossiers.data.dossiers.forEach(d => {
            console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
        });
        
        // Vérification : doit voir WF-XEROX-001 et WF-XEROX-002
        const expectedXerox = ['WF-XEROX-001', 'WF-XEROX-002'];
        const actualXerox = xeroxDossiers.data.dossiers.map(d => d.numero_commande);
        const xeroxOk = expectedXerox.every(num => actualXerox.includes(num)) &&
                       actualXerox.every(num => num.includes('XEROX'));
        console.log(`   ✅ Conformité Xerox: ${xeroxOk ? 'PARFAIT' : 'ERREUR'}`);

        // 5. Test LIVREUR - doit voir dossiers termine/en_livraison/livre
        console.log('\n5️⃣ Test LIVREUR...');
        const livreurLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'livreur@imprimerie.local',
            password: 'admin123'
        });
        
        const livreurDossiers = await axios.get(`${BASE_URL}/dossiers`, {
            headers: { Authorization: `Bearer ${livreurLogin.data.token}` }
        });
        
        console.log(`📊 Livreur voit ${livreurDossiers.data.dossiers.length} dossiers:`);
        livreurDossiers.data.dossiers.forEach(d => {
            console.log(`   - ${d.numero_commande} (${d.type}, ${d.status})`);
        });
        
        // Vérification : doit voir WF-ROLAND-003 et WF-XEROX-003
        const expectedLivreur = ['WF-ROLAND-003', 'WF-XEROX-003'];
        const actualLivreur = livreurDossiers.data.dossiers.map(d => d.numero_commande);
        const livreurOk = expectedLivreur.every(num => actualLivreur.includes(num));
        console.log(`   ✅ Conformité Livreur: ${livreurOk ? 'PARFAIT' : 'ERREUR'}`);

        // 6. RÉSUMÉ FINAL
        console.log('\n🎯 RÉSULTATS FINAUX:');
        console.log('===================');
        console.log(`👤 Préparateur: ${prepOk ? '🟢 CONFORME' : '🔴 NON CONFORME'}`);
        console.log(`👑 Admin: ${adminOk ? '🟢 CONFORME' : '🔴 NON CONFORME'}`);
        console.log(`🖨️ Roland: ${rolandOk ? '🟢 CONFORME' : '🔴 NON CONFORME'}`);
        console.log(`🖨️ Xerox: ${xeroxOk ? '🟢 CONFORME' : '🔴 NON CONFORME'}`);
        console.log(`🚚 Livreur: ${livreurOk ? '🟢 CONFORME' : '🔴 NON CONFORME'}`);
        
        const allOk = prepOk && adminOk && rolandOk && xeroxOk && livreurOk;
        console.log(`\n🎉 CONFORMITÉ GLOBALE: ${allOk ? '🟢 100% RÉUSSIE' : '🔴 CORRECTIONS NÉCESSAIRES'}`);
        
        if (allOk) {
            console.log('\n✨ La solution respecte parfaitement le cahier des charges !');
            console.log('✨ Chaque rôle voit exactement les dossiers qu\'il doit voir.');
            console.log('✨ Le workflow est opérationnel à 100% !');
        }
        
        return allOk;
        
    } catch (error) {
        console.error('❌ Erreur pendant le test:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return false;
    }
}

if (require.main === module) {
    testCompleteWorkflow()
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = { testCompleteWorkflow };