const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    // Test direct de connexion avec la configuration actuelle
    const { query } = require('./config/database');
    
    console.log('🔍 Test connexion directe...');
    
    // Test de la requête utilisateur
    const email = 'admin@imprimerie.local';
    const password = 'admin123';
    
    console.log('📧 Test utilisateur:', email);
    
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    console.log('👥 Utilisateurs trouvés:', userResult.rows.length);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Aucun utilisateur trouvé avec cet email');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Utilisateur trouvé:', user.email, user.role, user.nom);
    console.log('🔐 Hash stocké:', user.password_hash.substring(0, 20) + '...');
    
    // Test du mot de passe
    console.log('🔑 Test mot de passe...');
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('✅ Mot de passe valide:', isValid);
    
    if (!user.is_active) {
      console.log('❌ Utilisateur désactivé');
      return;
    }
    
    console.log('🎉 LOGIN DEVRAIT FONCTIONNER !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testLogin();