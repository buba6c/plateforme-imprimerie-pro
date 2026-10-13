-- Devis : mode de règlement et date limite de règlement, imprimés en tête du devis comme sur les
-- documents de l'entreprise (« Mode de règlement : Chèque », « Date limite de règlement : À la commande »).
ALTER TABLE devis
  ADD COLUMN mode_reglement text CHECK (mode_reglement IS NULL OR mode_reglement IN ('especes', 'wave', 'orange_money', 'virement', 'cheque', 'carte')),
  ADD COLUMN echeance_reglement text;
