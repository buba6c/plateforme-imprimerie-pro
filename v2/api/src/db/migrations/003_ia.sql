-- Assistant IA de saisie : configuration (une seule ligne) et journal d'usage.
-- La clé OpenAI n'est jamais stockée en clair ni dans la table parametres (lisible par tous les rôles).

CREATE TABLE ia_config (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  actif         boolean NOT NULL DEFAULT false,
  modele        text NOT NULL DEFAULT 'gpt-4o-mini',
  -- AES-256-GCM, format « v1:<iv>:<tag>:<chiffré> » en base64 (voir modules/ia/chiffrement.ts).
  cle_chiffree  text,
  -- 4 derniers caractères, pour que l'administrateur reconnaisse la clé enregistrée.
  cle_fin       text CHECK (cle_fin IS NULL OR length(cle_fin) <= 4),
  updated_by    integer REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ia_config (id) VALUES (1);

-- Une ligne par appel à OpenAI. Ni la demande complète ni la réponse : seulement un extrait court.
CREATE TABLE ia_usage (
  id                bigserial PRIMARY KEY,
  user_id           integer REFERENCES users(id),
  type              text NOT NULL CHECK (type IN ('suggestion', 'test')),
  statut            text NOT NULL,
  modele            text,
  duree_ms          integer NOT NULL,
  jetons_entree     integer,
  jetons_sortie     integer,
  longueur_demande  integer,
  extrait           text CHECK (extrait IS NULL OR length(extrait) <= 120),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ia_usage_created ON ia_usage (created_at DESC);
CREATE INDEX ia_usage_user ON ia_usage (user_id, created_at DESC);
