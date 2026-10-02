/**
 * Migration: Ajout des colonnes description et telephone_client
 * Date: 2025-01-24
 * Description: Ajoute les champs description (TEXT) et telephone_client (VARCHAR 20) à la table dossiers
 */

const { Pool } = require('pg');

// Configuration de la connexion (utilise les variables d'environnement ou valeurs par défaut)
const pool = new Pool({
  user: process.env.DB_USER || 'imprimerie_prod_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'imprimerie_prod',
  password: process.env.DB_PASSWORD || 'imprimerie_password',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connexion établie avec PostgreSQL');
    await client.query('BEGIN');
    
    // Vérifier si la colonne telephone_client existe déjà
    const checkTelephoneColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dossiers' 
        AND column_name = 'telephone_client'
    `);
    
    if (checkTelephoneColumn.rows.length === 0) {
      console.log('📝 Ajout de la colonne telephone_client...');
      await client.query(`
        ALTER TABLE dossiers 
        ADD COLUMN telephone_client VARCHAR(20) NULL
      `);
      console.log('✅ Colonne telephone_client ajoutée avec succès');
    } else {
      console.log('ℹ️  La colonne telephone_client existe déjà');
    }
    
    // Vérifier si la colonne description existe déjà
    const checkDescriptionColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dossiers' 
        AND column_name = 'description'
    `);
    
    if (checkDescriptionColumn.rows.length === 0) {
      console.log('📝 Ajout de la colonne description...');
      await client.query(`
        ALTER TABLE dossiers 
        ADD COLUMN description TEXT NULL
      `);
      console.log('✅ Colonne description ajoutée avec succès');
    } else {
      console.log('ℹ️  La colonne description existe déjà');
    }
    
    await client.query('COMMIT');
    console.log('✅ Migration terminée avec succès');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERREUR lors de la migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécuter la migration
migrate()
  .then(() => {
    console.log('🎉 Script de migration exécuté avec succès');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
