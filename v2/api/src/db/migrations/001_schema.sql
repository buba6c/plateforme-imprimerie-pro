-- Evocom Print v2 : schéma initial.
-- Montants en FCFA entiers. Dates en timestamptz. Un seul vocabulaire de statuts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Utilisateurs -----------------------------------------------------------
CREATE TABLE users (
  id              serial PRIMARY KEY,
  nom             text NOT NULL,
  email           text NOT NULL,
  telephone       text,
  role            text NOT NULL CHECK (role IN ('admin','preparateur','imprimeur_roland','imprimeur_xerox','livreur')),
  password_hash   text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  -- Incrémenté à chaque changement de mot de passe ou désactivation : invalide les sessions ouvertes.
  token_version   integer NOT NULL DEFAULT 0,
  doit_changer_mdp boolean NOT NULL DEFAULT false,
  echecs_connexion integer NOT NULL DEFAULT 0,
  bloque_jusqu_a  timestamptz,
  last_login_at   timestamptz,
  legacy_id       integer UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- Clients ----------------------------------------------------------------
CREATE TABLE clients (
  id          serial PRIMARY KEY,
  nom         text NOT NULL,
  telephone   text,
  email       text,
  adresse     text,
  notes       text,
  fusionne_dans integer REFERENCES clients(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_nom_trgm ON clients USING gin (lower(nom) gin_trgm_ops);
CREATE INDEX clients_actifs ON clients (lower(nom)) WHERE fusionne_dans IS NULL;

-- Tarifs -----------------------------------------------------------------
CREATE TABLE tarifs (
  id          serial PRIMARY KEY,
  machine     text NOT NULL CHECK (machine IN ('roland','xerox','global')),
  categorie   text NOT NULL CHECK (categorie IN ('support','finition','option','divers')),
  code        text NOT NULL,
  libelle     text NOT NULL,
  unite       text NOT NULL CHECK (unite IN ('m2','ml','page','feuille','exemplaire','unite','forfait','pourcent')),
  prix        integer CHECK (prix IS NULL OR prix >= 0),
  actif       boolean NOT NULL DEFAULT true,
  ordre       integer NOT NULL DEFAULT 0,
  description text,
  updated_by  integer REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (machine, code)
);

-- Paramètres (clé / valeur JSON) -----------------------------------------
CREATE TABLE parametres (
  cle         text PRIMARY KEY,
  valeur      jsonb NOT NULL,
  updated_by  integer REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Compteurs de numérotation sans trou (CMD, DEV, FAC) ----------------------
CREATE TABLE compteurs (
  cle     text NOT NULL,
  annee   integer NOT NULL,
  valeur  integer NOT NULL,
  PRIMARY KEY (cle, annee)
);

-- Dossiers ---------------------------------------------------------------
CREATE TABLE dossiers (
  id                  serial PRIMARY KEY,
  public_id           uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  numero              text NOT NULL UNIQUE,
  machine             text NOT NULL CHECK (machine IN ('roland','xerox')),
  statut              text NOT NULL DEFAULT 'en_cours'
                        CHECK (statut IN ('en_cours','a_revoir','pret_impression','en_impression','pret_livraison','en_livraison','livre','termine')),
  client_id           integer REFERENCES clients(id),
  client_nom          text NOT NULL,
  client_telephone    text,
  client_email        text,
  description         text,
  consignes           text,
  specs               jsonb NOT NULL DEFAULT '{"lignes":[],"forfaits":[]}'::jsonb,
  -- Montant TTC à encaisser, en FCFA. NULL tant qu'il n'est pas connu.
  montant             integer CHECK (montant IS NULL OR montant >= 0),
  montant_source      text CHECK (montant_source IN ('calcul','saisi','devis','import')),
  detail_prix         jsonb,
  mode_paiement_prevu text CHECK (mode_paiement_prevu IN ('especes','wave','orange_money','virement','cheque','carte')),
  urgent              boolean NOT NULL DEFAULT false,
  date_promise        date,
  preparateur_id      integer REFERENCES users(id),
  imprimeur_id        integer REFERENCES users(id),
  livreur_id          integer REFERENCES users(id),
  commentaire_revision text,
  date_validation     timestamptz,
  date_debut_impression timestamptz,
  date_fin_impression timestamptz,
  livraison_prevue_at timestamptz,
  adresse_livraison   text,
  notes_livraison     text,
  livre_at            timestamptz,
  termine_at          timestamptz,
  devis_id            integer,
  legacy_id           integer UNIQUE,
  legacy_folder_id    uuid,
  deleted_at          timestamptz,
  deleted_by          integer REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dossiers_statut ON dossiers (statut) WHERE deleted_at IS NULL;
CREATE INDEX dossiers_machine_statut ON dossiers (machine, statut) WHERE deleted_at IS NULL;
CREATE INDEX dossiers_preparateur ON dossiers (preparateur_id);
CREATE INDEX dossiers_client ON dossiers (client_id);
CREATE INDEX dossiers_created ON dossiers (created_at DESC);
CREATE INDEX dossiers_recherche ON dossiers USING gin ((lower(client_nom || ' ' || numero || ' ' || coalesce(description,''))) gin_trgm_ops);

-- Historique et journal d'un dossier --------------------------------------
CREATE TABLE dossier_events (
  id          bigserial PRIMARY KEY,
  dossier_id  integer NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('creation','statut','modification','fichier','paiement','commentaire','livraison','urgence','affectation','suppression','restauration','import')),
  action      text,
  de_statut   text,
  vers_statut text,
  user_id     integer REFERENCES users(id),
  commentaire text,
  data        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dossier_events_dossier ON dossier_events (dossier_id, created_at DESC);

-- Fichiers d'impression ---------------------------------------------------
CREATE TABLE fichiers (
  id            serial PRIMARY KEY,
  dossier_id    integer NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  nom_original  text NOT NULL,
  -- Chemin relatif sous le répertoire de stockage (jamais absolu).
  chemin        text NOT NULL,
  mime          text,
  taille        bigint NOT NULL CHECK (taille >= 0),
  sha256        text,
  a_reimprimer  boolean NOT NULL DEFAULT false,
  uploaded_by   integer REFERENCES users(id),
  legacy_id     integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  deleted_by    integer REFERENCES users(id)
);
CREATE INDEX fichiers_dossier ON fichiers (dossier_id) WHERE deleted_at IS NULL;

-- Devis -----------------------------------------------------------------
CREATE TABLE devis (
  id            serial PRIMARY KEY,
  numero        text NOT NULL UNIQUE,
  statut        text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','envoye','accepte','refuse','converti')),
  machine       text NOT NULL CHECK (machine IN ('roland','xerox')),
  client_id     integer REFERENCES clients(id),
  client_nom    text NOT NULL,
  client_telephone text,
  client_email  text,
  description   text,
  specs         jsonb NOT NULL,
  detail_prix   jsonb,
  total_ht      integer NOT NULL DEFAULT 0,
  tva           integer NOT NULL DEFAULT 0,
  total_ttc     integer NOT NULL DEFAULT 0,
  validite_jours integer NOT NULL DEFAULT 15,
  notes         text,
  dossier_id    integer UNIQUE REFERENCES dossiers(id),
  created_by    integer REFERENCES users(id),
  legacy_id     integer UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dossiers ADD CONSTRAINT dossiers_devis_fk FOREIGN KEY (devis_id) REFERENCES devis(id);

-- Factures ----------------------------------------------------------------
CREATE TABLE factures (
  id            serial PRIMARY KEY,
  numero        text NOT NULL UNIQUE,
  statut        text NOT NULL DEFAULT 'emise' CHECK (statut IN ('emise','annulee')),
  dossier_id    integer NOT NULL REFERENCES dossiers(id),
  client_id     integer REFERENCES clients(id),
  client_nom    text NOT NULL,
  client_telephone text,
  client_adresse text,
  lignes        jsonb NOT NULL,
  total_ht      integer NOT NULL,
  tva_taux      numeric(5,2) NOT NULL DEFAULT 0,
  tva           integer NOT NULL,
  total_ttc     integer NOT NULL CHECK (total_ttc >= 0),
  date_emission date NOT NULL DEFAULT current_date,
  annulee_at    timestamptz,
  annulee_par   integer REFERENCES users(id),
  motif_annulation text,
  created_by    integer REFERENCES users(id),
  legacy_id     integer UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Une seule facture valide par dossier.
CREATE UNIQUE INDEX factures_une_par_dossier ON factures (dossier_id) WHERE statut = 'emise';

-- Paiements -------------------------------------------------------------
CREATE TABLE paiements (
  id            serial PRIMARY KEY,
  dossier_id    integer NOT NULL REFERENCES dossiers(id),
  montant       integer NOT NULL CHECK (montant > 0),
  mode          text NOT NULL CHECK (mode IN ('especes','wave','orange_money','virement','cheque','carte')),
  reference     text,
  statut        text NOT NULL DEFAULT 'a_valider' CHECK (statut IN ('a_valider','valide','refuse')),
  notes         text,
  encaisse_par  integer REFERENCES users(id),
  encaisse_at   timestamptz NOT NULL DEFAULT now(),
  valide_par    integer REFERENCES users(id),
  valide_at     timestamptz,
  motif_refus   text,
  legacy_id     integer UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paiements_dossier ON paiements (dossier_id);
CREATE INDEX paiements_statut ON paiements (statut, encaisse_at DESC);

-- Notifications ---------------------------------------------------------
CREATE TABLE notifications (
  id          bigserial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  titre       text NOT NULL,
  message     text,
  dossier_id  integer REFERENCES dossiers(id) ON DELETE CASCADE,
  lu_at       timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);

-- Journal d'audit (actions sensibles) ------------------------------------
CREATE TABLE journal (
  id          bigserial PRIMARY KEY,
  user_id     integer REFERENCES users(id),
  action      text NOT NULL,
  cible       text,
  cible_id    text,
  data        jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_created ON journal (created_at DESC);

-- Sauvegardes (écrites par le script de sauvegarde) ----------------------
CREATE TABLE sauvegardes (
  id          serial PRIMARY KEY,
  ok          boolean NOT NULL,
  fichier     text,
  taille      bigint,
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- updated_at automatique -------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER clients_touch BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tarifs_touch BEFORE UPDATE ON tarifs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER dossiers_touch BEFORE UPDATE ON dossiers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER devis_touch BEFORE UPDATE ON devis FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
