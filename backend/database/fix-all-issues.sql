-- =========================================
-- SCRIPT DE CORRECTION COMPLET
-- Date: 8 octobre 2025
-- =========================================

-- 1. CORRIGER LA LONGUEUR DU CHAMP STATUT
-- -----------------------------------------
ALTER TABLE dossiers 
ALTER COLUMN statut TYPE VARCHAR(100);

-- 2. UNIFORMISER LES STATUTS EXISTANTS
-- -----------------------------------------
-- Nettoyer et normaliser tous les statuts

-- Statuts français (format affiché)
UPDATE dossiers SET statut = 'En cours' WHERE statut IN ('en_cours', 'EN_COURS', 'En cours');
UPDATE dossiers SET statut = 'À revoir' WHERE statut IN ('a_revoir', 'A_REVOIR', 'À revoir', 'A revoir');
UPDATE dossiers SET statut = 'Prêt impression' WHERE statut IN ('pret_impression', 'PRET_IMPRESSION', 'Prêt impression', 'Pret impression');
UPDATE dossiers SET statut = 'En impression' WHERE statut IN ('en_impression', 'EN_IMPRESSION', 'En impression');
UPDATE dossiers SET statut = 'Imprimé' WHERE statut IN ('imprime', 'IMPRIME', 'Imprimé', 'imprim_', 'imprim');
UPDATE dossiers SET statut = 'Prêt livraison' WHERE statut IN ('pret_livraison', 'PRET_LIVRAISON', 'Prêt livraison', 'Pret livraison');
UPDATE dossiers SET statut = 'En livraison' WHERE statut IN ('en_livraison', 'EN_LIVRAISON', 'En livraison');
UPDATE dossiers SET statut = 'Livré' WHERE statut IN ('livre', 'LIVRE', 'Livré', 'Livre');
UPDATE dossiers SET statut = 'Terminé' WHERE statut IN ('termine', 'TERMINE', 'Terminé', 'Termine');

-- 3. CORRIGER LE NOM DE LA COLONNE validé_preparateur
-- ----------------------------------------------------
-- Vérifier si la colonne existe avec accent
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'validé_preparateur'
    ) THEN
        -- Renommer la colonne
        ALTER TABLE dossiers RENAME COLUMN "validé_preparateur" TO valide_preparateur;
        RAISE NOTICE 'Colonne "validé_preparateur" renommée en "valide_preparateur"';
    ELSE
        RAISE NOTICE 'Colonne "validé_preparateur" non trouvée, pas de modification nécessaire';
    END IF;
END $$;

-- 4. VÉRIFIER ET AJOUTER DES CONTRAINTES
-- ---------------------------------------
-- Ajouter une contrainte pour les statuts valides
DO $$
BEGIN
    ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_statut_check;
    
    ALTER TABLE dossiers ADD CONSTRAINT dossiers_statut_check 
    CHECK (statut IN (
        'En cours',
        'À revoir', 
        'Prêt impression',
        'En impression',
        'Imprimé',
        'Prêt livraison',
        'En livraison',
        'Livré',
        'Terminé'
    ));
    
    RAISE NOTICE 'Contrainte de statut ajoutée';
END $$;

-- 5. VÉRIFIER LA STRUCTURE COMPLÈTE DE LA TABLE DOSSIERS
-- -------------------------------------------------------
-- S'assurer que toutes les colonnes nécessaires existent

-- Ajouter la colonne folder_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'folder_id'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN folder_id UUID DEFAULT gen_random_uuid();
        RAISE NOTICE 'Colonne folder_id ajoutée';
    END IF;
END $$;

-- Ajouter la colonne numero si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'numero'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN numero VARCHAR(50);
        RAISE NOTICE 'Colonne numero ajoutée';
    END IF;
END $$;

-- Ajouter la colonne numero_commande si elle n'existe pas  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'numero_commande'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN numero_commande VARCHAR(100);
        RAISE NOTICE 'Colonne numero_commande ajoutée';
    END IF;
END $$;

-- Ajouter la colonne preparateur_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'preparateur_id'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN preparateur_id INTEGER REFERENCES users(id);
        RAISE NOTICE 'Colonne preparateur_id ajoutée';
    END IF;
END $$;

-- Ajouter la colonne valide_preparateur si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'valide_preparateur'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Colonne valide_preparateur ajoutée';
    END IF;
END $$;

-- Ajouter la colonne date_validation_preparateur si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'date_validation_preparateur'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN date_validation_preparateur TIMESTAMP;
        RAISE NOTICE 'Colonne date_validation_preparateur ajoutée';
    END IF;
END $$;

-- Ajouter la colonne commentaire_revision si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'commentaire_revision'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN commentaire_revision TEXT;
        RAISE NOTICE 'Colonne commentaire_revision ajoutée';
    END IF;
END $$;

-- Ajouter la colonne type_formulaire si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'type_formulaire'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN type_formulaire VARCHAR(50);
        RAISE NOTICE 'Colonne type_formulaire ajoutée';
    END IF;
END $$;

-- Ajouter la colonne data_formulaire si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'data_formulaire'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN data_formulaire JSONB;
        RAISE NOTICE 'Colonne data_formulaire ajoutée';
    END IF;
END $$;

-- 6. CRÉER DES INDEX POUR LA PERFORMANCE
-- ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_dossiers_statut ON dossiers(statut);
CREATE INDEX IF NOT EXISTS idx_dossiers_preparateur_id ON dossiers(preparateur_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_type_formulaire ON dossiers(type_formulaire);
CREATE INDEX IF NOT EXISTS idx_dossiers_created_at ON dossiers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);

-- 7. AFFICHER UN RÉSUMÉ
-- ----------------------
SELECT 
    'En cours' as statut, 
    COUNT(*) as nombre 
FROM dossiers 
WHERE statut = 'En cours'
UNION ALL
SELECT 'À revoir', COUNT(*) FROM dossiers WHERE statut = 'À revoir'
UNION ALL
SELECT 'Prêt impression', COUNT(*) FROM dossiers WHERE statut = 'Prêt impression'
UNION ALL
SELECT 'En impression', COUNT(*) FROM dossiers WHERE statut = 'En impression'
UNION ALL
SELECT 'Imprimé', COUNT(*) FROM dossiers WHERE statut = 'Imprimé'
UNION ALL
SELECT 'Prêt livraison', COUNT(*) FROM dossiers WHERE statut = 'Prêt livraison'
UNION ALL
SELECT 'En livraison', COUNT(*) FROM dossiers WHERE statut = 'En livraison'
UNION ALL
SELECT 'Livré', COUNT(*) FROM dossiers WHERE statut = 'Livré'
UNION ALL
SELECT 'Terminé', COUNT(*) FROM dossiers WHERE statut = 'Terminé'
UNION ALL
SELECT 'AUTRES (à corriger)', COUNT(*) FROM dossiers 
WHERE statut NOT IN (
    'En cours', 'À revoir', 'Prêt impression', 'En impression', 
    'Imprimé', 'Prêt livraison', 'En livraison', 'Livré', 'Terminé'
);

-- TERMINÉ
SELECT '✅ Script de correction terminé!' as message;
