#!/usr/bin/env node
/**
 * Test de matrice des identifiants contre l'API réelle
 */
const axios = require('axios');
const API = process.env.API_URL || 'http://localhost:5001/api';

const CREDS = [
  { email: 'admin@imprimerie.local', password: 'admin123', label: 'Admin Legacy' },
  { email: 'admin@evocomprint.com', password: 'admin123', label: 'Admin Nouveau' },
  { email: 'preparateur@evocomprint.com', password: 'prep123', label: 'Préparateur' },
  { email: 'roland@evocomprint.com', password: 'roland123', label: 'Imprimeur Roland' },
  { email: 'xerox@evocomprint.com', password: 'xerox123', label: 'Imprimeur Xerox' },
  { email: 'livreur@evocomprint.com', password: 'livreur123', label: 'Livreur' },
];

async function testOne({ email, password, label }) {
  const start = Date.now();
  try {
    const res = await axios.post(`${API}/auth/login`, { email, password }, { timeout: 4000 });
    const ms = Date.now() - start;
    return {
      email,
      label,
      ok: true,
      status: res.status,
      role: res.data?.user?.role,
      time: ms,
      tokenPreview: res.data?.token?.substring(0, 16) + '…'
    };
  } catch (e) {
    const ms = Date.now() - start;
    const data = e.response?.data || {};
    return {
      email,
      label,
      ok: false,
      status: e.response?.status || 'ERR',
      code: data.code || 'UNKNOWN',
      error: data.error || e.message,
      time: ms
    };
  }
}

async function main() {
  console.log(`\n🔐 TEST MATRICE LOGIN (${API})`);
  console.log('='.repeat(60));
  const results = [];
  for (const c of CREDS) {
    const r = await testOne(c);
    results.push(r);
  }

  // Affichage tableau simple
  console.log('\nRésultats:');
  console.log('LABEL'.padEnd(20), 'EMAIL'.padEnd(30), 'OK', 'STAT', 'CODE'.padEnd(18), 'ROLE'.padEnd(18), 'TIME(ms)');
  for (const r of results) {
    console.log(
      r.label.padEnd(20),
      r.email.padEnd(30),
      (r.ok ? '✅' : '❌'),
      String(r.status).padEnd(4),
      String(r.code || '').padEnd(18),
      String(r.role || '-').padEnd(18),
      String(r.time)
    );
  }

  const success = results.filter(r => r.ok).length;
  console.log(`\n✔ Logins réussis: ${success}/${results.length}`);
  if (success !== results.length) {
    console.log('\nConseils:');
    console.log('- Exécuter: node backend/scripts/seed_users.js');
    console.log('- Vérifier les emails en base: SELECT email, role FROM users;');
  }
}

main();
