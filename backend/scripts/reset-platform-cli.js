#!/usr/bin/env node

/**
 * 🧹 Script CLI de Réinitialisation de la Plateforme
 * Usage: node reset-platform-cli.js
 */

const { resetPlatform } = require('./resetPlatform');

console.log('\n🧹 ========================================');
console.log('   SCRIPT DE RÉINITIALISATION CLI');
console.log('========================================\n');

console.log('⚠️  ATTENTION: Cette opération est IRRÉVERSIBLE !');
console.log('⚠️  Tous les dossiers, fichiers et données seront supprimés.\n');

// Demander confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Tapez "RESET" en majuscules pour confirmer: ', async (answer) => {
  if (answer === 'RESET') {
    try {
      console.log('\n🚀 Démarrage de la réinitialisation...\n');
      await resetPlatform();
      console.log('\n✅ Réinitialisation terminée avec succès !');
      console.log('\n💡 Vous pouvez maintenant créer de nouveaux dossiers.');
      console.log('   Le premier dossier aura le numéro 001.\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Échec de la réinitialisation:', error.message);
      process.exit(1);
    }
  } else {
    console.log('\n❌ Opération annulée (confirmation incorrecte)');
    console.log(`   Vous avez tapé: "${answer}"`);
    console.log('   Attendu: "RESET"\n');
    process.exit(0);
  }
  rl.close();
});
