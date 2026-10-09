-- WhatsApp client : messages automatiques envoyés au client depuis le numéro dédié de l'imprimerie
-- (module api/src/modules/whatsapp). Les réglages sont dans la table parametres, section « whatsapp ».

-- File et journal des messages sortants : une seule ligne par (dossier, événement).
CREATE TABLE whatsapp_messages (
  id           bigserial PRIMARY KEY,
  dossier_id   integer REFERENCES dossiers(id) ON DELETE CASCADE,
  -- pret_livraison, pret_retrait, en_livraison, livre, test
  evenement    text NOT NULL,
  -- Numéro au format international (+221771234567) ; tel que saisi s'il est invalide.
  telephone    text,
  texte        text NOT NULL,
  statut       text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','envoye','echec','annule','ignore')),
  -- Pourquoi le message a échoué, été annulé ou ignoré, en clair.
  motif        text,
  tentatives   integer NOT NULL DEFAULT 0,
  planifie_at  timestamptz NOT NULL DEFAULT now(),
  envoye_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, evenement)
);
CREATE INDEX whatsapp_messages_file ON whatsapp_messages (planifie_at) WHERE statut = 'en_attente';
CREATE INDEX whatsapp_messages_envoyes ON whatsapp_messages (envoye_at) WHERE envoye_at IS NOT NULL;
CREATE INDEX whatsapp_messages_telephone ON whatsapp_messages (telephone);
CREATE INDEX whatsapp_messages_recents ON whatsapp_messages (created_at DESC);

-- Numéros qui ont demandé à ne plus recevoir de messages (STOP) ou retirés par l'administrateur.
CREATE TABLE whatsapp_optout (
  telephone   text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  motif       text
);

-- Réponses reçues sur le numéro dédié (texte seulement, 500 caractères au plus).
CREATE TABLE whatsapp_entrants (
  id          bigserial PRIMARY KEY,
  telephone   text NOT NULL,
  texte       text NOT NULL,
  recu_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_entrants_recents ON whatsapp_entrants (recu_at DESC);
