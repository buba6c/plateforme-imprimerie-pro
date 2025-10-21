#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function upsertUser({ email, password, role, nom }) {
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO users (email, password_hash, role, nom, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                     role = EXCLUDED.role,
                     nom = EXCLUDED.nom,
                     is_active = EXCLUDED.is_active,
                     updated_at = NOW()`,
      [email.toLowerCase(), hash, role, nom]
    );
    console.log(`✔︎ Seed user: ${email} (${role})`);
  } finally {
    client.release();
  }
}

async function main() {
  const users = [
    { email: 'admin@evocomprint.com', password: 'admin123', role: 'admin', nom: 'Admin' },
    {
      email: 'preparateur@evocomprint.com',
      password: 'prep123',
      role: 'preparateur',
      nom: 'Jean Preparateur',
    },
    {
      email: 'roland@evocomprint.com',
      password: 'roland123',
      role: 'imprimeur_roland',
      nom: 'Marc Roland',
    },
    {
      email: 'xerox@evocomprint.com',
      password: 'xerox123',
      role: 'imprimeur_xerox',
      nom: 'Sophie Xerox',
    },
    {
      email: 'livreur@evocomprint.com',
      password: 'livreur123',
      role: 'livreur',
      nom: 'Pierre Livreur',
    },
  ];

  for (const u of users) {
    await upsertUser(u);
  }
  console.log('✅ Seed terminé.');
  await pool.end();
}

main().catch(async e => {
  console.error('❌ Seed error:', e);
  try {
    await pool.end();
  } catch (_) {}
  process.exit(1);
});
