-- Script d'urgence pour corriger le schéma manuellement
-- À exécuter via l'endpoint POST /api/admin/fix-schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Séquence pour numéros de commande
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'numero_commande_seq') THEN
    CREATE SEQUENCE numero_commande_seq START 1;
    RAISE NOTICE 'Séquence numero_commande_seq créée';
  ELSE
    RAISE NOTICE 'Séquence numero_commande_seq existe déjà';
  END IF;
END$$;

-- Colonnes manquantes table dossiers
DO $$
BEGIN
  -- quantite (CRITIQUE)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'quantite') THEN
    ALTER TABLE dossiers ADD COLUMN quantite INTEGER DEFAULT 1;
    UPDATE dossiers SET quantite = 1 WHERE quantite IS NULL;
    RAISE NOTICE 'Colonne quantite ajoutée';
  END IF;
  
  -- folder_id (CRITIQUE)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') THEN
    ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT gen_random_uuid() UNIQUE;
    UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
    RAISE NOTICE 'Colonne folder_id ajoutée';
  END IF;
  
  -- Autres colonnes
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
    UPDATE dossiers SET numero_commande = numero WHERE numero_commande IS NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'created_by') THEN
    ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
    UPDATE dossiers SET created_by = preparateur_id WHERE created_by IS NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'assigned_to') THEN
    ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50);
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
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'date_livraison_reelle') THEN
    ALTER TABLE dossiers ADD COLUMN date_livraison_reelle DATE;
  END IF;
  
  RAISE NOTICE 'Toutes les colonnes dossiers vérifiées/ajoutées';
END$$;

-- Colonne fichiers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichiers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichiers' AND column_name = 'uploaded_at') THEN
      ALTER TABLE fichiers ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      UPDATE fichiers SET uploaded_at = created_at WHERE uploaded_at IS NULL;
      RAISE NOTICE 'Colonne uploaded_at ajoutée à fichiers';
    END IF;
  END IF;
END$$;

-- Tables relationnelles
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

-- Index
CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);
CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);

-- Fonction log_dossier_activity
CREATE OR REPLACE FUNCTION log_dossier_activity(
  p_folder_id UUID,
  p_user_id INTEGER,
  p_action VARCHAR(100),
  p_details JSONB DEFAULT '{}'::JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO activity_logs (folder_id, user_id, action, details)
  VALUES (p_folder_id, p_user_id, p_action, p_details);
END;
$$ LANGUAGE plpgsql;

-- Fonction trigger add_status_history
CREATE OR REPLACE FUNCTION add_status_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.statut IS DISTINCT FROM NEW.statut THEN
        INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_at, folder_id)
        VALUES (NEW.id, OLD.statut, NEW.statut, CURRENT_TIMESTAMP, NEW.folder_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_dossier_status_history ON dossiers;
CREATE TRIGGER trigger_dossier_status_history
    AFTER UPDATE ON dossiers
    FOR EACH ROW
    EXECUTE FUNCTION add_status_history();

-- Vérification finale
DO $$
DECLARE
  col_count INTEGER;
  seq_exists BOOLEAN;
  func_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO col_count FROM information_schema.columns 
  WHERE table_name = 'dossiers' AND column_name IN ('quantite', 'folder_id', 'valide_preparateur');
  
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'numero_commande_seq') INTO seq_exists;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_dossier_activity') INTO func_exists;
  
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Colonnes critiques trouvées: %', col_count;
  RAISE NOTICE 'Séquence numero_commande_seq: %', CASE WHEN seq_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'Fonction log_dossier_activity: %', CASE WHEN func_exists THEN 'EXISTS' ELSE 'MISSING' END;
  
  IF col_count = 3 AND seq_exists AND func_exists THEN
    RAISE NOTICE '✅ SCHÉMA COMPLET ET FONCTIONNEL';
  ELSE
    RAISE WARNING '⚠️ SCHÉMA INCOMPLET - Vérifier les erreurs ci-dessus';
  END IF;
END$$;
