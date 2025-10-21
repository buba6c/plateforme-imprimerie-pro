-- ====================================================================
-- SCRIPT DE CORRECTION DES PROBLÈMES DE BASE DE DONNÉES
-- Plateforme Imprimerie - Date: 6 octobre 2025
-- ====================================================================

-- 1. VÉRIFIER LES COLONNES MANQUANTES ET LES AJOUTER SI NÉCESSAIRE

-- 1.1. Vérifier et ajouter la colonne description si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'description'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN description TEXT;
        RAISE NOTICE 'Colonne description ajoutée à la table dossiers';
    ELSE
        RAISE NOTICE 'Colonne description existe déjà dans la table dossiers';
    END IF;
END $$;

-- 1.2. Vérifier et ajouter la colonne client_email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'client_email'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN client_email VARCHAR(255);
        RAISE NOTICE 'Colonne client_email ajoutée à la table dossiers';
    ELSE
        RAISE NOTICE 'Colonne client_email existe déjà dans la table dossiers';
    END IF;
END $$;

-- 1.3. Vérifier et corriger la colonne created_by (elle existe mais vérifier le type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'dossiers' 
        AND column_name = 'created_by'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE dossiers ADD COLUMN created_by INTEGER REFERENCES users(id);
        RAISE NOTICE 'Colonne created_by ajoutée à la table dossiers';
    ELSE
        RAISE NOTICE 'Colonne created_by existe déjà dans la table dossiers';
    END IF;
END $$;

-- 2. CORRIGER LES CONTRAINTES PROBLÉMATIQUES

-- 2.1. Supprimer la contrainte dossiers_statut_check si elle existe et est problématique
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'dossiers_statut_check' 
        AND table_name = 'dossiers'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE dossiers DROP CONSTRAINT dossiers_statut_check;
        RAISE NOTICE 'Contrainte dossiers_statut_check supprimée';
    ELSE
        RAISE NOTICE 'Contrainte dossiers_statut_check n''existe pas';
    END IF;
END $$;

-- 2.2. Créer une nouvelle contrainte statut plus flexible
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'dossiers_statut_valide' 
        AND table_name = 'dossiers'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE dossiers ADD CONSTRAINT dossiers_statut_valide 
        CHECK (statut IN (
            'En cours', 'À revoir', 'En impression', 'Imprimé', 'Terminé',
            'En livraison', 'Livré', 'Prêt impression', 'Pret impression',
            'en_cours', 'a_revoir', 'en_impression', 'imprime', 'termine',
            'en_livraison', 'livre', 'pret_impression'
        ));
        RAISE NOTICE 'Nouvelle contrainte dossiers_statut_valide créée';
    ELSE
        RAISE NOTICE 'Contrainte dossiers_statut_valide existe déjà';
    END IF;
END $$;

-- 3. NORMALISER LES DONNÉES EXISTANTES

-- 3.1. Mettre à jour les statuts existants pour qu'ils respectent les contraintes
UPDATE dossiers 
SET statut = CASE 
    WHEN statut = 'Imprimé' THEN 'Imprimé'
    WHEN statut = 'Prêt impression' THEN 'Prêt impression'
    WHEN statut = 'pret_impression' THEN 'Prêt impression'
    WHEN statut IS NULL THEN 'En cours'
    ELSE statut
END
WHERE statut IS NULL OR statut = 'pret_impression' OR statut = 'Imprimé';

-- 3.2. Corriger les problèmes de types UUID vs INTEGER
-- S'assurer que les ID sont cohérents
UPDATE dossiers SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = dossiers.created_by
);

-- 4. AJOUTER DES INDEX POUR AMÉLIORER LES PERFORMANCES

-- 4.1. Index sur client_email si la colonne a été ajoutée
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'idx_dossiers_client_email' 
        AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_dossiers_client_email ON dossiers(client_email);
        RAISE NOTICE 'Index idx_dossiers_client_email créé';
    ELSE
        RAISE NOTICE 'Index idx_dossiers_client_email existe déjà';
    END IF;
END $$;

-- 4.2. Index sur description pour les recherches
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'idx_dossiers_description' 
        AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_dossiers_description ON dossiers USING gin(to_tsvector('french', description));
        RAISE NOTICE 'Index idx_dossiers_description créé pour la recherche full-text';
    ELSE
        RAISE NOTICE 'Index idx_dossiers_description existe déjà';
    END IF;
END $$;

-- 5. VÉRIFICATIONS FINALES

-- 5.1. Compter les dossiers par statut pour vérifier la cohérence
SELECT 'Vérification des statuts:' as info;
SELECT statut, COUNT(*) as nombre_dossiers 
FROM dossiers 
GROUP BY statut 
ORDER BY COUNT(*) DESC;

-- 5.2. Vérifier les contraintes actives
SELECT 'Contraintes actives sur la table dossiers:' as info;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'dossiers' 
AND table_schema = 'public' 
ORDER BY constraint_type, constraint_name;

-- 5.3. Vérifier les colonnes de la table
SELECT 'Structure finale de la table dossiers:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'dossiers' 
AND table_schema = 'public' 
ORDER BY ordinal_position;

-- ====================================================================
-- FIN DU SCRIPT DE CORRECTION
-- ====================================================================

COMMIT;