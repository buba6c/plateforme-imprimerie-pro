-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION COMPLÈTE ET DÉFINITIVE DU SCHÉMA POSTGRESQL
-- Analyse complète du code local pour identifier TOUTES les colonnes manquantes
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLE DOSSIERS - Ajout de TOUTES les colonnes manquantes
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '📋 CORRECTION TABLE DOSSIERS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
  -- valide_preparateur
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur') THEN
    ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT false;
    RAISE NOTICE '  ✅ valide_preparateur ajoutée';
  END IF;

  -- machine
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'machine') THEN
    ALTER TABLE dossiers ADD COLUMN machine VARCHAR(50);
    RAISE NOTICE '  ✅ machine ajoutée';
  END IF;

  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'description') THEN
    ALTER TABLE dossiers ADD COLUMN description TEXT;
    RAISE NOTICE '  ✅ description ajoutée';
  END IF;

  -- numero_commande
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'numero_commande') THEN
    ALTER TABLE dossiers ADD COLUMN numero_commande VARCHAR(100);
    RAISE NOTICE '  ✅ numero_commande ajoutée';
  END IF;

  -- created_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'created_by') THEN
    ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
    RAISE NOTICE '  ✅ created_by ajoutée';
  END IF;

  -- assigned_to
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'assigned_to') THEN
    ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50);
    RAISE NOTICE '  ✅ assigned_to ajoutée';
  END IF;

  -- folder_id (UUID) - CRITIQUE
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') THEN
    ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT gen_random_uuid() UNIQUE;
    UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
    RAISE NOTICE '  ✅ folder_id ajoutée';
  END IF;

  -- quantite - MANQUANTE CRITIQUE (cause erreur création)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'quantite') THEN
    ALTER TABLE dossiers ADD COLUMN quantite INTEGER DEFAULT 1;
    RAISE NOTICE '  ✅ quantite ajoutée';
  END IF;

  -- date_validation_preparateur
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'date_validation_preparateur') THEN
    ALTER TABLE dossiers ADD COLUMN date_validation_preparateur TIMESTAMP;
    RAISE NOTICE '  ✅ date_validation_preparateur ajoutée';
  END IF;

  -- client_email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'client_email') THEN
    ALTER TABLE dossiers ADD COLUMN client_email VARCHAR(255);
    RAISE NOTICE '  ✅ client_email ajoutée';
  END IF;

  -- client_telephone
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'client_telephone') THEN
    ALTER TABLE dossiers ADD COLUMN client_telephone VARCHAR(50);
    RAISE NOTICE '  ✅ client_telephone ajoutée';
  END IF;

  -- date_livraison_prevue
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'date_livraison_prevue') THEN
    ALTER TABLE dossiers ADD COLUMN date_livraison_prevue DATE;
    RAISE NOTICE '  ✅ date_livraison_prevue ajoutée';
  END IF;

  -- commentaire_revision
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'commentaire_revision') THEN
    ALTER TABLE dossiers ADD COLUMN commentaire_revision TEXT;
    RAISE NOTICE '  ✅ commentaire_revision ajoutée';
  END IF;

  -- revision_comment (alias)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'revision_comment') THEN
    ALTER TABLE dossiers ADD COLUMN revision_comment TEXT;
    RAISE NOTICE '  ✅ revision_comment ajoutée';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TABLE FICHIERS - Ajout uploaded_at
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '📁 CORRECTION TABLE FICHIERS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichiers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichiers' AND column_name = 'uploaded_at') THEN
      ALTER TABLE fichiers ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      UPDATE fichiers SET uploaded_at = created_at WHERE uploaded_at IS NULL;
      RAISE NOTICE '  ✅ uploaded_at ajoutée et synchronisée';
    END IF;
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. TABLES COMPLÉMENTAIRES
-- ═══════════════════════════════════════════════════════════════════════════

-- Table dossier_formulaires
CREATE TABLE IF NOT EXISTS dossier_formulaires (
  id SERIAL PRIMARY KEY,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_formulaire VARCHAR(50) NOT NULL,
  details JSONB NOT NULL,
  date_saisie TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Table dossier_status_history
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

-- Table activity_logs
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. INDEX POUR OPTIMISATION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_dossiers_valide_preparateur ON dossiers(valide_preparateur);
CREATE INDEX IF NOT EXISTS idx_dossiers_machine ON dossiers(machine);
CREATE INDEX IF NOT EXISTS idx_dossiers_numero_commande ON dossiers(numero_commande);
CREATE INDEX IF NOT EXISTS idx_dossiers_assigned_to ON dossiers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_created_by ON dossiers(created_by);
CREATE INDEX IF NOT EXISTS idx_dossiers_quantite ON dossiers(quantite);

CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);
CREATE INDEX IF NOT EXISTS idx_activity_folder_id ON activity_logs(folder_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SYNCHRONISATION DES DONNÉES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '🔄 SYNCHRONISATION DES DONNÉES';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

  -- Remplir folder_id pour les dossiers sans
  UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
  
  -- Copier type_formulaire vers machine
  UPDATE dossiers SET machine = type_formulaire WHERE machine IS NULL AND type_formulaire IS NOT NULL;
  
  -- Copier numero vers numero_commande
  UPDATE dossiers SET numero_commande = numero WHERE numero_commande IS NULL AND numero IS NOT NULL;
  
  -- Copier preparateur_id vers created_by
  UPDATE dossiers SET created_by = preparateur_id WHERE created_by IS NULL AND preparateur_id IS NOT NULL;
  
  -- S'assurer que quantite a une valeur par défaut
  UPDATE dossiers SET quantite = 1 WHERE quantite IS NULL;
  
  RAISE NOTICE '  ✅ Données synchronisées';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RÉSUMÉ FINAL
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  dossiers_count INTEGER;
  fichiers_count INTEGER;
  users_count INTEGER;
  colonnes_dossiers INTEGER;
  has_quantite BOOLEAN;
  has_uploaded_at BOOLEAN;
  has_folder_id BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO dossiers_count FROM dossiers;
  SELECT COUNT(*) INTO fichiers_count FROM fichiers;
  SELECT COUNT(*) INTO users_count FROM users;
  
  SELECT COUNT(*) INTO colonnes_dossiers 
  FROM information_schema.columns 
  WHERE table_name = 'dossiers';
  
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'quantite') INTO has_quantite;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichiers' AND column_name = 'uploaded_at') INTO has_uploaded_at;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dossiers' AND column_name = 'folder_id') INTO has_folder_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 CORRECTION COMPLÈTE TERMINÉE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Utilisateurs: %', users_count;
  RAISE NOTICE 'Dossiers: %', dossiers_count;
  RAISE NOTICE 'Fichiers: %', fichiers_count;
  RAISE NOTICE 'Colonnes table dossiers: %', colonnes_dossiers;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Colonne quantite: %', CASE WHEN has_quantite THEN 'PRÉSENTE' ELSE 'MANQUANTE' END;
  RAISE NOTICE '✅ Colonne uploaded_at: %', CASE WHEN has_uploaded_at THEN 'PRÉSENTE' ELSE 'MANQUANTE' END;
  RAISE NOTICE '✅ Colonne folder_id: %', CASE WHEN has_folder_id THEN 'PRÉSENTE' ELSE 'MANQUANTE' END;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END$$;
