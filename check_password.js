const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'imprimerie_user',
  host: 'localhost',
  database: 'imprimerie_db',
  password: '',
  port: 5432,
});

async function checkPassword() {
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['preparateur@evocomprint.com']);
    
    if (result.rows.length > 0) {
      const storedHash = result.rows[0].password_hash;
      console.log('Hash stocké:', storedHash);
      
      // Tester avec admin123
      const isValid = await bcrypt.compare('admin123', storedHash);
      console.log('Mot de passe admin123 valide:', isValid);
      
      // Créer un nouveau hash pour admin123 si nécessaire
      if (!isValid) {
        const newHash = await bcrypt.hash('admin123', 12);
        console.log('Nouveau hash pour admin123:', newHash);
        
        // Mettre à jour le mot de passe
        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, 'preparateur@evocomprint.com']);
        console.log('✅ Mot de passe mis à jour pour preparateur@evocomprint.com');
      } else {
        console.log('✅ Mot de passe admin123 déjà valide');
      }
    } else {
      console.log('❌ Utilisateur non trouvé');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkPassword();