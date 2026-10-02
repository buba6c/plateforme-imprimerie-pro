-- =============================================================================
-- EvocomPrint (legacy) : cas limites supplémentaires pour l'importeur v2.
-- À charger APRÈS legacy_schema.sql puis legacy_seed.sql (même base).
-- Fichiers associés : uploads/ et backend/uploads/ (seconde racine, comme sur le VPS :
-- /var/www/imprimerie/uploads et /var/www/imprimerie/backend/uploads).
--
--   * utilisateurs : doublon d'e-mail à la casse près (6 → fusionné dans 2), compte de démo
--     admin@imprimerie.com (7), mot de passe non bcrypt (8) ;
--   * dossiers : contrainte UNIQUE sur numero perdue (fix-all-issues.sql) → numéro en double (27) ;
--     statut inconnu « Annulé » (26), statut « pret livraison » avec espace (27) ;
--     machine absente mais déductible (26), contradictoire (27), introuvable (28) ;
--     montants « 12 500,50 FCFA » (26), « à définir » (27), 15000.40 (28) ; client vide (27) ;
--   * fichiers : seconde racine backend/uploads (12), retrouvé seulement par son nom (13),
--     nom ambigu présent deux fois sur le disque (14), empreinte et taille différentes (15) ;
--     orphelin PDF de facture dans backend/uploads/factures ;
--   * paiements : montant nul, centimes, trop-perçu, dossier inexistant, statut et mode inconnus ;
--   * factures : dossier introuvable, seconde facture émise pour un même dossier ;
--   * tarifs : unité et catégorie inconnues ; journal : détails qui ne sont pas du JSON.
-- =============================================================================

SET client_min_messages = warning;
BEGIN;

-- Utilisateurs (mot de passe 6 : Test1234! ; 7 : admin123)
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (6, 'Moussa Ndiaye (ancien compte)', 'Preparateur@Evocom.test', '$2b$10$X.cNcKCCmt5DkpsUoDe6COeoylDdh5cMRSu0iE8VYO13sufNngEKu', 'preparateur', FALSE, '2025-09-15 08:00:00', '2025-09-30 08:00:00', '2025-09-20 08:00:00', NULL);
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (7, 'Administrateur', 'admin@imprimerie.com', '$2b$10$c2PS9M4xOUCLOD2VNXlYu.XHO0zTt9.MJR5KLQSsOWSqwFmoULH5O', 'admin', TRUE, '2025-09-01 08:00:00', '2025-09-01 08:00:00', NULL, NULL);
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (8, 'Stagiaire Livraison', 'stagiaire@evocom.test', 'pbkdf2_sha256$260000$abc$def', 'livreur', FALSE, '2026-02-01 08:00:00', '2026-02-01 08:00:00', NULL, NULL);

-- La contrainte UNIQUE de numero a été perdue en production (fix-all-issues.sql:95) ;
-- la contrainte de statut est retirée le temps de l'insertion puis reposée en NOT VALID.
ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_numero_key;
ALTER TABLE dossiers DROP CONSTRAINT dossiers_statut_check;

INSERT INTO dossiers (id, numero, client, type_formulaire, machine, statut, preparateur_id, data_formulaire, folder_id, description, created_at, updated_at, date_reception)
  VALUES (26, 'CMD-2026-0023', 'Studio Graphik', NULL, NULL, 'Annulé', 6, '{"type_document":"Carte de visite","format":"85x55","nombre_exemplaires":"500","prix":"12 500,50 FCFA"}'::jsonb, '5f0c1e2a-0d26-4a1b-9c2d-000000000026', 'Cartes de visite annulées par le client', '2026-09-30 10:00:00', '2026-09-30 12:00:00', '2026-09-30');
INSERT INTO dossiers (id, numero, client, type_formulaire, machine, statut, preparateur_id, data_formulaire, montant_cfa, folder_id, created_at, updated_at, date_reception)
  VALUES (27, 'CMD-2026-0011', '   ', 'Roland', 'Xerox', 'pret livraison', 2, '{"type_support":"Bâche","largeur":"200","hauteur":"100","unite":"cm","nombre_exemplaires":"1","prix":"à définir"}'::jsonb, 0, '5f0c1e2a-0d27-4a1b-9c2d-000000000027', '2026-09-29 11:00:00', '2026-09-30 09:00:00', '2026-09-29');
INSERT INTO dossiers (id, numero, client, type_formulaire, machine, statut, preparateur_id, data_formulaire, montant_cfa, urgent, date_livraison_reelle, folder_id, created_at, updated_at, date_reception)
  VALUES (28, 'CMD-2026-0024', 'Garage Sall', NULL, NULL, 'livre', 2, '{}'::jsonb, 15000.40, TRUE, '2026-09-20', '5f0c1e2a-0d28-4a1b-9c2d-000000000028', '2026-09-15 08:00:00', '2026-09-20 17:30:00', '2026-09-15');

ALTER TABLE dossiers ADD CONSTRAINT dossiers_statut_check CHECK (statut IN (
    'en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'imprime',
    'pret_livraison', 'en_livraison', 'livre', 'termine',
    'En cours', 'À revoir', 'Prêt impression', 'En impression', 'Imprimé',
    'Prêt livraison', 'En livraison', 'Livré', 'Terminé'
)) NOT VALID;

