-- Planning et historique des livraisons (module livraisons).

-- Planning : livraisons en cours, cherchées par date prévue.
CREATE INDEX IF NOT EXISTS dossiers_livraison_prevue ON dossiers (livraison_prevue_at)
  WHERE deleted_at IS NULL AND statut = 'en_livraison';

-- Historique : livraisons effectuées d'un livreur, les plus récentes d'abord.
CREATE INDEX IF NOT EXISTS dossiers_livreur_livre ON dossiers (livreur_id, livre_at DESC)
  WHERE deleted_at IS NULL AND livre_at IS NOT NULL;
