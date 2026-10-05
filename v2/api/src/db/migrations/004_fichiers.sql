-- Gestionnaire global des fichiers : index pour la liste transversale (tri par date d'envoi,
-- recherche dans le nom, filtre par auteur) et pour la corbeille des fichiers.

CREATE INDEX IF NOT EXISTS fichiers_envoi ON fichiers (created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS fichiers_auteur ON fichiers (uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS fichiers_corbeille ON fichiers (deleted_at DESC, id DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS fichiers_nom_trgm ON fichiers USING gin (lower(nom_original) gin_trgm_ops);