-- Fichiers
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (12, 26, 'Maquette finale.pdf', '1769000000000_maquette_finale.pdf', 'application/pdf', 1384, 'uploads/dossiers/26/1769000000000_maquette_finale.pdf', 6, '2026-09-30 10:10:00', '2026-09-30 10:10:00');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (13, 27, 'logo HD.png', '1769100000000_logo_HD.png', 'image/png', 1488, NULL, 2, '2026-09-29 11:05:00', '2026-09-29 11:05:00');
INSERT INTO fichiers (id, dossier_id, nom, chemin, type, taille, mime_type, extension, uploaded_by, created_at, uploaded_at)
  VALUES (14, 28, 'plan.pdf', 'uploads/28/plan.pdf', 'document', 700, 'application/pdf', '.pdf', 2, '2026-09-15 08:05:00', '2026-09-15 08:05:00');
INSERT INTO fichiers (id, dossier_id, nom, chemin, type, taille, mime_type, extension, checksum, uploaded_by, created_at, uploaded_at)
  VALUES (15, 26, 'Bon à tirer.pdf', 'uploads/26/1769200000000_bon_a_tirer.pdf', 'document', 999, 'application/pdf', '.pdf', '0000000000000000000000000000000000000000000000000000000000000000', 2, '2026-09-30 10:20:00', '2026-09-30 10:20:00');

-- Historique et journal
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (26, 'en_cours', 'Annulé', 1, 'Annulation demandée par le client', '2026-09-30 12:00:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (28, 'en_livraison', 'Livré', 5, NULL, '2026-09-20 17:30:00');
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('26', 6, 'updated', 'not json {description modifiée}', '2026-09-30 10:30:00');

-- Paiements
INSERT INTO paiements (dossier_id, user_id, montant, mode_paiement, type, statut, created_at, updated_at)
  VALUES (26, 2, 0, 'especes', 'dossier', 'en_attente', '2026-09-30 11:00:00', '2026-09-30 11:00:00');
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, reference_paiement, type, statut, date_encaissement, date_approbation, approuve_par, created_at, updated_at)
  VALUES (25, 2, NULL, 45000.40, 'cb', 'TPE-778812', 'dossier', 'approuve', '2026-09-27 10:00:00', '2026-09-27 18:00:00', 1, '2026-09-27 10:00:00', '2026-09-27 18:00:00');
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, reference_paiement, type, statut, date_encaissement, date_approbation, approuve_par, created_at, updated_at)
  VALUES (2, 2, 5, 10000, 'Wave', 'WAVE-TX-11002', 'dossier', 'approuve', '2025-10-06 16:25:00', '2025-10-07 09:05:00', 1, '2025-10-06 16:25:00', '2025-10-07 09:05:00');
INSERT INTO paiements (dossier_id, user_id, montant, mode_paiement, type, statut, created_at, updated_at)
  VALUES (999, 2, 20000, 'especes', 'dossier', 'approuve', '2026-07-01 10:00:00', '2026-07-01 10:00:00');
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, type, statut, date_encaissement, created_at, updated_at)
  VALUES (28, 2, 5, 15000, 'Free Money', 'dossier', 'a_creer', '2026-09-20 17:35:00', '2026-09-20 17:35:00', '2026-09-20 17:35:00');

-- Factures
INSERT INTO factures (id, numero, dossier_id, user_id, montant_ht, montant_tva, montant_ttc, client_nom, mode_paiement, statut_paiement, created_at, updated_at)
  VALUES (3, 'FAC-2026-002', 'pas-un-dossier', 2, 8474.58, 1525.42, 10000, 'Client disparu', 'especes', 'non_paye', '2026-09-10 10:00:00', '2026-09-10 10:00:00');
INSERT INTO factures (id, numero, dossier_id, user_id, montant_ht, montant_tva, montant_ttc, client_nom, client_contact, mode_paiement, statut_paiement, created_at, updated_at)
  VALUES (4, 'FAC-2026-003', '5f0c1e2a-0d23-4a1b-9c2d-000000000023', 2, 27118.64, 4881.36, 32000, 'Traiteur Saveurs', '+221 77 444 55 66', 'cheque', 'non_paye', '2026-09-06 10:00:00', '2026-09-06 10:00:00');

-- Tarifs saisis à la main
INSERT INTO tarifs_config (type_machine, categorie, cle, label, valeur, unite, description, actif) VALUES
  ('xerox', 'finition', 'agrafage_coin', 'Agrafage en coin', 25.00, 'agrafe', 'Une agrafe en coin', TRUE),
  ('global', 'service', 'pose_vitrine', 'Pose en vitrine', 7500.00, 'forfait', 'Pose de vitrophanie', TRUE);

DO $$
BEGIN
  PERFORM setval('users_id_seq', (SELECT MAX(id) FROM users));
  PERFORM setval('dossiers_id_seq', (SELECT MAX(id) FROM dossiers));
  PERFORM setval('fichiers_id_seq', (SELECT MAX(id) FROM fichiers));
  PERFORM setval('factures_id_seq', (SELECT MAX(id) FROM factures));
END $$;

COMMIT;
