-- Assistant IA : troisième fournisseur, OpenRouter (une clé pour les modèles OpenAI, Google, Anthropic,
-- Mistral, DeepSeek…). Même principe que Gemini : clé chiffrée, 4 derniers caractères, modèle libre
-- (identifiant « éditeur/modèle »). Compatible PostgreSQL 14.

ALTER TABLE ia_config
  ADD COLUMN IF NOT EXISTS modele_openrouter       text NOT NULL DEFAULT 'openai/gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS cle_openrouter_chiffree text,
  ADD COLUMN IF NOT EXISTS cle_openrouter_fin      text CHECK (cle_openrouter_fin IS NULL OR length(cle_openrouter_fin) <= 4);

ALTER TABLE ia_config DROP CONSTRAINT IF EXISTS ia_config_fournisseur_check;
ALTER TABLE ia_config ADD CONSTRAINT ia_config_fournisseur_check CHECK (fournisseur IN ('openai', 'gemini', 'openrouter'));
