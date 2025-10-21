#!/usr/bin/env node
/**
 * Script de diagnostic pour vérifier l'état de la base PostgreSQL sur Render
 * Vérifie les tables, les utilisateurs et la connectivité
 */

const { query } = require('./backend/config/database');

async function diagnosticDatabase() {
  console.log('🔍 DIAGNOSTIC BASE DE DONNÉES');
  console.log('=============================\n');

  try {
    // Test de connexion
    console.log('1️⃣ Test de connexion...');
    const timeResult = await query('SELECT NOW() as current_time');
    console.log(`✅ Connexion réussie à ${timeResult.rows[0].current_time}`);
    
    // Vérifier les tables existantes
    console.log('\n2️⃣ Tables existantes...');
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ AUCUNE TABLE TROUVÉE !');
      console.log('🚨 Les tables doivent être créées');
    } else {
      console.log(`✅ ${tablesResult.rows.length} tables trouvées :`);
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Vérifier la table users spécifiquement
    console.log('\n3️⃣ Vérification table users...');
    try {
      const usersCount = await query('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Table users existe avec ${usersCount.rows[0].count} utilisateur(s)`);
      
      // Lister les utilisateurs
      const users = await query('SELECT id, email, role, nom FROM users LIMIT 5');
      console.log('👥 Utilisateurs :');
      users.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - ${user.nom}`);
      });
      
    } catch (error) {
      console.log('❌ Table users n\'existe pas ou erreur :', error.message);
    }

    // Vérifier la table dossiers
    console.log('\n4️⃣ Vérification table dossiers...');
    try {
      const dossiersCount = await query('SELECT COUNT(*) as count FROM dossiers');
      console.log(`✅ Table dossiers existe avec ${dossiersCount.rows[0].count} dossier(s)`);
    } catch (error) {
      console.log('❌ Table dossiers n\'existe pas :', error.message);
    }

  } catch (error) {
    console.error('❌ Erreur de diagnostic :', error.message);
    console.error('Details :', error.code);
  }

  console.log('\n🎯 Diagnostic terminé');
  process.exit(0);
}

// Exécuter le diagnostic
diagnosticDatabase();