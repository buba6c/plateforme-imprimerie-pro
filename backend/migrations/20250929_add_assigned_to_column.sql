-- Migration: Ajouter la colonne assigned_to dans dossiers
-- Ajoute un champ texte simple pour stocker l'assignation logique
-- Valeurs attendues: NULL | 'imprimeur_roland' | 'imprimeur_xerox'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dossiers' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE dossiers ADD COLUMN assigned_to VARCHAR(50) NULL;
    CREATE INDEX IF NOT EXISTS idx_dossiers_assigned_to ON dossiers(assigned_to);
  END IF;
END$$;
