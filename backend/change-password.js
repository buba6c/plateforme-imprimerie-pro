const bcrypt = require('bcrypt');
const { query } = require('./config/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function changePassword() {
  console.log('\n🔐 === Changement de mot de passe === \n');
  
  rl.question('Email de l\'utilisateur: ', async (email) => {
    rl.question('Nouveau mot de passe: ', async (newPassword) => {
      rl.question('Confirmer le mot de passe: ', async (confirmPassword) => {
        
        if (newPassword !== confirmPassword) {
          console.log('\n❌ Les mots de passe ne correspondent pas!');
          rl.close();
          process.exit(1);
        }
        
        if (newPassword.length < 6) {
          console.log('\n❌ Le mot de passe doit contenir au moins 6 caractères!');
          rl.close();
          process.exit(1);
        }
        
        try {
          // Vérifier que l'utilisateur existe
          const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
          
          if (userResult.rows.length === 0) {
            console.log(`\n❌ Aucun utilisateur trouvé avec l'email: ${email}`);
            rl.close();
            process.exit(1);
          }
          
          const user = userResult.rows[0];
          console.log(`\n✅ Utilisateur trouvé: ${user.email}`);
          
          // Hasher le nouveau mot de passe
          console.log('🔄 Génération du hash...');
          const newHash = await bcrypt.hash(newPassword, 12);
          
          // Mettre à jour le mot de passe
          await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
          
          console.log('\n✅ Mot de passe changé avec succès!');
          console.log('\n🔑 Nouveaux identifiants:');
          console.log(`   Email: ${email}`);
          console.log(`   Mot de passe: ${newPassword}`);
          console.log('\n💡 Vous pouvez maintenant vous connecter avec ces identifiants.\n');
          
          rl.close();
          process.exit(0);
        } catch (error) {
          console.error('\n❌ Erreur:', error.message);
          rl.close();
          process.exit(1);
        }
      });
    });
  });
}

changePassword();
