-- Traitement des fichiers d'impression : chaque PDF déposé est réparé si besoin (qpdf) et optimisé pour
-- l'impression (Ghostscript, réglages prépresse) en arrière-plan. L'original n'est jamais modifié :
-- la version traitée est rangée à côté (chemin_traite) et servie par défaut ; le rapport (traitement)
-- dit ce qui a été fait. Compatible PostgreSQL 14.
ALTER TABLE fichiers
  ADD COLUMN IF NOT EXISTS chemin_traite text,
  ADD COLUMN IF NOT EXISTS taille_traitee bigint,
  ADD COLUMN IF NOT EXISTS traitement jsonb;

CREATE INDEX IF NOT EXISTS fichiers_a_traiter ON fichiers (id)
  WHERE deleted_at IS NULL AND purge_at IS NULL AND traitement IS NULL;
