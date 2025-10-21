-- Migration: Ajouter folder_id (UUID) comme identifiant unique
-- Cette migration préserve les ID existants et ajoute folder_id pour une transition en douceur

-- Extension UUID (si pas déjà présente)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ajouter la colonne folder_id aux dossiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'folder_id'
  ) THEN
    -- Ajouter la colonne folder_id
    ALTER TABLE dossiers 
    ADD COLUMN folder_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL;
    
    -- Créer un index pour les recherches par folder_id
    CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);
    
    -- Générer des UUIDs pour les dossiers existants qui n'en ont pas
    UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
    
    RAISE NOTICE 'Colonne folder_id ajoutée avec succès aux dossiers';
  ELSE
    RAISE NOTICE 'Colonne folder_id existe déjà';
  END IF;
END$$;

-- Ajouter folder_id aux fichiers (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichiers') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'fichiers' AND column_name = 'folder_id'
    ) THEN
      -- Ajouter folder_id (référence vers dossiers.folder_id)
      ALTER TABLE fichiers 
      ADD COLUMN folder_id UUID;
      
      -- Remplir folder_id depuis dossier_id existant
      UPDATE fichiers f
      SET folder_id = d.folder_id
      FROM dossiers d
      WHERE f.dossier_id = d.id;
      
      -- Créer index
      CREATE INDEX IF NOT EXISTS idx_fichiers_folder_id ON fichiers(folder_id);
      
      RAISE NOTICE 'Colonne folder_id ajoutée aux fichiers';
    END IF;
  END IF;
END$$;

-- Ajouter folder_id à l'historique des statuts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dossier_status_history') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'dossier_status_history' AND column_name = 'folder_id'
    ) THEN
      ALTER TABLE dossier_status_history 
      ADD COLUMN folder_id UUID;
      
      UPDATE dossier_status_history h
      SET folder_id = d.folder_id
      FROM dossiers d
      WHERE h.dossier_id = d.id;
      
      CREATE INDEX IF NOT EXISTS idx_history_folder_id ON dossier_status_history(folder_id);
      
      RAISE NOTICE 'Colonne folder_id ajoutée à l''historique';
    END IF;
  END IF;
END$$;

-- Créer une table activity_logs pour tracer toutes les actions
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  folder_id UUID,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_folder_id ON activity_logs(folder_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at);

COMMENT ON TABLE activity_logs IS 'Journal des activités utilisateur sur les dossiers';
COMMENT ON COLUMN activity_logs.folder_id IS 'UUID du dossier concerné';
COMMENT ON COLUMN activity_logs.action IS 'Type d''action: created, updated, deleted, status_changed, file_uploaded, etc.';

-- Fonction helper pour logger les actions (à appeler depuis l'application)
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

-- Afficher un résumé
DO $$
DECLARE
  dossier_count INTEGER;
  with_folder_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO dossier_count FROM dossiers;
  SELECT COUNT(*) INTO with_folder_id FROM dossiers WHERE folder_id IS NOT NULL;
  
  RAISE NOTICE '✅ Migration terminée';
  RAISE NOTICE '   Dossiers total: %', dossier_count;
  RAISE NOTICE '   Dossiers avec folder_id: %', with_folder_id;
  RAISE NOTICE '   Table activity_logs créée';
END$$;
