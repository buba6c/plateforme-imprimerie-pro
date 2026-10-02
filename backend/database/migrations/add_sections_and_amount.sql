-- Migration: Ajout du champ amount et structure sections[]
-- Date: 2025-10-30
-- Description: Permet la gestion de sections dynamiques (grammage, papier, finitions multiples)
--              et l'ajout d'un montant facultatif visible selon les rôles

-- ============================================
-- 1. Ajouter le champ amount (facultatif)
-- ============================================
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2) DEFAULT NULL;

COMMENT ON COLUMN dossiers.amount IS 'Montant facultatif en CFA - Visible Admin/Préparateur/Livreur, masqué Imprimeurs';

-- ============================================
-- 2. Ajouter la colonne sections (JSONB)
-- ============================================
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN dossiers.sections IS 'Sections dynamiques pour gérer multiples grammages/papiers/finitions - Structure: [{id, type, mode_impression, copies, paper_types: [{grammage, type}], finitions[], faconnage[]}]';

-- ============================================
-- 3. Index pour optimiser les requêtes sur sections
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dossiers_sections ON dossiers USING GIN (sections);

-- ============================================
-- 4. Ajouter colonne supports pour Roland (multiples produits)
-- ============================================
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS supports JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN dossiers.supports IS 'Pour Roland: permet plusieurs produits (bâche + vinyle) dans un même dossier - Structure: [{id, type_support, largeur, hauteur, exemplaires, finitions}]';

CREATE INDEX IF NOT EXISTS idx_dossiers_supports ON dossiers USING GIN (supports);

-- ============================================
-- 5. Ajouter des métadonnées de migration
-- ============================================
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

COMMENT ON COLUMN dossiers.schema_version IS 'Version du schéma (1=legacy, 2=avec sections) pour rétro-compatibilité';

-- ============================================
-- 6. Fonction pour valider la structure sections
-- ============================================
CREATE OR REPLACE FUNCTION validate_sections_structure(sections_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Vérifier que c'est un tableau
  IF jsonb_typeof(sections_data) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Si vide, c'est valide
  IF jsonb_array_length(sections_data) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Vérifier la structure de chaque section
  -- (implémentation basique - peut être étendue)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 7. Contrainte de validation (optionnel)
-- ============================================
-- ALTER TABLE dossiers 
-- ADD CONSTRAINT check_sections_structure 
-- CHECK (validate_sections_structure(sections));

-- ============================================
-- 8. Trigger pour mettre à jour schema_version automatiquement
-- ============================================
CREATE OR REPLACE FUNCTION update_schema_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Si sections ou supports sont modifiés et non vides, passer en version 2
  IF (NEW.sections IS NOT NULL AND jsonb_array_length(NEW.sections) > 0) OR 
     (NEW.supports IS NOT NULL AND jsonb_array_length(NEW.supports) > 0) THEN
    NEW.schema_version = 2;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_schema_version ON dossiers;
CREATE TRIGGER trigger_update_schema_version
  BEFORE INSERT OR UPDATE ON dossiers
  FOR EACH ROW
  EXECUTE FUNCTION update_schema_version();

-- ============================================
-- 9. Vue pour simplifier les requêtes avec visibilité amount
-- ============================================
CREATE OR REPLACE VIEW dossiers_with_amount AS
SELECT 
  d.*,
  CASE 
    WHEN d.amount IS NOT NULL THEN d.amount
    ELSE NULL
  END as montant_visible
FROM dossiers d;

-- ============================================
-- 10. Afficher le résumé de la migration
-- ============================================
DO $$
DECLARE
  dossiers_count INTEGER;
  with_amount_count INTEGER;
  with_sections_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dossiers_count FROM dossiers;
  SELECT COUNT(*) INTO with_amount_count FROM dossiers WHERE amount IS NOT NULL;
  SELECT COUNT(*) INTO with_sections_count FROM dossiers WHERE jsonb_array_length(sections) > 0;
  
  RAISE NOTICE '✅ Migration terminée avec succès !';
  RAISE NOTICE '📊 Total dossiers: %', dossiers_count;
  RAISE NOTICE '💰 Dossiers avec montant: %', with_amount_count;
  RAISE NOTICE '📋 Dossiers avec sections: %', with_sections_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Nouvelles colonnes ajoutées:';
  RAISE NOTICE '   - amount (DECIMAL) : Montant facultatif';
  RAISE NOTICE '   - sections (JSONB) : Sections dynamiques';
  RAISE NOTICE '   - supports (JSONB) : Supports multiples Roland';
  RAISE NOTICE '   - schema_version (INTEGER) : Version pour compatibilité';
END;
$$;
