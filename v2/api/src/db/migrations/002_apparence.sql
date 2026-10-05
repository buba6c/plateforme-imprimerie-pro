-- Préférences d'affichage de chaque utilisateur (mode clair/sombre, palette, contraste).
-- L'apparence par défaut de l'entreprise est dans parametres (clé « apparence »).
CREATE TABLE preferences_utilisateur (
  user_id     integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme       text NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  palette     text CHECK (palette IN ('evocom','sobre','perso')),
  contraste   text NOT NULL DEFAULT 'normal' CHECK (contraste IN ('normal','eleve')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
