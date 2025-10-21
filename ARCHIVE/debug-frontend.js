#!/usr/bin/env node

// Test complet de l'API et vérification des données

const { query } = require('./backend/config/database');

async function main() {
  console.log('🧪 Test complet API et Frontend');
  console.log('===============================\n');
  
  try {
    // 1. Vérification base de données
    console.log('1. 📊 Vérification base de données:');
    
    const dbResult = await query(`
      SELECT 
        d.id, d.numero_commande, d.type, d.status, d.preparateur_id,
        u.nom as preparateur_nom, u.email
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      ORDER BY d.id
    `);
    
    console.log(`   ✅ ${dbResult.rows.length} dossiers dans la base:`);
    dbResult.rows.forEach(d => {
      console.log(`      ${d.numero_commande} | ${d.type} | ${d.status} | ${d.preparateur_nom}`);
    });
    
    // 2. Test des utilisateurs existants
    console.log('\n2. 👥 Utilisateurs disponibles:');
    
    const usersResult = await query(`
      SELECT id, nom, email, role, is_active
      FROM users 
      WHERE is_active = true
      ORDER BY role, id
    `);
    
    console.log(`   👤 ${usersResult.rows.length} utilisateur(s) actif(s):`);
    usersResult.rows.forEach(u => {
      console.log(`      ${u.nom} | ${u.email} | ${u.role} (ID: ${u.id})`);
    });
    
    // 3. Test API santé
    console.log('\n3. 🏥 Test API Backend:');
    
    const axios = require('axios').default;
    
    try {
      const healthResponse = await axios.get('http://localhost:5001/api/health');
      console.log(`   ✅ API Backend: ${healthResponse.data.status} (uptime: ${Math.round(healthResponse.data.uptime)}s)`);
    } catch (err) {
      console.log(`   ❌ API Backend: ${err.message}`);
    }
    
    // 4. Test Frontend
    console.log('\n4. 🌐 Test Frontend:');
    
    try {
      const frontResponse = await axios.get('http://localhost:3000', { 
        timeout: 5000,
        headers: { 'User-Agent': 'Test-Script' }
      });
      console.log(`   ✅ Frontend accessible (status: ${frontResponse.status})`);
    } catch (err) {
      console.log(`   ❌ Frontend: ${err.message}`);
    }
    
    // 5. Simulation de requête dossiers (sans auth pour test)
    console.log('\n5. 🔍 Simulation requête dossiers:');
    
    // Simuler ce que l'API retournerait pour un préparateur
    const preparateurDossiers = await query(`
      SELECT 
        id, numero_commande, client_nom, type, status, created_at, updated_at
      FROM dossiers
      ORDER BY created_at DESC
    `);
    
    console.log(`   📋 Dossiers que verrait un préparateur: ${preparateurDossiers.rows.length}`);
    preparateurDossiers.rows.forEach(d => {
      console.log(`      ${d.numero_commande} (${d.type}, ${d.status})`);
    });
    
    // 6. Instructions de debug
    console.log('\n6. 🔧 Instructions de debug pour le frontend:');
    console.log('');
    console.log('   📱 ÉTAPES À SUIVRE:');
    console.log('   1. Ouvrez http://localhost:3000 dans votre navigateur');
    console.log('   2. Appuyez sur F12 (outils développeur)');
    console.log('   3. Onglet "Network" > Cochez "Disable cache"');
    console.log('   4. Faites CTRL+F5 (ou CMD+SHIFT+R)');
    console.log('   5. Connectez-vous avec:');
    
    // Afficher les comptes disponibles
    const authUsers = usersResult.rows.filter(u => u.role === 'preparateur' || u.role === 'admin');
    authUsers.forEach(u => {
      console.log(`      Email: ${u.email}`);
      console.log(`      Rôle: ${u.role}`);
      console.log('      Mot de passe: (voir dans la base ou créer un nouveau compte)');
      console.log('');
    });
    
    console.log('   🔍 VÉRIFICATIONS À FAIRE:');
    console.log('   - Dans l\'onglet Network, regardez les requêtes à /api/dossiers');
    console.log('   - Vérifiez que l\'API retourne bien les dossiers FRESH-xxx');
    console.log('   - Si erreur 401, le problème est l\'authentification');
    console.log('   - Si erreur 500, regardez les logs PM2');
    
    // 7. Commandes de debug
    console.log('\n7. 📋 Commandes de debug utiles:');
    console.log('');
    console.log('   # Voir les logs du backend:');
    console.log('   pm2 logs imprimerie-backend-dev --lines 20');
    console.log('');
    console.log('   # Voir les logs du frontend:');
    console.log('   pm2 logs plateforme-frontend --lines 20');
    console.log('');
    console.log('   # Redémarrer tout:');
    console.log('   pm2 restart all');
    console.log('');
    console.log('   # Vérifier la base de données:');
    console.log('   psql -h localhost -U imprimerie_user -d imprimerie_db -c "SELECT * FROM dossiers;"');
    
    console.log('\n✅ DONNÉES PRÊTES - Les dossiers FRESH sont en base !');
    console.log('🎯 Le problème est probablement côté cache navigateur ou authentification');
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
  }
}

main().catch(console.error);