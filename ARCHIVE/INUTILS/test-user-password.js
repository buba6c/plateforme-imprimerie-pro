const bcrypt = require('bcrypt');
const { query } = require('./config/database');

async function testUserPassword() {
  const email = 'buba6c@gmail.com';
  const testPassword = 'Bouba2307';
  
  try {
    // Récupérer l'utilisateur
    const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Utilisateur ${email} non trouvé`);
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log(`\n✅ Utilisateur trouvé: ${user.email}`);
    console.log(`Hash actuel: ${user.password_hash.substring(0, 30)}...`);
    
    // Tester le mot de passe
    console.log(`\n🔐 Test avec mot de passe "${testPassword}"...`);
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`Résultat: ${isValid ? '✅ VALIDE' : '❌ INVALIDE'}`);
    
    // Si invalide, réinitialiser
    if (!isValid) {
      console.log(`\n💡 Le mot de passe ne correspond pas. Réinitialisation...`);
      const newHash = await bcrypt.hash(testPassword, 12);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      console.log(`✅ Mot de passe réinitialisé avec succès!`);
      console.log(`\n🔑 Identifiants de connexion:`);
      console.log(`   Email: ${email}`);
      console.log(`   Mot de passe: ${testPassword}`);
      
      // Re-tester pour confirmer
      const retest = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
      const retestValid = await bcrypt.compare(testPassword, retest.rows[0].password_hash);
      console.log(`\n✓ Vérification: ${retestValid ? '✅ OK' : '❌ ÉCHEC'}`);
    } else {
      console.log(`\n✅ Le mot de passe est déjà correct!`);
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

testUserPassword();
