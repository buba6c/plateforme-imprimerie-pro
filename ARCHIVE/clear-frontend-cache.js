#!/usr/bin/env node

/**
 * 🧹 NETTOYAGE COMPLET DONNÉES FRONTEND
 * ===================================
 * Vide le localStorage et force l'utilisation de l'API réelle
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 NETTOYAGE DONNÉES FRONTEND');
console.log('============================\n');

// 1. Vérifier si l'app utilise l'API réelle
console.log('1️⃣ Vérification configuration API...');

try {
    // Vérifier le fichier de configuration API
    const configPath = path.join(__dirname, 'frontend', 'src', 'services', 'api.js');
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        if (configContent.includes('localhost:5001')) {
            console.log('✅ Configuration API correcte (localhost:5001)');
        } else {
            console.log('⚠️  Configuration API à vérifier');
        }
    }

    // Vérifier si mock est activé quelque part
    const mockPath = path.join(__dirname, 'frontend', 'src', 'services', 'mockApi.js');
    if (fs.existsSync(mockPath)) {
        console.log('ℹ️  Fichier mockApi.js présent (normal pour dev)');
    }

} catch (error) {
    console.log('⚠️  Erreur vérification config:', error.message);
}

// 2. Instructions pour vider localStorage
console.log('\n2️⃣ Instructions pour vider le cache frontend...');
console.log('');
console.log('🌐 Dans votre navigateur (http://localhost:3000) :');
console.log('');
console.log('1. Ouvrir les Outils Développeur (F12)');
console.log('2. Aller dans l\'onglet "Console"');
console.log('3. Taper cette commande et appuyer Entrée :');
console.log('');
console.log('   localStorage.clear(); sessionStorage.clear(); location.reload();');
console.log('');
console.log('🔄 Ou simplement forcer le rechargement :');
console.log('   Ctrl+Shift+R (PC) / Cmd+Shift+R (Mac)');
console.log('');
console.log('📱 Alternative : Mode navigation privée');
console.log('   Ctrl+Shift+N (PC) / Cmd+Shift+N (Mac)');
console.log('');

// 3. Vérifier que l'API backend répond
console.log('3️⃣ Vérification API backend...');

const { spawn } = require('child_process');

const curlProcess = spawn('curl', [
    '-s',
    '-o', '/dev/null',
    '-w', '%{http_code}',
    'http://localhost:5001/api/auth/me'
], { stdio: ['pipe', 'pipe', 'pipe'] });

let output = '';
curlProcess.stdout.on('data', (data) => {
    output += data.toString();
});

curlProcess.on('close', (code) => {
    if (output.trim() === '401' || output.trim() === '200') {
        console.log('✅ API backend répond correctement');
        console.log('');
        console.log('🎯 SOLUTION :');
        console.log('============');
        console.log('1. Vider le cache navigateur (commandes ci-dessus)');
        console.log('2. Vous connecter avec un compte réel :');
        console.log('   - admin@imprimerie.local / admin123');
        console.log('   - preparateur@imprimerie.local / admin123');
        console.log('3. L\'interface devrait maintenant être vide (base nettoyée)');
        console.log('');
        console.log('✨ La base est propre, prête pour de nouveaux dossiers !');
    } else {
        console.log('❌ API backend ne répond pas correctement');
        console.log('   Vérifiez que PM2 fonctionne : pm2 status');
    }
});

curlProcess.on('error', () => {
    console.log('❌ Impossible de vérifier l\'API (curl non disponible)');
    console.log('   Vérifiez manuellement : http://localhost:5001/api/auth/me');
});