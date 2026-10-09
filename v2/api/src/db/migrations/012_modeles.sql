-- Modèles de dossier enregistrés par les préparateurs (« En-têtes 250 g », « Cartes de visite pelliculées »…) :
-- une machine, des spécifications complètes, éventuellement description, consignes et mode de remise.
-- Partagés avec toute l'équipe ou gardés pour soi. Suppression logique.
CREATE TABLE modeles_dossier (
  id           serial PRIMARY KEY,
  nom          text NOT NULL CHECK (length(nom) BETWEEN 1 AND 80),
  machine      text NOT NULL CHECK (machine IN ('roland', 'xerox')),
  specs        jsonb NOT NULL,
  description  text,
  consignes    text,
  mode_remise  text CHECK (mode_remise IN ('livraison', 'retrait')),
  partage      boolean NOT NULL DEFAULT true,
  cree_par     integer NOT NULL REFERENCES users(id),
  usages       integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX modeles_dossier_actifs ON modeles_dossier (cree_par, partage) WHERE deleted_at IS NULL;
