-- Modèles d'imposition : réglages enregistrés par l'administrateur (feuille, poses, fonds perdus, livret…),
-- que les préparateurs appliquent d'un clic dans Imposition. Les paramètres sont gardés en JSON et
-- revalidés à l'usage (schéma du module imposition). Compatible PostgreSQL 14.
CREATE TABLE IF NOT EXISTS imposition_modeles (
  id          serial PRIMARY KEY,
  nom         text NOT NULL CHECK (length(nom) BETWEEN 1 AND 80),
  description text,
  params      jsonb NOT NULL,
  ordre       integer NOT NULL DEFAULT 0,
  created_by  integer REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS imposition_modeles_nom ON imposition_modeles (lower(nom));
