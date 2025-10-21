#!/usr/bin/env node

/**
 * 🧹 NETTOYAGE FORCÉ LOCALSTORAGE
 * ==============================
 * Vide complètement le localStorage du navigateur
 */

console.log('🧹 NETTOYAGE FORCÉ LOCALSTORAGE');
console.log('==============================\n');

console.log('📋 ÉTAPES À SUIVRE :');
console.log('1. Ouvrir http://localhost:3000 dans votre navigateur');
console.log('2. Appuyer F12 (outils développeur)');
console.log('3. Aller dans l\'onglet "Application" ou "Storage"');
console.log('4. Dans le menu de gauche: "Local Storage" → "http://localhost:3000"');
console.log('5. Sélectionner toutes les clés et supprimer');
console.log('');
console.log('🚀 OU plus simple - dans la Console (F12 → Console) :');
console.log('');
console.log('   Object.keys(localStorage).forEach(k => localStorage.removeItem(k));');
console.log('   location.reload();');
console.log('');
console.log('🎯 RÉSULTAT ATTENDU :');
console.log('• Plus de dossiers affichés');
console.log('• Message "Aucun dossier trouvé" ou liste vide');
console.log('• Connexion avec comptes réels (admin@imprimerie.local / admin123)');
console.log('');
console.log('✨ L\'application utilisera maintenant l\'API réelle !');
console.log('   (Modification effectuée dans shouldUseMockApi())');

// Test API pour confirmer
const { spawn } = require('child_process');

console.log('\n🔍 Vérification API réelle...');
const curlProcess = spawn('curl', [
    '-s',
    '-H', 'Content-Type: application/json',
    '-d', '{"email":"admin@imprimerie.local","password":"admin123"}',
    'http://localhost:5001/api/auth/login'
], { stdio: ['pipe', 'pipe', 'pipe'] });

let output = '';
curlProcess.stdout.on('data', (data) => {
    output += data.toString();
});

curlProcess.on('close', (code) => {
    try {
        const response = JSON.parse(output);
        if (response.token) {
            console.log('✅ API réelle fonctionne (token reçu)');
        }
    } catch (e) {
        console.log('⚠️  Vérifiez que PM2 est démarré : pm2 status');
    }
});

curlProcess.on('error', () => {
    console.log('⚠️  Impossible de tester l\'API');
});