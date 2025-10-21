// Script Node.js pour corriger le schéma directement
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://plateforme_imprimerie_prod_user:your_password@dpg-xxxxx/plateforme_imprimerie_prod';

async function fixSchemaDirect() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connexion PostgreSQL...');
    const client = await pool.connect();
    
    console.log('📝 Création séquence...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'numero_commande_seq') THEN
          CREATE SEQUENCE numero_commande_seq START 1;
          RAISE NOTICE 'Séquence créée';
        ELSE
          RAISE NOTICE 'Séquence existe';
        END IF;
      END$$;
    `);
    
    console.log('📝 Ajout colonne quantite...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'quantite') THEN
          ALTER TABLE dossiers ADD COLUMN quantite INTEGER DEFAULT 1;
          UPDATE dossiers SET quantite = 1 WHERE quantite IS NULL;
          RAISE NOTICE 'Colonne quantite ajoutée';
        ELSE
          RAISE NOTICE 'Colonne quantite existe';
        END IF;
      END$$;
    `);
    
    console.log('📝 Ajout colonne folder_id...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') THEN
          ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT gen_random_uuid() UNIQUE;
          UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
          RAISE NOTICE 'Colonne folder_id ajoutée';
        ELSE
          RAISE NOTICE 'Colonne folder_id existe';
        END IF;
      END$$;
    `);
    
    console.log('✅ Vérification...');
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'dossiers' AND column_name IN ('quantite', 'folder_id')
      ORDER BY column_name
    `);
    
    console.log('✅ Colonnes trouvées:', result.rows.map(r => r.column_name));
    
    client.release();
    await pool.end();
    
    console.log('🎉 FIX TERMINÉ');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

fixSchemaDirect();
