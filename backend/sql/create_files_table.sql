-- Script SQL pour créer la table des fichiers
-- Plateforme Imprimerie Numérique EvocomPrint

-- Créer la table files si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL UNIQUE,
    filepath TEXT NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT files_size_positive CHECK (size >= 0),
    CONSTRAINT files_filename_not_empty CHECK (LENGTH(TRIM(filename)) > 0),
    CONSTRAINT files_original_filename_not_empty CHECK (LENGTH(TRIM(original_filename)) > 0),
    CONSTRAINT files_filepath_not_empty CHECK (LENGTH(TRIM(filepath)) > 0)
);

-- Créer des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_files_dossier_id ON files(dossier_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_mimetype ON files(mimetype);
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);

-- Créer une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer le trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_files_updated_at ON files;
CREATE TRIGGER trigger_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_files_updated_at();

-- Ajouter des commentaires pour la documentation
COMMENT ON TABLE files IS 'Table des fichiers attachés aux dossiers d''impression';
COMMENT ON COLUMN files.id IS 'Identifiant unique du fichier';
COMMENT ON COLUMN files.dossier_id IS 'Référence vers le dossier auquel le fichier est attaché';
COMMENT ON COLUMN files.original_filename IS 'Nom original du fichier tel qu''uploadé par l''utilisateur';
COMMENT ON COLUMN files.filename IS 'Nom du fichier sur le serveur (unique)';
COMMENT ON COLUMN files.filepath IS 'Chemin complet vers le fichier sur le serveur';
COMMENT ON COLUMN files.mimetype IS 'Type MIME du fichier (ex: application/pdf, image/jpeg)';
COMMENT ON COLUMN files.size IS 'Taille du fichier en octets';
COMMENT ON COLUMN files.uploaded_by IS 'Utilisateur qui a uploadé le fichier';
COMMENT ON COLUMN files.created_at IS 'Date et heure de création du fichier';
COMMENT ON COLUMN files.updated_at IS 'Date et heure de dernière modification';

-- Afficher le résultat
SELECT 'Table files créée avec succès' as status;