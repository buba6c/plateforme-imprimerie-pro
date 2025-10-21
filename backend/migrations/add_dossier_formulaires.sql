-- Création d'une table pour stocker les détails structurés du formulaire
-- Utilisée pour garantir l'affichage des champs Roland/Xerox après création

CREATE TABLE IF NOT EXISTS dossier_formulaires (
  id SERIAL PRIMARY KEY,
  dossier_id UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type_formulaire VARCHAR(50) NOT NULL,
  details JSONB NOT NULL,
  date_saisie TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Contrainte de cohérence souple (autorise Roland/Xerox en casse variable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chk_dossier_formulaires_type'
  ) THEN
    ALTER TABLE dossier_formulaires
      ADD CONSTRAINT chk_dossier_formulaires_type
      CHECK (LOWER(type_formulaire) IN ('roland','xerox'));
  END IF;
END $$;

-- Index pour accélérer la récupération par dossier et par date
CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);
CREATE INDEX IF NOT EXISTS idx_dossier_formulaires_date_saisie ON dossier_formulaires(date_saisie);

COMMENT ON TABLE dossier_formulaires IS 'Détails structurés des formulaires par dossier (Roland/Xerox)';
COMMENT ON COLUMN dossier_formulaires.details IS 'JSONB des champs saisis (surface, dimension, etc.)';
