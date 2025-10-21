const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration de la base de données Render
const pool = new Pool({
  connectionString: 'postgresql://imprimerixbackend_user:rl1rEaokB2Vk1YRVGPVN9TxXxJnwUyKM@dpg-csmb3c3tq21c73bqpbtg-a.oregon-postgres.render.com:5432/imprimerixbackend',
  ssl: {
    rejectUnauthorized: false
  }
});

async function updateSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connexion à PostgreSQL Render établie');
    
    // Lire le script de mise à jour
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'backend/database/complete_schema_update.sql'), 
      'utf8'
    );
    
    console.log('📄 Script SQL chargé, exécution en cours...');
    
    // Exécuter le script
    const result = await client.query(sqlScript);
    
    console.log('✅ Mise à jour du schéma terminée avec succès');
    
    // Vérifier que la colonne valide_preparateur existe maintenant
    const checkColumn = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Colonne valide_preparateur confirmée:', checkColumn.rows[0]);
    } else {
      console.log('❌ Colonne valide_preparateur non trouvée');
    }
    
    // Afficher toutes les colonnes de la table dossiers
    const allColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dossiers'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colonnes actuelles de la table dossiers:');
    allColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Tester la requête qui échouait
    console.log('🧪 Test de la requête problématique...');
    const testQuery = await client.query(`
      SELECT d.*, d.valide_preparateur, u.nom as preparateur_name, u.email as preparateur_email,
        (SELECT COUNT(*) FROM fichiers WHERE dossier_id = d.id) as nb_fichiers
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      LIMIT 5
    `);
    
    console.log(`✅ Requête testée avec succès - ${testQuery.rows.length} dossiers trouvés`);
    testQuery.rows.forEach((dossier, index) => {
      console.log(`  ${index + 1}. ${dossier.client} - valide_preparateur: ${dossier.valide_preparateur}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error.message);
    console.error('Détails:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécuter la mise à jour
updateSchema();