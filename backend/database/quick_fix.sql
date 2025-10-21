-- Script de correction rapide pour les colonnes et tables manquantes
-- Exécution sécurisée avec vérifications

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ajouter uploaded_at à la table fichiers si elle existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichiers') THEN
    -- Ajouter uploaded_at si manquante
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichiers' AND column_name = 'uploaded_at') THEN
      ALTER TABLE fichiers ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      -- Copier created_at vers uploaded_at pour les fichiers existants
      UPDATE fichiers SET uploaded_at = created_at WHERE uploaded_at IS NULL;
      RAISE NOTICE '✅ Colonne fichiers.uploaded_at ajoutée';
    ELSE
      RAISE NOTICE '⏭️  Colonne fichiers.uploaded_at existe déjà';
    END IF;
  END IF;
END$$;

-- 2. Créer la table dossier_formulaires si elle n'existe pas
CREATE TABLE IF NOT EXISTS dossier_formulaires (
  id SERIAL PRIMARY KEY,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_formulaire VARCHAR(50) NOT NULL,
  details JSONB NOT NULL,
  date_saisie TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Index pour dossier_formulaires
CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_date_saisie ON dossier_formulaires(date_saisie);

-- 3. Créer la table dossier_status_history si elle n'existe pas
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
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON dossier_status_history(changed_at);

-- Afficher le résumé
DO $$
DECLARE
  fichiers_count INTEGER;
  dossier_formulaires_count INTEGER;
  has_uploaded_at BOOLEAN;
BEGIN
  -- Compter les fichiers
  SELECT COUNT(*) INTO fichiers_count FROM fichiers;
  
  -- Compter les formulaires
  SELECT COUNT(*) INTO dossier_formulaires_count FROM dossier_formulaires;
  
  -- Vérifier uploaded_at
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fichiers' AND column_name = 'uploaded_at'
  ) INTO has_uploaded_at;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ Correction rapide terminée';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Fichiers dans la base: %', fichiers_count;
  RAISE NOTICE 'Formulaires dans la base: %', dossier_formulaires_count;
  RAISE NOTICE 'Colonne uploaded_at: %', CASE WHEN has_uploaded_at THEN '✅ Présente' ELSE '❌ Manquante' END;
  RAISE NOTICE '═══════════════════════════════════════';
END$$;
