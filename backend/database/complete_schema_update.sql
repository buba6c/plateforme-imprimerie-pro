-- Script complet pour mettre à jour le schéma PostgreSQL
-- Ajoute toutes les colonnes manquantes trouvées dans le code de l'application
-- Exécution sécurisée avec vérifications d'existence

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ajouter les colonnes manquantes à la table dossiers
DO $$
BEGIN
  -- Colonne valide_preparateur (critique pour les requêtes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT false;
    RAISE NOTICE 'Colonne valide_preparateur ajoutée';
  END IF;

  -- Colonne machine (alternative/alias pour type_formulaire)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'machine'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN machine VARCHAR(50);
    RAISE NOTICE 'Colonne machine ajoutée';
  END IF;

  -- Colonne description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'description'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN description TEXT;
    RAISE NOTICE 'Colonne description ajoutée';
  END IF;

  -- Colonne numero_commande
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'numero_commande'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN numero_commande VARCHAR(100);
    RAISE NOTICE 'Colonne numero_commande ajoutée';
  END IF;

  -- Colonne created_by (pour la compatibilité avec le code)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
    RAISE NOTICE 'Colonne created_by ajoutée';
  END IF;

  -- Colonne assigned_to (trouvée dans les migrations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50);
    RAISE NOTICE 'Colonne assigned_to ajoutée';
  END IF;

  -- Colonne folder_id UUID (trouvée dans les migrations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT gen_random_uuid() UNIQUE;
    RAISE NOTICE 'Colonne folder_id ajoutée';
  END IF;

  -- Mettre à jour les contraintes de statut pour inclure tous les statuts utilisés
  BEGIN
    ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_statut_check;
    ALTER TABLE dossiers ADD CONSTRAINT dossiers_statut_check 
    CHECK (statut IN (
      'en_cours', 'a_revoir', 'en_impression', 'termine', 'en_livraison', 'livre',
      'En cours', 'À revoir', 'En impression', 'Terminé', 'Livré', 
      'Prêt impression', 'Imprimé', 'pret_impression', 'imprime'
    ));
    RAISE NOTICE 'Contraintes de statut mises à jour';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Erreur lors de la mise à jour des contraintes de statut: %', SQLERRM;
  END;

  -- Mettre à jour les contraintes de type_formulaire/machine
  BEGIN
    ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_type_formulaire_check;
    ALTER TABLE dossiers ADD CONSTRAINT dossiers_type_formulaire_check 
    CHECK (type_formulaire IN ('roland', 'xerox', 'Roland', 'Xerox') OR type_formulaire IS NULL);
    RAISE NOTICE 'Contraintes de type_formulaire mises à jour';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Erreur lors de la mise à jour des contraintes de type: %', SQLERRM;
  END;
END$$;

-- Créer les tables manquantes si elles n'existent pas
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

CREATE TABLE IF NOT EXISTS dossier_formulaires (
  id SERIAL PRIMARY KEY,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_formulaire VARCHAR(50) NOT NULL,
  details JSONB NOT NULL,
  date_saisie TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

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

-- Créer les index manquants
CREATE INDEX IF NOT EXISTS idx_dossiers_valide_preparateur ON dossiers(valide_preparateur);
CREATE INDEX IF NOT EXISTS idx_dossiers_machine ON dossiers(machine);
CREATE INDEX IF NOT EXISTS idx_dossiers_numero_commande ON dossiers(numero_commande);
CREATE INDEX IF NOT EXISTS idx_dossiers_assigned_to ON dossiers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_created_by ON dossiers(created_by);
CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON dossier_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
CREATE INDEX IF NOT EXISTS idx_activity_folder_id ON activity_logs(folder_id);

-- Synchroniser les données existantes
DO $$
BEGIN
  -- Remplir folder_id pour les dossiers existants
  UPDATE dossiers SET folder_id = gen_random_uuid() WHERE folder_id IS NULL;
  
  -- Remplir machine basé sur type_formulaire pour compatibilité
  UPDATE dossiers SET machine = type_formulaire WHERE machine IS NULL AND type_formulaire IS NOT NULL;
  
  -- Remplir numero_commande basé sur numero si disponible
  UPDATE dossiers SET numero_commande = numero WHERE numero_commande IS NULL AND numero IS NOT NULL;
  
  -- Remplir created_by basé sur preparateur_id si disponible
  UPDATE dossiers SET created_by = preparateur_id WHERE created_by IS NULL AND preparateur_id IS NOT NULL;
  
  RAISE NOTICE 'Données synchronisées';
END$$;

-- Fonction helper pour logger les actions
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

-- Fonction pour ajouter automatiquement un enregistrement d'historique
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

-- Créer le trigger pour l'historique automatique
DROP TRIGGER IF EXISTS trigger_dossier_status_history ON dossiers;
CREATE TRIGGER trigger_dossier_status_history
    AFTER UPDATE ON dossiers
    FOR EACH ROW
    EXECUTE FUNCTION add_status_history();

-- Afficher un résumé final
DO $$
DECLARE
  dossier_count INTEGER;
  user_count INTEGER;
  columns_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dossier_count FROM dossiers;
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO columns_count 
  FROM information_schema.columns 
  WHERE table_name = 'dossiers';
  
  RAISE NOTICE '✅ Mise à jour du schéma terminée';
  RAISE NOTICE '   Utilisateurs: %', user_count;
  RAISE NOTICE '   Dossiers: %', dossier_count;
  RAISE NOTICE '   Colonnes dans dossiers: %', columns_count;
  RAISE NOTICE '   Tables créées: dossier_status_history, dossier_formulaires, activity_logs';
  RAISE NOTICE '   Triggers et fonctions créés';
END$$;