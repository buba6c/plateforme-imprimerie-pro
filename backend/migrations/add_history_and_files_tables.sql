-- Migration pour ajouter les tables d'historique des statuts et des fichiers
-- À exécuter en cas de besoin

-- Table pour l'historique des changements de statuts
CREATE TABLE IF NOT EXISTS dossier_status_history (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON dossier_status_history(changed_at);

-- Table pour les fichiers attachés aux dossiers
CREATE TABLE IF NOT EXISTS dossier_files (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100),
    size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_dossier_files_dossier_id ON dossier_files(dossier_id);

-- Fonction pour ajouter automatiquement un enregistrement d'historique lors du changement de statut
CREATE OR REPLACE FUNCTION add_status_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Insérer dans l'historique seulement si le statut a changé
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_at)
        VALUES (NEW.id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour l'historique automatique (optionnel)
DROP TRIGGER IF EXISTS trigger_dossier_status_history ON dossiers;
CREATE TRIGGER trigger_dossier_status_history
    AFTER UPDATE ON dossiers
    FOR EACH ROW
    EXECUTE FUNCTION add_status_history();

-- Ajouter un enregistrement d'historique initial pour les dossiers existants
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_at)
SELECT id, NULL, status, created_at 
FROM dossiers 
WHERE id NOT IN (SELECT DISTINCT dossier_id FROM dossier_status_history);

COMMENT ON TABLE dossier_status_history IS 'Historique des changements de statut des dossiers';
COMMENT ON TABLE dossier_files IS 'Fichiers attachés aux dossiers d''impression';