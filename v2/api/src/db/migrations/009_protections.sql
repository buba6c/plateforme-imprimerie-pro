-- Factures immuables : jamais supprimées ; une facture émise ne peut que passer à « annulée »
-- (avec date, auteur et motif). Les vidages complets (TRUNCATE de l'import et de la réinitialisation)
-- ne déclenchent pas ces règles ligne à ligne.
CREATE OR REPLACE FUNCTION factures_immuables() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une facture ne se supprime pas : annulez-la.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.statut = 'annulee' THEN
    RAISE EXCEPTION 'Une facture annulée ne se modifie plus.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.statut <> 'annulee'
     OR (to_jsonb(NEW) - ARRAY['statut','annulee_at','annulee_par','motif_annulation']) <> (to_jsonb(OLD) - ARRAY['statut','annulee_at','annulee_par','motif_annulation']) THEN
    RAISE EXCEPTION 'Une facture émise ne peut qu''être annulée.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS factures_immuables ON factures;
CREATE TRIGGER factures_immuables BEFORE UPDATE OR DELETE ON factures FOR EACH ROW EXECUTE FUNCTION factures_immuables();
