// Auto-correction COMPLÈTE du schéma PostgreSQL
// Analyse complète du code local pour toutes les colonnes manquantes

const { Pool } = require('pg');

async function autoFixDatabaseSchema() {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('⏭️  Schema fix skipped - no DATABASE_URL');
      return true;
    }

    console.log('🔧 Auto-fix COMPLET: Vérification schéma PostgreSQL...');
    console.log('🌍 Environnement:', process.env.NODE_ENV || 'unknown');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    let client;
    try {
      client = await pool.connect();
      console.log('✅ Connexion DB établie pour auto-fix');
      
      // Script SQL COMPLET avec TOUTES les colonnes
      const fixSQL = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
        
        DO $$
        BEGIN
          -- Colonnes table dossiers (analyse complète du code)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur') THEN
            ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'machine') THEN
            ALTER TABLE dossiers ADD COLUMN machine VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'description') THEN
            ALTER TABLE dossiers ADD COLUMN description TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'numero_commande') THEN
            ALTER TABLE dossiers ADD COLUMN numero_commande VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'created_by') THEN
            ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'assigned_to') THEN
            ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') THEN
            ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT gen_random_uuid() UNIQUE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'quantite') THEN
            ALTER TABLE dossiers ADD COLUMN quantite INTEGER DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'date_validation_preparateur') THEN
            ALTER TABLE dossiers ADD COLUMN date_validation_preparateur TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'client_email') THEN
            ALTER TABLE dossiers ADD COLUMN client_email VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'client_telephone') THEN
            ALTER TABLE dossiers ADD COLUMN client_telephone VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'date_livraison_prevue') THEN
            ALTER TABLE dossiers ADD COLUMN date_livraison_prevue DATE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'commentaire_revision') THEN
            ALTER TABLE dossiers ADD COLUMN commentaire_revision TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'revision_comment') THEN
            ALTER TABLE dossiers ADD COLUMN revision_comment TEXT;
          END IF;
        END$$;
        
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichiers') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichiers' AND column_name = 'uploaded_at') THEN
              ALTER TABLE fichiers ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
              UPDATE fichiers SET uploaded_at = created_at WHERE uploaded_at IS NULL;
            END IF;
          END IF;
        END$$;
        
        CREATE TABLE IF NOT EXISTS dossier_formulaires (
          id SERIAL PRIMARY KEY,
          dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
          type_formulaire VARCHAR(50) NOT NULL,
          details JSONB NOT NULL,
          date_saisie TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
        
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
        
        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          folder_id UUID,
          user_id INTEGER REFERENCES users(id),
          action VARCHAR(100) NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);
        CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
        CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);
        
        UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
        UPDATE dossiers SET machine = type_formulaire WHERE machine IS NULL AND type_formulaire IS NOT NULL;
        UPDATE dossiers SET numero_commande = numero WHERE numero_commande IS NULL AND numero IS NOT NULL;
        UPDATE dossiers SET created_by = preparateur_id WHERE created_by IS NULL AND preparateur_id IS NOT NULL;
        UPDATE dossiers SET quantite = 1 WHERE quantite IS NULL;
      `;
      
      await client.query(fixSQL);
      console.log('✅ Auto-fix: Schéma COMPLET mis à jour');
      
      // Vérification
      const check = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'dossiers' AND column_name IN ('quantite', 'folder_id', 'valide_preparateur')
        ORDER BY column_name
      `);
      console.log(`✅ Colonnes critiques vérifiées: ${check.rows.map(r => r.column_name).join(', ')}`);
      
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
    return false;
  }
}

module.exports = autoFixDatabaseSchema;
