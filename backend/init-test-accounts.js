const bcrypt = require('bcrypt');
const { query } = require('./config/database');

const testAccounts = [
  { email: 'admin@imprimerie.com', password: 'admin123', role: 'admin' },
  { email: 'buba6c@gmail.com', password: 'Bouba2307', role: 'preparateur' },
  { email: 'roland@imprimerie.local', password: 'admin123', role: 'imprimeur_roland' },
  { email: 'xerox@imprimerie.local', password: 'admin123', role: 'imprimeur_xerox' },
  { email: 'livreur@imprimerie.local', password: 'admin123', role: 'livreur' },
];

async function initTestAccounts() {
  console.log('\n🔐 === Initialisation des comptes de test ===\n');
  
  for (const account of testAccounts) {
    try {
      // Vérifier si le compte existe
      const userResult = await query('SELECT id, email, role FROM users WHERE email = $1', [account.email]);
      
      if (userResult.rows.length === 0) {
        console.log(`⚠️  Compte non trouvé: ${account.email} - Création...`);
        
        // Créer le compte
        const hash = await bcrypt.hash(account.password, 12);
        const nom = account.email.split('@')[0];
        
        await query(
          `INSERT INTO users (email, password_hash, role, nom, is_active, created_at) 
           VALUES ($1, $2, $3, $4, true, NOW())`,
          [account.email, hash, account.role, nom]
        );
        
        console.log(`✅ Compte créé: ${account.email} (${account.role})`);
      } else {
        // Mettre à jour le mot de passe
        const hash = await bcrypt.hash(account.password, 12);
        await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, account.email]);
        console.log(`✅ Mot de passe mis à jour: ${account.email} (${userResult.rows[0].role})`);
      }
      
      // Vérifier que le mot de passe fonctionne
      const checkResult = await query('SELECT password_hash FROM users WHERE email = $1', [account.email]);
      const isValid = await bcrypt.compare(account.password, checkResult.rows[0].password_hash);
      
      if (isValid) {
        console.log(`   ✓ Vérification réussie pour ${account.email}`);
      } else {
        console.log(`   ❌ Erreur: le mot de passe ne fonctionne pas pour ${account.email}`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur pour ${account.email}:`, error.message);
    }
  }
  
  console.log('\n📋 === Récapitulatif des comptes de test ===\n');
  for (const account of testAccounts) {
    console.log(`${account.role.padEnd(20)} | ${account.email.padEnd(30)} | ${account.password}`);
  }
  console.log('\n✅ Initialisation terminée!\n');
  
  process.exit(0);
}

initTestAccounts();
