-- Correction de la synchronisation des dossiers pour tous les rôles
-- À exécuter sur votre base PostgreSQL

-- 1. Renomme les colonnes pour correspondre au workflow actuel
ALTER TABLE dossiers RENAME COLUMN numero TO numero_commande;
ALTER TABLE dossiers RENAME COLUMN client TO client_nom;
ALTER TABLE dossiers RENAME COLUMN type_formulaire TO type;
ALTER TABLE dossiers RENAME COLUMN statut TO status;

-- 2. Met à jour les statuts pour le workflow actuel
UPDATE dossiers
SET status = CASE
    WHEN status = 'nouveau' THEN 'en_cours'
    WHEN status = 'en_preparation' THEN 'en_cours'
    WHEN status = 'pret_impression' THEN 'en_cours'
    WHEN status = 'imprime' THEN 'termine'
    WHEN status = 'pret_livraison' THEN 'termine'
    ELSE status
END;

-- 3. Vérifie que le type est bien 'roland' ou 'xerox'
UPDATE dossiers
SET type = CASE
    WHEN type IS NULL OR type = '' THEN 'roland'
    ELSE type
END
WHERE type IS NULL OR type = '';

-- 4. Vérifie le résultat
SELECT id, numero_commande, client_nom, type, status FROM dossiers ORDER BY id DESC;
