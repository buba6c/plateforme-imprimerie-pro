-- Factures directes (sans dossier) et liaison VosFactures.fr.
--
-- 1. Une facture peut exister sans dossier : client saisi ou choisi dans l'annuaire, lignes libres,
--    remise, remarques et conditions de paiement propres à la facture.
-- 2. Le journal d'envoi vers VosFactures est une table à part : la facture elle-même reste immuable
--    (le trigger factures_immuables n'est pas modifié).
-- 3. La configuration VosFactures (sous-domaine, clé chiffrée, envoi automatique, vendeur) est
--    réservée à l'administrateur ; la clé n'est jamais stockée en clair ni dans la table parametres.

ALTER TABLE factures ALTER COLUMN dossier_id DROP NOT NULL;
ALTER TABLE factures
  ADD COLUMN client_email         text,
  ADD COLUMN remise               integer NOT NULL DEFAULT 0 CHECK (remise >= 0),
  ADD COLUMN notes                text,
  ADD COLUMN conditions_paiement  text,
  ADD COLUMN date_echeance        date;
-- Une facture sans dossier doit porter un client nommé.
ALTER TABLE factures ADD CONSTRAINT factures_client_nomme CHECK (dossier_id IS NOT NULL OR length(trim(client_nom)) > 0);
CREATE INDEX factures_date_emission ON factures (date_emission DESC, id DESC);
CREATE INDEX factures_client ON factures (client_id);

-- Journal d'envoi vers VosFactures : une ligne par facture, mise à jour à chaque tentative.
CREATE TABLE factures_vosfactures (
  facture_id        integer PRIMARY KEY REFERENCES factures(id),
  vosfactures_id    bigint,
  vosfactures_numero text,
  vosfactures_url   text,
  envoye_at         timestamptz,
  envoye_par        integer REFERENCES users(id),
  erreur            text,
  erreur_at         timestamptz,
  tentatives        integer NOT NULL DEFAULT 0,
  annulee_at        timestamptz,
  annulation_erreur text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX factures_vosfactures_distant ON factures_vosfactures (vosfactures_id) WHERE vosfactures_id IS NOT NULL;

CREATE TABLE vosfactures_config (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Sous-domaine du compte : « moncompte » pour https://moncompte.vosfactures.fr
  sous_domaine  text NOT NULL DEFAULT '',
  -- AES-256-GCM, format « v1:<iv>:<tag>:<chiffré> » en base64 (voir modules/ia/chiffrement.ts).
  cle_chiffree  text,
  cle_fin       text CHECK (cle_fin IS NULL OR length(cle_fin) <= 4),
  envoi_auto    boolean NOT NULL DEFAULT false,
  -- Vendeur par défaut : { nom, adresse, nif, email, telephone } ; un champ vide reprend Paramètres > Entreprise.
  vendeur       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by    integer REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO vosfactures_config (id) VALUES (1);
