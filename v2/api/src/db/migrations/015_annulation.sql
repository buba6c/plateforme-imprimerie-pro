-- Statut « annulé » : un dossier annulé n'est pas supprimé, il reste dans les listes (onglet Annulés),
-- avec son historique, ses fichiers et ses paiements. annule_at dit quand ; le motif est dans l'historique.
-- Il peut être repris (action « reprendre » → en préparation). Compatible PostgreSQL 14.

ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS annule_at timestamptz;

ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_statut_check;
ALTER TABLE dossiers
  ADD CONSTRAINT dossiers_statut_check
  CHECK (statut IN ('en_cours','a_revoir','pret_impression','en_impression','pret_livraison','en_livraison','livre','termine','annule'));

-- Cohérence : annule_at renseigné si et seulement si le dossier est annulé.
ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_annule_coherent;
ALTER TABLE dossiers
  ADD CONSTRAINT dossiers_annule_coherent CHECK ((statut = 'annule') = (annule_at IS NOT NULL));
