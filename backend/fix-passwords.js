#!/usr/bin/env node

/**
 * Script pour vérifier et mettre à jour les mots de passe des utilisateurs de test
 */

const bcrypt = require('bcryptjs');
const { query } = require('./config/database');

async function fixPasswords() {
  console.log('🔧 Mise à jour des mots de passe utilisateurs');
  console.log('============================================\n');

  try {
    // Générer un nouveau hash pour 'admin123'
    const newHash = await bcrypt.hash('admin123', 12);
    console.log('Nouveau hash généré pour "admin123":', newHash);

    // Mettre à jour tous les utilisateurs @imprimerie.local
    const updateResult = await query(
      `UPDATE users 
             SET password_hash = $1 
             WHERE email LIKE '%@imprimerie.local'`,
      [newHash]
    );

    console.log(`✅ ${updateResult.rowCount} utilisateurs mis à jour`);

    // Vérifier la mise à jour
    const users = await query(
      "SELECT email, role FROM users WHERE email LIKE '%@imprimerie.local'"
    );

    console.log('\nUtilisateurs mis à jour:');
    users.rows.forEach(user => {
      console.log(`- ${user.email} (${user.role})`);
    });

    console.log('\n🎉 Mise à jour terminée ! Mot de passe: admin123');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  process.exit(0);
}

fixPasswords();
