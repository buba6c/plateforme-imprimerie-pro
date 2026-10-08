-- Purge définitive des fichiers d'impression (Fichiers > Corbeille > Supprimer définitivement).
-- La ligne reste comme trace : purge_at / purge_par disent qui a supprimé le fichier du disque et quand,
-- purge_resultat ce qui s'est passé sur le disque (supprimé, partagé avec d'autres noms, absent, erreur).
-- Seul un fichier déjà à la corbeille peut être purgé, et un fichier purgé ne peut plus être restauré
-- (deleted_at ne peut pas redevenir NULL tant que purge_at est renseigné). Compatible PostgreSQL 14.

ALTER TABLE fichiers
  ADD COLUMN IF NOT EXISTS purge_at timestamptz,
  ADD COLUMN IF NOT EXISTS purge_par integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS purge_resultat text;

ALTER TABLE fichiers DROP CONSTRAINT IF EXISTS fichiers_purge_apres_corbeille;
ALTER TABLE fichiers
  ADD CONSTRAINT fichiers_purge_apres_corbeille CHECK (purge_at IS NULL OR deleted_at IS NOT NULL);

-- Corbeille des fichiers : seulement ceux qui n'ont pas été purgés.
DROP INDEX IF EXISTS fichiers_corbeille;
CREATE INDEX IF NOT EXISTS fichiers_corbeille ON fichiers (deleted_at DESC, id DESC)
  WHERE deleted_at IS NOT NULL AND purge_at IS NULL;

-- Avant d'effacer un fichier du disque : une autre ligne non purgée utilise-t-elle le même chemin ?
CREATE INDEX IF NOT EXISTS fichiers_chemin ON fichiers (chemin) WHERE purge_at IS NULL;

-- Tri « plus lourds d'abord » de la liste des fichiers (recommandé par l'audit du 8 octobre 2026).
CREATE INDEX IF NOT EXISTS fichiers_taille ON fichiers (taille DESC, id DESC) WHERE deleted_at IS NULL;
