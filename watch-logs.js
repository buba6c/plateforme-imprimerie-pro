#!/usr/bin/env node

// Script de surveillance en temps réel des logs pour capturer le problème
const { exec } = require('child_process');

console.log('🔍 Surveillance des logs en temps réel...');
console.log('📍 Maintenant reproduisez votre problème dans l\'interface !');
console.log('   1. Connectez-vous avec preparateur@imprimerie.local / admin123');
console.log('   2. Cliquez sur "Voir" d\'un dossier');
console.log('   3. Uploadez un fichier');
console.log('   4. Cliquez sur "Valider"');
console.log('   5. Observez l\'erreur "Dossier non trouvé"');
console.log('');
console.log('🕐 En attente de l\'activité...\n');

// Surveiller les logs
const logProcess = exec('pm2 logs plateforme-backend --raw --lines 0', { 
  cwd: '/Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151'
});

let lastLogTime = Date.now();
let logBuffer = [];

logProcess.stdout.on('data', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    if (line.includes('valider') || 
        line.includes('404') || 
        line.includes('non trouvé') || 
        line.includes('validation') ||
        line.includes('Erreur') ||
        line.includes('ERROR') ||
        line.includes('❌')) {
      console.log(`[${timestamp}] 🔍 ${line}`);
    }
  });
});

logProcess.stderr.on('data', (data) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ❌ ERREUR: ${data}`);
});

// Arrêt après 2 minutes
setTimeout(() => {
  console.log('\n⏰ Timeout - arrêt de la surveillance');
  logProcess.kill();
  process.exit(0);
}, 120000);

// Arrêt manuel
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt de la surveillance...');
  logProcess.kill();
  process.exit(0);
});