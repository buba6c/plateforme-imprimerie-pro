-- =====================================================
-- Migration : Ajout champs pour conversion devis → dossier
-- Date : 2025-10-09
-- =====================================================

BEGIN;

-- 1. Ajout de colonnes dans la table devis
ALTER TABLE devis 
ADD COLUMN IF NOT EXISTS converted_folder_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Index pour les recherches de conversions
CREATE INDEX IF NOT EXISTS idx_devis_converted_folder ON devis(converted_folder_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);

-- 2. Ajout de colonnes dans la table dossiers
ALTER TABLE dossiers 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'creation',
ADD COLUMN IF NOT EXISTS devis_id INTEGER,
ADD COLUMN IF NOT EXISTS prix_devis DECIMAL(10,2);

-- Index pour traçabilité
CREATE INDEX IF NOT EXISTS idx_dossiers_source ON dossiers(source);
CREATE INDEX IF NOT EXISTS idx_dossiers_devis ON dossiers(devis_id);

-- Contrainte de clé étrangère (avec vérification d'existence)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_dossiers_devis'
    ) THEN
        ALTER TABLE dossiers 
        ADD CONSTRAINT fk_dossiers_devis 
        FOREIGN KEY (devis_id) REFERENCES devis(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Table d'historique de conversion
CREATE TABLE IF NOT EXISTS conversion_historique (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL,
    folder_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversion_devis ON conversion_historique(devis_id);
CREATE INDEX IF NOT EXISTS idx_conversion_folder ON conversion_historique(folder_id);

-- 4. Vue pour voir les devis avec leur dossier associé
CREATE OR REPLACE VIEW v_devis_avec_dossier AS
SELECT 
    d.*,
    dos.folder_id,
    dos.numero as dossier_numero,
    dos.statut as dossier_statut,
    u.prenom,
    u.nom,
    u.email
FROM devis d
LEFT JOIN dossiers dos ON d.converted_folder_id::uuid = dos.folder_id
LEFT JOIN users u ON d.user_id = u.id;


-- 6. Table pour les fichiers de devis
CREATE TABLE IF NOT EXISTS devis_fichiers (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_devis_fichiers_devis ON devis_fichiers(devis_id);

-- Commentaires
COMMENT ON TABLE conversion_historique IS 'Historique des conversions devis vers dossier';
COMMENT ON TABLE devis_fichiers IS 'Fichiers associes aux devis';

COMMIT;

-- Afficher un message de succès
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Migration appliquée avec succès !';
    RAISE NOTICE '   - Colonnes ajoutées aux tables devis et dossiers';
    RAISE NOTICE '   - Table conversion_historique créée';
    RAISE NOTICE '   - Table devis_fichiers créée';
    RAISE NOTICE '   - Vues SQL créées';
    RAISE NOTICE '   - Index créés';
END $$;
