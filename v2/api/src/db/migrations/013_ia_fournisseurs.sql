-- Assistant IA : deux fournisseurs (OpenAI et Google Gemini), chacun avec sa clé chiffrée et son
-- modèle ; un fournisseur actif, et un secours automatique vers l'autre si le premier échoue.
-- Le journal d'usage garde le fournisseur réellement utilisé et l'erreur rencontrée (sans la clé).

ALTER TABLE ia_config
  ADD COLUMN fournisseur         text NOT NULL DEFAULT 'openai' CHECK (fournisseur IN ('openai', 'gemini')),
  ADD COLUMN modele_gemini       text NOT NULL DEFAULT 'gemini-2.5-flash',
  ADD COLUMN cle_gemini_chiffree text,
  ADD COLUMN cle_gemini_fin      text CHECK (cle_gemini_fin IS NULL OR length(cle_gemini_fin) <= 4),
  ADD COLUMN secours             boolean NOT NULL DEFAULT true;

ALTER TABLE ia_usage
  ADD COLUMN fournisseur text,
  ADD COLUMN secours     boolean NOT NULL DEFAULT false,
  ADD COLUMN erreur      text CHECK (erreur IS NULL OR length(erreur) <= 300);
