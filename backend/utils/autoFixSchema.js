// Script de correction automatique du schéma PostgreSQL
// S'exécute au démarrage du serveur pour corriger les colonnes manquantes

const { Pool } = require('pg');

async function autoFixDatabaseSchema() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('⏭️  Schema fix skipped - not in production');
      return true;
    }

    if (!process.env.DATABASE_URL) {
      console.log('⏭️  Schema fix skipped - no DATABASE_URL');
      return true;
    }

    console.log('🔧 Auto-fix: Vérification du schéma PostgreSQL...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    let client;
    try {
      client = await pool.connect();
      console.log('✅ Connexion DB établie pour auto-fix');
      
      // Script de correction minimal et sécurisé
      const fixSQL = `
        -- Extensions nécessaires
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        -- Ajouter colonnes manquantes de façon sécurisée
        DO $$
        BEGIN
          -- valide_preparateur (CRITIQUE pour API dossiers)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur') THEN
            ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT false;
            RAISE NOTICE 'Auto-fix: valide_preparateur ajoutée';
          END IF;
          
          -- machine (utilisée dans les requêtes)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'machine') THEN
            ALTER TABLE dossiers ADD COLUMN machine VARCHAR(50);
            RAISE NOTICE 'Auto-fix: machine ajoutée';
          END IF;
          
          -- description (utilisée dans les recherches)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'description') THEN
            ALTER TABLE dossiers ADD COLUMN description TEXT;
            RAISE NOTICE 'Auto-fix: description ajoutée';
          END IF;
          
          -- numero_commande (utilisé dans les recherches)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'numero_commande') THEN
            ALTER TABLE dossiers ADD COLUMN numero_commande VARCHAR(100);
            RAISE NOTICE 'Auto-fix: numero_commande ajoutée';
          END IF;
          
          -- created_by (relations utilisateur)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'created_by') THEN
            ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
            RAISE NOTICE 'Auto-fix: created_by ajoutée';
          END IF;
          
          -- assigned_to (assignation logique)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'assigned_to') THEN
            ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50);
            RAISE NOTICE 'Auto-fix: assigned_to ajoutée';
          END IF;
          
          -- folder_id (UUID unique)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') THEN
            ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT uuid_generate_v4();
            RAISE NOTICE 'Auto-fix: folder_id ajoutée';
          END IF;
        END$$;
        
        -- Fix table fichiers - ajouter uploaded_at (CRITIQUE)
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichiers') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichiers' AND column_name = 'uploaded_at') THEN
              ALTER TABLE fichiers ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
              UPDATE fichiers SET uploaded_at = created_at WHERE uploaded_at IS NULL;
              RAISE NOTICE 'Auto-fix: fichiers.uploaded_at ajoutée';
            END IF;
          END IF;
        END$$;
        
        -- Créer table dossier_formulaires (CRITIQUE)
        CREATE TABLE IF NOT EXISTS dossier_formulaires (
          id SERIAL PRIMARY KEY,
          dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
          type_formulaire VARCHAR(50) NOT NULL,
          details JSONB NOT NULL,
          date_saisie TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
        
        -- Créer table dossier_status_history si manquante
        CREATE TABLE IF NOT EXISTS dossier_status_history (
          id SERIAL PRIMARY KEY,
          dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
          old_status VARCHAR(50),
          new_status VARCHAR(50) NOT NULL,
          changed_by INTEGER REFERENCES users(id),
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          folder_id UUID
        );
        
        CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);
        
        -- Synchroniser les données existantes
        UPDATE dossiers SET 
          machine = type_formulaire WHERE machine IS NULL AND type_formulaire IS NOT NULL;
        
        UPDATE dossiers SET 
          numero_commande = numero WHERE numero_commande IS NULL AND numero IS NOT NULL;
          
        UPDATE dossiers SET 
          created_by = preparateur_id WHERE created_by IS NULL AND preparateur_id IS NOT NULL;
      `;
      
      await client.query(fixSQL);
      console.log('✅ Auto-fix: Schéma mis à jour avec succès');
      
      // Test rapide
      await client.query('SELECT d.valide_preparateur FROM dossiers d LIMIT 1');
      console.log('✅ Auto-fix: Requête de test réussie');
      
      return true;
      
    } catch (innerError) {
      console.error('❌ Auto-fix inner error:', innerError.message);
      return false;
    } finally {
      if (client) client.release();
      await pool.end();
    }
    
  } catch (outerError) {
    console.error('❌ Auto-fix failed (safe mode):', outerError.message);
    return false; // Ne pas casser le démarrage du serveur
  }
}

module.exports = autoFixDatabaseSchema;