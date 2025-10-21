#!/usr/bin/env node
/**
 * Script de création / alignement des comptes utilisateurs standards.
 * 
 * Objectif: garantir la présence des comptes de test/documentation nécessaires
 * et aligner l'admin sur un email unifié si désiré.
 */
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const USERS = [
  { email: 'admin@evocomprint.com', password: 'admin123', role: 'admin', nom: 'Administrateur Plateforme', force: false },
  { email: 'admin@imprimerie.local', password: 'admin123', role: 'admin', nom: 'Administrateur Legacy', force: false },
  { email: 'preparateur@evocomprint.com', password: 'prep123', role: 'preparateur', nom: 'Jean Preparateur', force: false },
  { email: 'roland@evocomprint.com', password: 'roland123', role: 'imprimeur_roland', nom: 'Marc Roland', force: false },
  { email: 'xerox@evocomprint.com', password: 'xerox123', role: 'imprimeur_xerox', nom: 'Sophie Xerox', force: false },
  { email: 'livreur@evocomprint.com', password: 'livreur123', role: 'livreur', nom: 'Pierre Livreur', force: false },
];

async function upsertUser({ email, password, role, nom, force }) {
  const existing = await query('SELECT id, email FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`➡️  ${email} existe déjà (id=${existing.rows[0].id})`);
    if (force) {
      console.log(`   🔁 Force=true -> mise à jour mot de passe`);
      const hash = await bcrypt.hash(password, 12);
      await query('UPDATE users SET password_hash=$1, role=$2, nom=$3, is_active=true WHERE id=$4', [hash, role, nom, existing.rows[0].id]);
      console.log('   ✅ Mis à jour');
    }
    return existing.rows[0].id;
  }
  const hash = await bcrypt.hash(password, 12);
  const inserted = await query(
    `INSERT INTO users (email, password_hash, role, nom, is_active, created_at) 
     VALUES ($1,$2,$3,$4,true,NOW()) RETURNING id`,
    [email, hash, role, nom]
  );
  console.log(`✅ Créé: ${email} (id=${inserted.rows[0].id})`);
  return inserted.rows[0].id;
}

async function main() {
  console.log('👥 SEED UTILISATEURS');
  console.log('====================\n');
  for (const u of USERS) {
    try {
      await upsertUser(u);
    } catch (e) {
      console.error(`❌ Erreur sur ${u.email}:`, e.message);
    }
  }
  console.log('\n🎯 Terminé');
  process.exit(0);
}

main();
