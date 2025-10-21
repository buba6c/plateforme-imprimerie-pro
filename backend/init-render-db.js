const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function initializeDatabase() {
  console.log('🚀 INITIALISATION BASE POSTGRESQL RENDER');
  console.log('==========================================\n');

  try {
    // Lire le script d'initialisation
    const initSqlPath = path.join(__dirname, 'database', 'init.sql');
    console.log('📄 Lecture du script:', initSqlPath);
    
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    console.log('✅ Script lu (', initSql.length, 'caractères)');

    // Exécuter le script d'initialisation
    console.log('\n⚡ Exécution du script d\'initialisation...');
    await pool.query(initSql);
    console.log('✅ Tables créées avec succès !');

    // Vérifier les tables créées
    console.log('\n📊 Vérification des tables...');
    const tablesResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log(`✅ ${tablesResult.rows.length} tables créées :`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Vérifier les utilisateurs créés
    console.log('\n👥 Vérification des utilisateurs...');
    const usersResult = await pool.query('SELECT id, email, role, nom FROM users');
    console.log(`✅ ${usersResult.rows.length} utilisateurs créés :`);
    usersResult.rows.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ${user.nom}`);
    });

    console.log('\n🎉 BASE DE DONNÉES INITIALISÉE AVEC SUCCÈS !');
    console.log('🔐 Mot de passe par défaut pour tous : admin123');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation :', error.message);
    console.error('Details :', error.detail || error.code);
  }

  process.exit(0);
}

// Exécuter l'initialisation
initializeDatabase();