-- Garde IA : plafonds de consommation de l'assistant (jetons par jour et par mois, appels par jour et par
-- personne), seuil d'alerte aux administrateurs. Une seule ligne. Compatible PostgreSQL 14.
CREATE TABLE IF NOT EXISTS ia_garde (
  id                      smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active                  boolean NOT NULL DEFAULT true,
  jetons_jour             integer NOT NULL DEFAULT 200000 CHECK (jetons_jour >= 0),
  jetons_mois             integer NOT NULL DEFAULT 3000000 CHECK (jetons_mois >= 0),
  appels_jour             integer NOT NULL DEFAULT 300 CHECK (appels_jour >= 0),
  appels_utilisateur_jour integer NOT NULL DEFAULT 60 CHECK (appels_utilisateur_jour >= 0),
  alerte_pct              smallint NOT NULL DEFAULT 80 CHECK (alerte_pct BETWEEN 10 AND 100),
  /** Dernière alerte envoyée (pour n'alerter qu'une fois par jour et par mois). */
  alerte_jour_le          date,
  alerte_mois_le          date,
  updated_by              integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ia_garde (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS ia_usage_jour ON ia_usage (created_at, user_id);
