// SCRIPT D'URGENCE - À exécuter via console Render ou directement sur le serveur
// Ce script ajoute la colonne manquante valide_preparateur pour corriger l'erreur 500

const { Pool } = require('pg');

// Configuration pour l'environnement Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://imprimerixbackend_user:rl1rEaokB2Vk1YRVGPVN9TxXxJnwUyKM@dpg-csmb3c3tq21c73bqpbtg-a.oregon-postgres.render.com:5432/imprimerixbackend',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function emergencySchemaFix() {
  console.log('🚨 SCRIPT D\'URGENCE - Correction schéma PostgreSQL');
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connexion PostgreSQL établie');
    
    // Script SQL minimal pour corriger l'erreur immédiate
    const emergencySQL = `
      -- Extension UUID si nécessaire
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      -- Ajouter valide_preparateur (CRITIQUE)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur'
        ) THEN
          ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT false;
          RAISE NOTICE 'Colonne valide_preparateur ajoutée';
        END IF;
      END$$;
      
      -- Ajouter autres colonnes critiques
      DO $$
      BEGIN
        -- machine
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'machine') THEN
          ALTER TABLE dossiers ADD COLUMN machine VARCHAR(50);
        END IF;
        
        -- description  
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'description') THEN
          ALTER TABLE dossiers ADD COLUMN description TEXT;
        END IF;
        
        -- numero_commande
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'numero_commande') THEN
          ALTER TABLE dossiers ADD COLUMN numero_commande VARCHAR(100);
        END IF;
        
        -- created_by
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'created_by') THEN
          ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
        END IF;
        
        -- assigned_to
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'assigned_to') THEN
          ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50);
        END IF;
        
        -- folder_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') THEN
          ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT uuid_generate_v4();
        END IF;
      END$$;
      
      -- Synchroniser les données
      UPDATE dossiers SET 
        machine = type_formulaire WHERE machine IS NULL AND type_formulaire IS NOT NULL,
        numero_commande = numero WHERE numero_commande IS NULL AND numero IS NOT NULL,
        created_by = preparateur_id WHERE created_by IS NULL AND preparateur_id IS NOT NULL;
    `;
    
    console.log('📝 Exécution des corrections SQL...');
    await client.query(emergencySQL);
    console.log('✅ Corrections SQL appliquées');
    
    // Vérification finale
    const verification = await client.query(`
      SELECT d.*, d.valide_preparateur, u.nom as preparateur_name
      FROM dossiers d
      LEFT JOIN users u ON d.preparateur_id = u.id
      LIMIT 1
    `);
    
    console.log('✅ SUCCÈS ! Requête de test réussie');
    console.log('📊 Exemple de dossier:', verification.rows[0] ? {
      id: verification.rows[0].id,
      client: verification.rows[0].client,
      valide_preparateur: verification.rows[0].valide_preparateur
    } : 'Aucun dossier trouvé');
    
    return true;
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error('Stack:', error.stack);
    return false;
    
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Auto-exécution si lancé directement
if (require.main === module) {
  emergencySchemaFix()
    .then(success => {
      console.log(success ? '🎉 CORRECTION RÉUSSIE' : '❌ CORRECTION ÉCHOUÉE');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 ERREUR FATALE:', error);
      process.exit(1);
    });
}

module.exports = emergencySchemaFix;