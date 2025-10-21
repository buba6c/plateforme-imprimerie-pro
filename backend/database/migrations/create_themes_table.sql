-- Migration: Création de la table themes pour la gestion des thèmes personnalisés
-- Date: 2025-10-09
-- Description: Permet aux admins de créer et gérer des thèmes custom

-- Table principale des thèmes
CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  colors JSONB NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name);
CREATE INDEX IF NOT EXISTS idx_themes_custom ON themes(is_custom);
CREATE INDEX IF NOT EXISTS idx_themes_active ON themes(is_active);
CREATE INDEX IF NOT EXISTS idx_themes_created_by ON themes(created_by);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_themes_updated_at ON themes;
CREATE TRIGGER trigger_update_themes_updated_at
  BEFORE UPDATE ON themes
  FOR EACH ROW
  EXECUTE FUNCTION update_themes_updated_at();

-- Insertion des thèmes par défaut
INSERT INTO themes (name, display_name, colors, is_custom, created_by) VALUES
(
  'light',
  'Clair (Par défaut)',
  '{
    "primary": "#007bff",
    "secondary": "#6c757d",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "error": "#ef4444",
    "background": "#ffffff",
    "surface": "#f9fafb",
    "text": "#1f2937",
    "textSecondary": "#6b7280",
    "border": "#e5e7eb"
  }'::jsonb,
  false,
  NULL
),
(
  'dark',
  'Sombre (Par défaut)',
  '{
    "primary": "#3b82f6",
    "secondary": "#8b92a5",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "error": "#ef4444",
    "background": "#111827",
    "surface": "#1f2937",
    "text": "#f9fafb",
    "textSecondary": "#d1d5db",
    "border": "#374151"
  }'::jsonb,
  false,
  NULL
)
ON CONFLICT (name) DO NOTHING;

-- Commentaires pour la documentation
COMMENT ON TABLE themes IS 'Table de gestion des thèmes personnalisés de la plateforme';
COMMENT ON COLUMN themes.name IS 'Nom technique du thème (utilisé dans le code)';
COMMENT ON COLUMN themes.display_name IS 'Nom affiché à l''utilisateur';
COMMENT ON COLUMN themes.colors IS 'Objet JSON contenant toutes les couleurs du thème';
COMMENT ON COLUMN themes.is_custom IS 'false pour les thèmes par défaut, true pour les thèmes créés par les admins';
COMMENT ON COLUMN themes.is_active IS 'Permet de désactiver un thème sans le supprimer';
COMMENT ON COLUMN themes.created_by IS 'ID de l''admin qui a créé le thème (NULL pour thèmes par défaut)';

-- Table pour stocker les préférences de thème par utilisateur
CREATE TABLE IF NOT EXISTS user_theme_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_theme_user_id ON user_theme_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_theme_theme_name ON user_theme_preferences(theme_name);

-- Trigger pour updated_at
CREATE TRIGGER trigger_update_user_theme_preferences_updated_at
  BEFORE UPDATE ON user_theme_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_themes_updated_at();

COMMENT ON TABLE user_theme_preferences IS 'Préférences de thème par utilisateur';

-- Données de test (optionnel, à commenter en production)
-- INSERT INTO themes (name, display_name, colors, is_custom, created_by) VALUES
-- (
--   'ocean',
--   'Océan',
--   '{
--     "primary": "#0077be",
--     "secondary": "#00a9e0",
--     "success": "#06d6a0",
--     "warning": "#ffd166",
--     "error": "#ef476f",
--     "background": "#001f3f",
--     "surface": "#003459",
--     "text": "#e8f4f8",
--     "textSecondary": "#a0c4d0",
--     "border": "#004d73"
--   }'::jsonb,
--   true,
--   1
-- );

-- Vérification
SELECT 'Migration themes terminée avec succès!' as status;
SELECT COUNT(*) as nb_themes_created FROM themes;
