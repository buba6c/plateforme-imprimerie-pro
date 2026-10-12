-- WhatsApp client : journal des événements de connexion (code QR, connecté, fermée, perdue, déconnecté,
-- échec, reprise), pour que l'administrateur voie ce qui s'est passé et quand la reconnexion est prévue.
CREATE TABLE whatsapp_connexions (
  id                      bigserial PRIMARY KEY,
  type                    text NOT NULL CHECK (type IN ('qr','connecte','fermee','perdue','deconnecte','echec','indisponible','reprise')),
  code                    integer,
  motif                   text CHECK (motif IS NULL OR length(motif) <= 300),
  numero                  text,
  prochaine_tentative_at  timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_connexions_recents ON whatsapp_connexions (created_at DESC);
