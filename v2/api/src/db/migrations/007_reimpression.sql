-- Réimpression / duplication d'un dossier : le nouveau dossier garde le lien vers son original.
-- Mode de remise choisi par le préparateur : livraison par le livreur, ou retrait sur place par le client.
ALTER TABLE dossiers
  ADD COLUMN origine_id integer REFERENCES dossiers(id),
  ADD COLUMN origine_type text CHECK (origine_type IN ('reimpression', 'nouvelle_commande')),
  ADD COLUMN mode_remise text NOT NULL DEFAULT 'livraison' CHECK (mode_remise IN ('livraison', 'retrait'));
ALTER TABLE dossiers ADD CONSTRAINT dossiers_origine_coherente CHECK ((origine_id IS NULL) = (origine_type IS NULL));
CREATE INDEX dossiers_origine ON dossiers (origine_id) WHERE origine_id IS NOT NULL;

-- Origines du montant : repris d'un dossier réimprimé, ou offert (réimpression à nos frais).
ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_montant_source_check;
ALTER TABLE dossiers ADD CONSTRAINT dossiers_montant_source_check CHECK (montant_source IN ('calcul','saisi','devis','import','reprise','gratuit'));

-- Historique : événement « réimpression » sur le dossier d'origine.
ALTER TABLE dossier_events DROP CONSTRAINT IF EXISTS dossier_events_type_check;
ALTER TABLE dossier_events ADD CONSTRAINT dossier_events_type_check
  CHECK (type IN ('creation','statut','modification','fichier','paiement','commentaire','livraison','urgence','affectation','suppression','restauration','import','reimpression'));
