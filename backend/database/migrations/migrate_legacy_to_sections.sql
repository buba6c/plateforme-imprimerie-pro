-- Script de migration: Conversion des anciens dossiers vers le nouveau format avec sections
-- Date: 2025-10-30
-- Description: Convertit data_formulaire (legacy) en structure sections[] pour rétro-compatibilité

-- ============================================
-- Fonction de migration des dossiers Xerox
-- ============================================
CREATE OR REPLACE FUNCTION migrate_xerox_to_sections(formulaire_data JSONB)
RETURNS JSONB AS $$
DECLARE
  sections_result JSONB;
  section JSONB;
  paper_types JSONB;
BEGIN
  -- Initialiser le tableau de sections
  sections_result := '[]'::jsonb;
  
  -- Créer une section principale à partir du formulaire Xerox
  section := jsonb_build_object(
    'id', 1,
    'type', COALESCE(formulaire_data->>'type_document', 'Document'),
    'mode_impression', COALESCE(formulaire_data->>'mode_impression', 'recto_simple'),
    'copies', COALESCE((formulaire_data->>'nombre_exemplaires')::integer, 1),
    'couleur', COALESCE(formulaire_data->>'couleur_impression', 'couleur'),
    'format', COALESCE(formulaire_data->>'format', 'A4')
  );
  
  -- Ajouter les types de papier
  paper_types := '[]'::jsonb;
  IF formulaire_data->>'grammage' IS NOT NULL THEN
    paper_types := paper_types || jsonb_build_array(
      jsonb_build_object(
        'grammage', formulaire_data->>'grammage',
        'type', 'Standard'
      )
    );
  END IF;
  section := section || jsonb_build_object('paper_types', paper_types);
  
  -- Ajouter les finitions si présentes
  IF formulaire_data->'finition' IS NOT NULL THEN
    section := section || jsonb_build_object('finitions', formulaire_data->'finition');
  ELSE
    section := section || jsonb_build_object('finitions', '[]'::jsonb);
  END IF;
  
  -- Ajouter le façonnage si présent
  IF formulaire_data->'faconnage' IS NOT NULL THEN
    section := section || jsonb_build_object('faconnage', formulaire_data->'faconnage');
  ELSE
    section := section || jsonb_build_object('faconnage', '[]'::jsonb);
  END IF;
  
  -- Ajouter la section au résultat
  sections_result := sections_result || jsonb_build_array(section);
  
  RETURN sections_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Fonction de migration des dossiers Roland
-- ============================================
CREATE OR REPLACE FUNCTION migrate_roland_to_supports(formulaire_data JSONB)
RETURNS JSONB AS $$
DECLARE
  supports_result JSONB;
  support JSONB;
BEGIN
  -- Initialiser le tableau de supports
  supports_result := '[]'::jsonb;
  
  -- Créer un support principal à partir du formulaire Roland
  support := jsonb_build_object(
    'id', 1,
    'type_support', COALESCE(formulaire_data->>'type_support', 'Bâche'),
    'largeur', COALESCE((formulaire_data->>'largeur')::numeric, 0),
    'hauteur', COALESCE((formulaire_data->>'hauteur')::numeric, 0),
    'unite', COALESCE(formulaire_data->>'unite', 'cm'),
    'exemplaires', COALESCE((formulaire_data->>'nombre_exemplaires')::integer, 1)
  );
  
  -- Ajouter les finitions si présentes
  IF formulaire_data->>'finition_oeillets' IS NOT NULL OR formulaire_data->>'finition_position' IS NOT NULL THEN
    support := support || jsonb_build_object(
      'finitions', jsonb_build_array(
        jsonb_build_object(
          'type', 'oeillets',
          'position', COALESCE(formulaire_data->>'finition_position', 'standard')
        )
      )
    );
  ELSE
    support := support || jsonb_build_object('finitions', '[]'::jsonb);
  END IF;
  
  -- Ajouter le support au résultat
  supports_result := supports_result || jsonb_build_array(support);
  
  RETURN supports_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Migration des dossiers existants
-- ============================================
DO $$
DECLARE
  dossier_record RECORD;
  migrated_count INTEGER := 0;
  xerox_count INTEGER := 0;
  roland_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Début de la migration des dossiers existants...';
  RAISE NOTICE '';
  
  -- Migrer tous les dossiers qui n''ont pas encore de sections
  FOR dossier_record IN 
    SELECT id, numero, type_formulaire, data_formulaire
    FROM dossiers
    WHERE (sections IS NULL OR jsonb_array_length(sections) = 0)
      AND data_formulaire IS NOT NULL
      AND schema_version = 1
  LOOP
    BEGIN
      IF dossier_record.type_formulaire = 'xerox' THEN
        -- Migrer Xerox vers sections
        UPDATE dossiers 
        SET 
          sections = migrate_xerox_to_sections(dossier_record.data_formulaire),
          schema_version = 2
        WHERE id = dossier_record.id;
        
        xerox_count := xerox_count + 1;
        
      ELSIF dossier_record.type_formulaire = 'roland' THEN
        -- Migrer Roland vers supports
        UPDATE dossiers 
        SET 
          supports = migrate_roland_to_supports(dossier_record.data_formulaire),
          schema_version = 2
        WHERE id = dossier_record.id;
        
        roland_count := roland_count + 1;
      END IF;
      
      migrated_count := migrated_count + 1;
      
      -- Log tous les 10 dossiers
      IF migrated_count % 10 = 0 THEN
        RAISE NOTICE '   Migré % dossiers...', migrated_count;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️  Erreur migration dossier %: %', dossier_record.numero, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration terminée !';
  RAISE NOTICE '📊 Total migré: % dossiers', migrated_count;
  RAISE NOTICE '   - Xerox: %', xerox_count;
  RAISE NOTICE '   - Roland: %', roland_count;
  RAISE NOTICE '';
  RAISE NOTICE '💡 Les anciens data_formulaire sont conservés pour compatibilité';
END;
$$;

-- ============================================
-- Vérification post-migration
-- ============================================
DO $$
DECLARE
  total_dossiers INTEGER;
  with_sections INTEGER;
  with_supports INTEGER;
  legacy_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_dossiers FROM dossiers;
  SELECT COUNT(*) INTO with_sections FROM dossiers WHERE jsonb_array_length(sections) > 0;
  SELECT COUNT(*) INTO with_supports FROM dossiers WHERE jsonb_array_length(supports) > 0;
  SELECT COUNT(*) INTO legacy_remaining FROM dossiers WHERE schema_version = 1;
  
  RAISE NOTICE '📋 État post-migration:';
  RAISE NOTICE '   Total dossiers: %', total_dossiers;
  RAISE NOTICE '   Avec sections (Xerox): %', with_sections;
  RAISE NOTICE '   Avec supports (Roland): %', with_supports;
  RAISE NOTICE '   Restant en legacy: %', legacy_remaining;
  RAISE NOTICE '';
  
  IF legacy_remaining > 0 THEN
    RAISE NOTICE '⚠️  % dossiers restent en format legacy (probablement sans data_formulaire)', legacy_remaining;
  ELSE
    RAISE NOTICE '✅ Tous les dossiers ont été migrés avec succès !';
  END IF;
END;
$$;

-- ============================================
-- Exemple de requête pour tester
-- ============================================
-- SELECT 
--   numero,
--   type_formulaire,
--   schema_version,
--   jsonb_array_length(sections) as nb_sections,
--   jsonb_array_length(supports) as nb_supports
-- FROM dossiers
-- ORDER BY created_at DESC
-- LIMIT 10;
