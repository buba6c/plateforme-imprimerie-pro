const bcrypt = require('bcrypt');
const { query } = require('./config/database');

async function testPassword() {
  const email = 'admin@imprimerie.com';
  const testPassword = 'admin123';
  
  try {
    // Récupérer l'utilisateur
    const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Utilisateur ${email} non trouvé`);
      return;
    }
    
    const user = result.rows[0];
    console.log(`\n✅ Utilisateur trouvé: ${user.email}`);
    console.log(`Hash actuel: ${user.password_hash.substring(0, 30)}...`);
    
    // Tester le mot de passe
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`\n🔐 Test avec mot de passe "${testPassword}": ${isValid ? '✅ VALIDE' : '❌ INVALIDE'}`);
    
    // Si invalide, proposer de le réinitialiser
    if (!isValid) {
      console.log(`\n💡 Réinitialisation du mot de passe à "${testPassword}"...`);
      const newHash = await bcrypt.hash(testPassword, 12);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      console.log(`✅ Mot de passe réinitialisé avec succès!`);
      console.log(`\n🔑 Identifiants de connexion:`);
      console.log(`   Email: ${email}`);
      console.log(`   Mot de passe: ${testPassword}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

testPassword();
