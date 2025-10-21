const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Vrais utilisateurs de la plateforme selon le frontend et backend
const realUsers = [
  { email: 'admin@imprimerie.com', password: 'admin123', role: 'admin', nom: 'Administrateur Principal' },
  { email: 'buba6c@gmail.com', password: 'Bouba2307', role: 'preparateur', nom: 'Bouba Préparateur' },
  { email: 'roland@imprimerie.local', password: 'Imprimerie2025', role: 'imprimeur_roland', nom: 'Roland Imprimeur' },
  { email: 'xerox@imprimerie.local', password: 'Imprimerie2025', role: 'imprimeur_xerox', nom: 'Xerox Imprimeur' },
  { email: 'livreur@imprimerie.local', password: 'admin123', role: 'livreur', nom: 'Livreur Principal' },
];

async function initRealUsers() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });

  console.log('🔄 INITIALISATION VRAIS UTILISATEURS PLATEFORME');
  console.log('===============================================\n');

  try {
    // Nettoyer les anciennes données
    console.log('🧹 Nettoyage anciennes données...');
    await pool.query('DELETE FROM historique_statuts');
    await pool.query('DELETE FROM fichiers');
    await pool.query('DELETE FROM dossiers');
    await pool.query('DELETE FROM users');
    console.log('✅ Anciennes données supprimées');

    // Créer les vrais utilisateurs
    for (const user of realUsers) {
      try {
        console.log(`\n👤 Création: ${user.email}`);
        
        // Hasher le mot de passe
        const hash = await bcrypt.hash(user.password, 12);
        
        // Créer l'utilisateur
        const result = await pool.query(
          `INSERT INTO users (email, password_hash, role, nom, is_active, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, true, NOW(), NOW()) 
           RETURNING id`,
          [user.email, hash, user.role, user.nom]
        );
        
        console.log(`✅ Créé: ID ${result.rows[0].id} | ${user.email} | ${user.role}`);
        
        // Vérifier le mot de passe
        const testResult = await pool.query('SELECT password_hash FROM users WHERE email = $1', [user.email]);
        const isValid = await bcrypt.compare(user.password, testResult.rows[0].password_hash);
        console.log(`   🔐 Mot de passe vérifié: ${isValid ? 'OK' : 'ERREUR'}`);
        
      } catch (error) {
        console.error(`❌ Erreur ${user.email}:`, error.message);
      }
    }

    // Vérification finale
    console.log('\n📋 RÉCAPITULATIF FINAL');
    console.log('======================');
    const allUsers = await pool.query('SELECT id, email, role, nom FROM users ORDER BY id');
    
    allUsers.rows.forEach(user => {
      console.log(`${user.id}. ${user.email.padEnd(30)} | ${user.role.padEnd(20)} | ${user.nom}`);
    });

    console.log('\n🎉 VRAIS UTILISATEURS INITIALISÉS AVEC SUCCÈS !');
    console.log('\n🔑 IDENTIFIANTS DE CONNEXION :');
    console.log('==============================');
    realUsers.forEach(user => {
      console.log(`${user.role.padEnd(20)} | ${user.email.padEnd(30)} | ${user.password}`);
    });

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

// Exécuter l'initialisation
if (require.main === module) {
  initRealUsers();
}

module.exports = { initRealUsers, realUsers };