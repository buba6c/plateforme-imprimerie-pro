-- =============================================================================
-- EvocomPrint (legacy) : jeu de données de test « réaliste et sale »
-- À charger APRÈS legacy_schema.sql (même base).
-- Mot de passe de tous les comptes : Test1234!  (hash bcrypt $2a$, coût 10/12)
--   admin@evocom.test (admin)            preparateur@evocom.test (preparateur)
--   roland@evocom.test (imprimeur_roland) xerox@evocom.test (imprimeur_xerox)
--   livreur@evocom.test (livreur)
--
-- Particularités volontaires (pour l'importeur) :
--   * statuts dans les DEUX vocabulaires (lignes 1-9 en libellés français, 11-25
--     en snake_case) + 'nouveau' (ligne 10, antérieure à la contrainte CHECK
--     reposée en NOT VALID) ;
--   * type_formulaire 'roland' / 'Roland' / 'xerox' / 'Xerox' ; machine NULL sauf 3 ;
--   * montants dans montant_cfa et/ou amount et/ou data_formulaire.prix|prix_total|montant
--     (chaînes '15000.00', '42 000'…) ; data_formulaire double-encodé (ligne 24) ;
--   * folder_id NULL (lignes 10 et 24) ; numéros DOSS-001 / CMD-AAAA-NNNN /
--     CMD-AAAA-NNNNNN (repli) / DOS-AAAA-NNNNNN (conversion devis) ;
--   * clients en variantes de casse/espaces ('Boulangerie Ndiaye & fils ', 'pharmacie mermoz') ;
--   * fichiers : famille init (chemin_stockage) et famille nom/chemin ; chemin
--     absolu (fichier 6) ; chemin incohérent uploads/<id>/… alors que le disque a
--     uploads/dossiers/<folder_id>/… (fichiers 9, 10) ; nom en mojibake (10) ;
--     nom accentué sur disque (2 : affiche_été_€.pdf) ;
--     ABSENTS du disque : fichiers 4, 8, 11 ;
--     orphelins disque sans ligne : uploads/dossiers/13/1765000000000_orphelin_sans_ligne.pdf,
--     uploads/temp-chunks/chunk_1767000000000_ab12cd ;
--   * historique réparti entre historique_statuts et dossier_status_history
--     (old_status brut, new_status en libellé français) ;
--   * dossier_activity_log.dossier_id : id entier, folder_id UUID (file_deleted),
--     dossier supprimé (99) ;
--   * factures.dossier_id : UUID (facture 1) ou id entier en texte (facture 2) ;
--   * paiements : approuve / encaisse_livreur / refuse / en_attente (lié à une facture) ;
--   * tarifs_config.prix_unitaire modifié par l'admin sans effet sur valeur (bache_m2).
-- =============================================================================

SET client_min_messages = warning;
BEGIN;

-- users
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (1, 'Awa Diop', 'admin@evocom.test', '$2a$12$VG7l5t8TpQZbXTtCXeTBqOKaMUyKsGWpXYW7v7G.IERtr2z3UEmjq', 'admin', TRUE, '2025-10-01 09:00:00', '2025-10-01 09:00:00', '2026-09-30 08:12:44', 'Awa');
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (2, 'Moussa Ndiaye', 'preparateur@evocom.test', '$2a$10$sYoZ8vxqx/DpAuh1K96f/urNCPyQLOrUbv/wr086Od9ea7svt2OVS', 'preparateur', TRUE, '2025-10-01 09:05:00', '2025-10-01 09:05:00', '2026-09-30 08:40:02', 'Moussa');
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (3, 'Ibrahima Fall', 'roland@evocom.test', '$2a$10$l6UUWdk4tiYUAc/vJbRiJuBtKBi4R.ZA5oY1rxGVgMzYweZB5ltO6', 'imprimeur_roland', TRUE, '2025-10-01 09:06:00', '2025-10-01 09:06:00', NULL, NULL);
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (4, 'Fatou Sarr', 'xerox@evocom.test', '$2a$10$WtBbh8hczJYt4yO.LtCjVuN7jDZ0WcMjtNNnZ5QqrmepCh0NZxKUW', 'imprimeur_xerox', TRUE, '2025-10-02 10:00:00', '2025-10-02 10:00:00', '2026-09-29 17:55:10', 'Fatou');
INSERT INTO users (id, nom, email, password_hash, role, is_active, created_at, updated_at, last_login, prenom)
  VALUES (5, 'Cheikh Ba', 'livreur@evocom.test', '$2a$10$MsWuvbuBbscHYmNIvJe4Ou9F1yFx9PxlZZgp85s3lOXVrva6VMzVG', 'livreur', TRUE, '2025-10-03 14:20:00', '2025-10-03 14:20:00', '2026-09-30 11:02:31', NULL);

-- Lignes héritées antérieures à la contrainte de statut : on la retire le temps de l'import,
-- puis on la repose en NOT VALID (les lignes existantes ne sont pas revérifiées).
ALTER TABLE dossiers DROP CONSTRAINT dossiers_statut_check;

-- dossiers
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, folder_id, created_at, updated_at, date_reception)
  VALUES (1, 'DOSS-001', 'DOSS-001', 2, 'Client Test', 'roland', 'En cours', 2, '{"surface_m2":5,"type_impression":["bache"],"dimension":"200x250cm","finition":["oeillet_colle"]}'::jsonb, '5f0c1e2a-0d01-4a1b-9c2d-000000000001', '2025-10-01 09:30:00', '2025-10-08 18:00:00', '2025-10-01');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, mode_paiement, statut_paiement, telephone_client, folder_id, date_livraison, date_livraison_reelle, valide_preparateur, date_validation_preparateur, created_at, updated_at, date_reception)
  VALUES (2, 'CMD-2025-0001', 'CMD-2025-0001', 2, 'Boulangerie Ndiaye & Fils', 'roland', 'Livré', 2, '{"type_support":"Bâche","largeur":"300","hauteur":"100","unite":"cm","nombre_exemplaires":"1","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 45000, 'Espèces', 'paye', '+221 77 123 45 67', '5f0c1e2a-0d02-4a1b-9c2d-000000000002', '2025-10-06', '2025-10-06', TRUE, '2025-10-02 11:00:00', '2025-10-02 10:15:00', '2025-10-06 16:20:00', '2025-10-02');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, amount, mode_paiement, folder_id, created_at, updated_at, date_reception)
  VALUES (3, 'CMD-2025-0002', 'CMD-2025-0002', 2, 'SARL Teranga Print', 'xerox', 'Terminé', 2, '{"type_document":"Brochure","format":"A4","mode_impression":"recto_verso","nombre_exemplaires":"200","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"],"prix":"120000.00"}'::jsonb, 120000, 'wave', '5f0c1e2a-0d03-4a1b-9c2d-000000000003', '2025-10-03 08:45:00', '2025-10-07 12:00:00', '2025-10-03');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, commentaire, commentaire_revision, folder_id, created_at, updated_at, date_reception)
  VALUES (4, 'CMD-2025-0003', 'CMD-2025-0003', 2, 'école les Pépites', 'xerox', 'À revoir', 2, '{"type_document":"Flyer","format":"A5","mode_impression":"recto_verso","nombre_exemplaires":"500","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"]}'::jsonb, 'Fichier en RVB, merci de fournir un PDF CMJN', 'Fichier en RVB, merci de fournir un PDF CMJN', '5f0c1e2a-0d04-4a1b-9c2d-000000000004', '2025-10-04 09:00:00', '2025-10-05 10:30:00', '2025-10-04');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, machine, statut, preparateur_id, data_formulaire, montant_cfa, valide_preparateur, folder_id, created_at, updated_at, date_reception)
  VALUES (5, 'CMD-2025-0004', 'CMD-2025-0004', 1, 'Hôtel Le Lagon', 'roland', 'Roland', 'Prêt impression', 1, '{"type_support":"Vinyle","largeur":"200","hauteur":"80","unite":"cm","nombre_exemplaires":"3","finition_oeillets":"Collage","finition_position":""}'::jsonb, 46000, TRUE, '5f0c1e2a-0d05-4a1b-9c2d-000000000005', '2025-10-05 15:00:00', '2025-10-06 09:00:00', '2025-10-05');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, folder_id, created_at, updated_at, date_reception)
  VALUES (6, 'CMD-2025-0005', 'CMD-2025-0005', 2, 'Pharmacie Mermoz', 'Xerox', 'En impression', 2, '{"type_document":"Carte de visite","format":"CdV 85x55","mode_impression":"recto_verso","nombre_exemplaires":"100","couleur_impression":"couleur","grammage":"350g","finition":["Pelliculage Mat Recto","Pelliculage Mat Verso"],"faconnage":["Coupe"]}'::jsonb, '5f0c1e2a-0d06-4a1b-9c2d-000000000006', '2025-10-06 10:00:00', '2025-10-06 14:00:00', '2025-10-06');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, folder_id, created_at, updated_at, date_reception)
  VALUES (7, 'CMD-2025-0006', 'CMD-2025-0006', 2, 'Garage Sall', 'roland', 'Imprimé', 2, '{"type_support":"Bâche","largeur":"400","hauteur":"150","unite":"cm","nombre_exemplaires":"1","finition_oeillets":"Oeillet","finition_position":"Tous les côtés","prix_total":"42 000"}'::jsonb, '5f0c1e2a-0d07-4a1b-9c2d-000000000007', '2025-10-06 11:00:00', '2025-10-07 17:45:00', '2025-10-06');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, adresse_livraison, folder_id, created_at, updated_at, date_reception)
  VALUES (8, 'CMD-2025-0007', 'CMD-2025-0007', 2, 'Restaurant Chez Fatou', 'xerox', 'Prêt livraison', 2, '{"type_document":"Affiche","format":"A3","mode_impression":"recto_verso","nombre_exemplaires":"50","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"],"montant":"25000"}'::jsonb, 'Sacré-Cœur 3, villa 112, Dakar', '5f0c1e2a-0d08-4a1b-9c2d-000000000008', '2025-10-07 09:10:00', '2025-10-08 08:00:00', '2025-10-07');
INSERT INTO dossiers (id, numero, numero_commande, created_by, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, date_livraison_prevue, adresse_livraison, folder_id, created_at, updated_at, date_reception)
  VALUES (9, 'CMD-2025-0008', 'CMD-2025-0008', 2, 'Clinique Pasteur', 'roland', 'En livraison', 2, '{"type_support":"Kakemono","largeur":"85","hauteur":"200","unite":"cm","nombre_exemplaires":"2","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 30000, '2025-10-09', 'Avenue Pasteur, Dakar-Plateau', '5f0c1e2a-0d09-4a1b-9c2d-000000000009', '2025-10-07 13:00:00', '2025-10-08 16:00:00', '2025-10-07');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, folder_id, statut_paiement, created_at, updated_at, date_reception)
  VALUES (10, 'CMD-2026-0009', 'Mairie de Plateau', 'roland', 'nouveau', 2, '{"type_support":"Mesh","largeur":"600","hauteur":"300","unite":"cm","nombre_exemplaires":"1","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, NULL, NULL, '2026-01-05 10:00:00', '2026-01-05 10:00:00', '2026-01-05');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, urgent, telephone_client, amount, description, folder_id, sections, created_at, updated_at, date_reception)
  VALUES (11, 'CMD-2026-0010', 'Boulangerie Ndiaye & fils ', 'xerox', 'en_cours', 2, '{"type_document":"Brochure","format":"A4","mode_impression":"recto_verso","nombre_exemplaires":"100","couleur_impression":"couleur","grammage":"250g","finition":[],"faconnage":["Coupe"]}'::jsonb, TRUE, '771234567', 35000, 'Brochure 16 pages pour le salon', '5f0c1e2a-0d11-4a1b-9c2d-000000000011', '[{"id":"sec-1","type":"Couverture","mode_impression":"recto_verso","copies":100,"paper_types":[{"grammage":"250g","type":"Couché mat","format":"A4","couleur":"couleur","pages":4}],"finitions":["Pelliculage Mat Recto"],"faconnage":[]},{"id":"sec-2","type":"Intérieur","mode_impression":"recto_verso","copies":100,"paper_types":[{"grammage":"115g","type":"Couché brillant","format":"A4","couleur":"couleur","pages":12}],"finitions":[],"faconnage":["Piquée"]}]'::jsonb, '2026-09-28 09:00:00', '2026-09-28 09:00:00', '2026-09-28');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, telephone_client, supports, folder_id, created_at, updated_at, date_reception)
  VALUES (12, 'CMD-2026-0011', 'Auto-École Liberté', 'roland', 'en_cours', 2, '{"type_support":"Bâche","largeur":"300","hauteur":"200","unite":"cm","nombre_exemplaires":"1","finition_oeillets":"Oeillet","finition_position":"Tous les côtés","prix":"15000.00"}'::jsonb, '+221 70 555 12 34', '[{"id":"sup-1","type_support":"Vinyle","largeur":200,"hauteur":80,"unite":"cm","exemplaires":2,"finitions":["Collage"]},{"id":"sup-2","type_support":"Bâche","largeur":3,"hauteur":1,"unite":"m","exemplaires":1,"finitions":["Oeillet"]}]'::jsonb, '5f0c1e2a-0d12-4a1b-9c2d-000000000012', '2026-09-29 10:00:00', '2026-09-29 10:00:00', '2026-09-29');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, commentaire, montant_cfa, folder_id, created_at, updated_at, date_reception)
  VALUES (13, 'CMD-2026-0012', 'Hôtel Le Lagon', 'Roland', 'a_revoir', 2, '{"type_support":"Backlit","largeur":"120","hauteur":"80","unite":"cm","nombre_exemplaires":"4","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 'Résolution trop faible (72 dpi), renvoyer en 150 dpi minimum', 38000, '5f0c1e2a-0d13-4a1b-9c2d-000000000013', '2026-09-20 14:00:00', '2026-09-22 09:30:00', '2026-09-20');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, urgent, amount, telephone_client, valide_preparateur, date_validation_preparateur, folder_id, created_at, updated_at, date_reception)
  VALUES (14, 'CMD-2026-0013', 'Agence Wave Médias', 'roland', 'pret_impression', 2, '{"type_support":"Bâche","largeur":"60","hauteur":"40","unite":"cm","nombre_exemplaires":"10","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, TRUE, 52000, '+221 78 000 11 22', TRUE, '2026-09-30 15:00:00', '5f0c1e2a-0d14-4a1b-9c2d-000000000014', '2026-09-30 11:00:00', '2026-09-30 15:00:00', '2026-09-30');
INSERT INTO dossiers (id, numero, client, type_formulaire, machine, statut, preparateur_id, data_formulaire, montant_cfa, amount, quantite, client_email, valide_preparateur, date_validation_preparateur, folder_id, created_at, updated_at, date_reception)
  VALUES (15, 'CMD-2026-0014', 'Sonatel Events', 'Roland', 'Roland', 'en_impression', 2, '{"type_support":"Kakemono","largeur":"85","hauteur":"200","unite":"cm","nombre_exemplaires":"6","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 90000, 90000, 6, 'events@sonatel.test', TRUE, '2026-09-25 10:00:00', '5f0c1e2a-0d15-4a1b-9c2d-000000000015', '2026-09-24 09:00:00', '2026-09-26 08:15:00', '2026-09-24');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, amount, valide_preparateur, date_validation_preparateur, folder_id, created_at, updated_at, date_reception)
  VALUES (16, 'CMD-2026-0015', 'Lycée Blaise Diagne', 'xerox', 'pret_impression', 2, '{"type_document":"Brochure","format":"A4","mode_impression":"recto_verso","nombre_exemplaires":"300","couleur_impression":"noir_blanc","grammage":"80g","finition":[],"faconnage":["Coupe"]}'::jsonb, 60000, TRUE, '2026-09-27 16:00:00', '5f0c1e2a-0d16-4a1b-9c2d-000000000016', '2026-09-27 08:00:00', '2026-09-27 16:00:00', '2026-09-27');
INSERT INTO dossiers (id, numero, client, type_formulaire, machine, statut, preparateur_id, data_formulaire, montant_cfa, folder_id, created_at, updated_at, date_reception)
  VALUES (17, 'CMD-2026-0016', 'Imprimerie de l''Avenir', 'xerox', 'Xerox', 'en_impression', 1, '{"type_document":"Catalogue","format":"A4","mode_impression":"recto_verso","nombre_exemplaires":"50","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"]}'::jsonb, 75000, '5f0c1e2a-0d17-4a1b-9c2d-000000000017', '2026-09-15 09:00:00', '2026-09-18 10:00:00', '2026-09-15');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, amount, folder_id, created_at, updated_at, date_reception)
  VALUES (18, 'CMD-2026-0017', 'pharmacie mermoz', 'roland', 'imprime', 2, '{"type_support":"Vinyle Transparent","largeur":"100","hauteur":"100","unite":"cm","nombre_exemplaires":"2","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 19000, '5f0c1e2a-0d18-4a1b-9c2d-000000000018', '2026-09-10 09:00:00', '2026-09-12 17:00:00', '2026-09-10');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, mode_paiement, mode_paiement_final, adresse_livraison, telephone_client, folder_id, created_at, updated_at, date_reception)
  VALUES (19, 'CMD-2026-0018', 'Restaurant Chez Fatou', 'xerox', 'pret_livraison', 2, '{"type_document":"Flyer","format":"A5","mode_impression":"recto_verso","nombre_exemplaires":"1000","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"]}'::jsonb, 25000, 'Orange Money', 'a_la_livraison', 'Sacré-Cœur 3, villa 112, Dakar', '76 999 88 77', '5f0c1e2a-0d19-4a1b-9c2d-000000000019', '2026-09-21 09:00:00', '2026-09-29 18:00:00', '2026-09-21');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, urgent, date_livraison_prevue, adresse_livraison, notes_livraison, commentaire_report, derniere_relance_paiement, mode_paiement_final, folder_id, created_at, updated_at, date_reception)
  VALUES (20, 'CMD-2026-0019', 'Clinique Pasteur', 'roland', 'en_livraison', 2, '{"type_support":"Bâche","largeur":"500","hauteur":"200","unite":"cm","nombre_exemplaires":"1","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 70000, TRUE, '2026-10-03', 'Avenue Pasteur, Dakar-Plateau', 'Appeler le gardien avant d''arriver', 'Client absent, livraison reportée', '2026-09-29 10:00:00', 'a_la_livraison', '5f0c1e2a-0d20-4a1b-9c2d-000000000020', '2026-09-18 09:00:00', '2026-09-30 17:00:00', '2026-09-18');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, mode_paiement, mode_paiement_final, statut_paiement, date_livraison_reelle, urgent, folder_id, created_at, updated_at, date_reception)
  VALUES (21, 'CMD-2026-0020', 'Boutique Keur Mame', 'xerox', 'livre', 2, '{"type_document":"Flyer","format":"A5","mode_impression":"recto_verso","nombre_exemplaires":"500","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"]}'::jsonb, 18500, 'wave', 'wave', 'paye', '2026-10-01', FALSE, '5f0c1e2a-0d21-4a1b-9c2d-000000000021', '2026-09-25 09:00:00', '2026-10-01 15:00:00', '2026-09-25');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, mode_paiement, mode_paiement_final, statut_paiement, date_livraison_reelle, folder_id, created_at, updated_at, date_reception)
  VALUES (22, 'CMD-2026-0021', 'ONG Jappo', 'roland', 'livre', 2, '{"type_support":"Bâche","largeur":"300","hauteur":"100","unite":"cm","nombre_exemplaires":"3","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, 63000, 'Espèces', 'a_la_livraison', 'non_paye', '2026-09-28', '5f0c1e2a-0d22-4a1b-9c2d-000000000022', '2026-09-12 09:00:00', '2026-09-28 12:00:00', '2026-09-12');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, amount, mode_paiement, folder_id, created_at, updated_at, date_reception)
  VALUES (23, 'CMD-2026-0022', 'Traiteur Saveurs', 'xerox', 'termine', 2, '{"type_document":"Dépliant","format":"A4","mode_impression":"recto_verso","nombre_exemplaires":"250","couleur_impression":"couleur","grammage":"170g","finition":[],"faconnage":["Coupe"]}'::jsonb, 32000, 30000, 'cheque', '5f0c1e2a-0d23-4a1b-9c2d-000000000023', '2026-08-30 09:00:00', '2026-09-05 11:00:00', '2026-08-30');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, folder_id, created_at, updated_at, date_reception)
  VALUES (24, 'CMD-2026-104233', 'client inconnu', 'xerox', 'en_cours', 1, to_jsonb('{"type_document":"Flyer","format":"A6","nombre_exemplaires":"200","prix":"8000.00"}'::text), NULL, '2026-06-14 10:44:33', '2026-06-14 10:44:33', '2026-06-14');
INSERT INTO dossiers (id, numero, client, type_formulaire, statut, preparateur_id, data_formulaire, montant_cfa, folder_id, created_at, updated_at, date_reception)
  VALUES (25, 'DOS-2026-000123', 'SARL Teranga Print', 'roland', 'en_cours', 2, '{"support":"bache","largeur":300,"hauteur":200,"unite":"cm","quantite":1,"finitions":["coupage_decoupe"]}'::jsonb, 45000, '5f0c1e2a-0d25-4a1b-9c2d-000000000025', '2026-09-26 16:00:00', '2026-09-26 16:00:00', '2026-09-26');

ALTER TABLE dossiers ADD CONSTRAINT dossiers_statut_check CHECK (statut IN (
    'en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'imprime',
    'pret_livraison', 'en_livraison', 'livre', 'termine',
    'En cours', 'À revoir', 'Prêt impression', 'En impression', 'Imprimé',
    'Prêt livraison', 'En livraison', 'Livré', 'Terminé'
)) NOT VALID;

-- fichiers
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (1, 14, 'Affiche Wave 60x40.pdf', '1767600000000_Affiche_Wave_60x40.pdf', 'application/pdf', 3074, 'uploads/dossiers/14/1767600000000_Affiche_Wave_60x40.pdf', 2, '2026-09-30 11:05:00', '2026-09-30 11:05:00');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (2, 14, 'affiche_été_€.pdf', '1767600000500_affiche_été_€.pdf', 'application/pdf', 2050, 'uploads/dossiers/14/1767600000500_affiche_été_€.pdf', 2, '2026-09-30 11:05:01', '2026-09-30 11:05:01');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (3, 15, 'Kakemono Sonatel.tif', '1767700000000_Kakemono_Sonatel.tif', 'image/tiff', 4096, 'uploads/dossiers/15/1767700000000_Kakemono_Sonatel.tif', 2, '2026-09-24 09:10:00', '2026-09-24 09:10:00');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (4, 15, 'logo_sonatel_vectoriel.ai', '1767700000300_logo_sonatel_vectoriel.ai', 'application/postscript', 1843200, 'uploads/dossiers/15/1767700000300_logo_sonatel_vectoriel.ai', 2, '2026-09-24 09:10:02', '2026-09-24 09:10:02');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (5, 16, 'Bulletin trimestriel.pdf', '1767800000000_Bulletin_trimestriel.pdf', 'application/pdf', 2562, 'uploads/dossiers/16/1767800000000_Bulletin_trimestriel.pdf', 2, '2026-09-27 08:05:00', '2026-09-27 08:05:00');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (6, 2, 'bache_boulangerie.pdf', '1760000000000_bache_boulangerie.pdf', 'application/pdf', 2050, '/var/www/imprimerie/uploads/dossiers/2/1760000000000_bache_boulangerie.pdf', 2, '2025-10-02 10:20:00', '2025-10-02 10:20:00');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (7, 21, 'flyers_keur_mame.pdf', '1768500000000_flyers_keur_mame.pdf', 'application/pdf', 1538, 'uploads/dossiers/21/1768500000000_flyers_keur_mame.pdf', 2, '2026-09-25 09:05:00', '2026-09-25 09:05:00');
INSERT INTO fichiers (id, dossier_id, nom_original, nom_fichier, type_mime, taille_bytes, chemin_stockage, uploaded_by, created_at, uploaded_at)
  VALUES (8, 11, 'brochure_v1.docx', '1768100000000_brochure_v1.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 48213, 'uploads/dossiers/11/1768100000000_brochure_v1.docx', 2, '2026-09-28 09:02:00', '2026-09-28 09:02:00');
INSERT INTO fichiers (id, dossier_id, nom, chemin, type, taille, mime_type, extension, checksum, uploaded_by, created_at, uploaded_at)
  VALUES (9, 17, 'Catalogue partenaire.pdf', 'uploads/17/1768000000000_Catalogue_partenaire.pdf', 'document', 3586, 'application/pdf', '.pdf', 'e732a5b8e787a7f0e696bb2dea93bd88c4b1672647e9e7ae8e48744ceb47e18e', 1, '2026-09-15 09:20:00', '2026-09-15 09:20:00');
INSERT INTO fichiers (id, dossier_id, nom, chemin, type, taille, mime_type, extension, checksum, uploaded_by, created_at, uploaded_at)
  VALUES (10, 4, 'menu_cafÃ©_Ã©tÃ©.png', 'uploads/4/1761000000000_menu_caf_____t__.png', 'image', 2048, 'image/png', '.png', '21f2da69058e68284d7a3d9bb03e0c8435ef6dccb0008d26a6cac5143358f6cf', 2, '2025-10-04 09:15:00', '2025-10-04 09:15:00');
INSERT INTO fichiers (id, dossier_id, nom, chemin, type, taille, mime_type, extension, checksum, uploaded_by, created_at, uploaded_at)
  VALUES (11, 20, 'plan_acces.pdf', 'uploads/20/1768300000000_plan_acces.pdf', 'document', 120044, 'application/pdf', '.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 2, '2026-09-18 09:30:00', '2026-09-18 09:30:00');

-- historique_statuts (legacy)
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (2, 'En cours', 'Prêt impression', 2, NULL, '2025-10-02 11:00:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (2, 'Prêt impression', 'En impression', 3, NULL, '2025-10-03 08:00:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (2, 'En impression', 'Prêt livraison', 3, NULL, '2025-10-04 15:00:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (2, 'Prêt livraison', 'Livré', 5, 'Livré et encaissé 45000 FCFA', '2025-10-06 16:20:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (4, 'En cours', 'À revoir', 4, 'Fichier en RVB, merci de fournir un PDF CMJN', '2025-10-05 10:30:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (9, 'pret_livraison', 'En livraison', 5, NULL, '2025-10-08 16:00:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (22, 'en_livraison', 'Livré', 5, 'Livraison validée par le livreur', '2026-09-28 12:00:00');
INSERT INTO historique_statuts (dossier_id, ancien_statut, nouveau_statut, user_id, commentaire, created_at)
  VALUES (20, 'en_livraison', 'en_livraison', 5, 'Report: Client absent, livraison reportée', '2026-09-30 17:00:00');

-- dossier_status_history
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (13, 'en_cours', 'Prêt impression', 2, '2026-09-21 10:00:00', NULL);
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (13, 'pret_impression', 'À revoir', 3, '2026-09-22 09:30:00', 'Résolution trop faible (72 dpi), renvoyer en 150 dpi minimum');
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (14, 'en_cours', 'Prêt impression', 2, '2026-09-30 15:00:00', NULL);
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (15, 'en_cours', 'Prêt impression', 2, '2026-09-25 10:00:00', NULL);
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (15, 'pret_impression', 'En impression', 3, '2026-09-26 08:15:00', NULL);
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (19, 'en_impression', 'Prêt livraison', 4, '2026-09-29 18:00:00', NULL);
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (21, 'en_livraison', 'Livré', 5, '2026-10-01 15:00:00', 'Livré - Montant: 18500 FCFA');
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, comment)
  VALUES (23, 'livre', 'Terminé', 1, '2026-09-05 11:00:00', NULL);
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at, notes, folder_id)
  VALUES (18, 'en_impression', 'imprime', NULL, '2026-09-12 17:00:00', 'trigger', '5f0c1e2a-0d18-4a1b-9c2d-000000000018');

-- dossier_activity_log
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('11', 2, 'created', '{"numero":"CMD-2026-0010","client":"Boulangerie Ndiaye & fils ","type_formulaire":"xerox"}', '2026-09-28 09:00:00');
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('14', 2, 'file_uploaded', '{"files_count":2}', '2026-09-30 11:05:01');
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('14', 2, 'status_changed', '{"old_status":"en_cours","new_status":"pret_impression","commentaire":null}', '2026-09-30 15:00:00');
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('15', 1, 'updated', '{"changes":{"machine":{"old":null,"new":"Roland"},"quantite":{"old":1,"new":6}}}', '2026-09-25 09:30:00');
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('5f0c1e2a-0d17-4a1b-9c2d-000000000017', 1, 'file_deleted', '{"file_id":87,"file_name":"Catalogue partenaire v0.pdf"}', '2026-09-15 09:19:00');
INSERT INTO dossier_activity_log (dossier_id, user_id, action, details, created_at)
  VALUES ('99', 1, 'deleted', '{"numero":"CMD-2026-0005","client":"Doublon test"}', '2026-07-01 12:00:00');

-- dossier_formulaires
INSERT INTO dossier_formulaires (dossier_id, type_formulaire, details, date_saisie)
  VALUES (11, 'xerox', '{"type_document":"Brochure","format":"A4","mode_impression":"recto_verso","nombre_exemplaires":"100","couleur_impression":"couleur","grammage":"250g","finition":[],"faconnage":["Coupe"]}'::jsonb, '2026-09-28 09:00:00');
INSERT INTO dossier_formulaires (dossier_id, type_formulaire, details, date_saisie)
  VALUES (15, 'roland', '{"type_support":"Kakemono","largeur":"85","hauteur":"200","unite":"cm","nombre_exemplaires":"4","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, '2026-09-24 09:00:00');
INSERT INTO dossier_formulaires (dossier_id, type_formulaire, details, date_saisie)
  VALUES (15, 'Roland', '{"type_support":"Kakemono","largeur":"85","hauteur":"200","unite":"cm","nombre_exemplaires":"6","finition_oeillets":"Oeillet","finition_position":"Tous les côtés"}'::jsonb, '2026-09-25 09:30:00');

-- devis
INSERT INTO devis (id, numero, user_id, machine_type, data_json, prix_estime, prix_final, details_prix, client_nom, client_contact, statut, notes, created_at, updated_at, validated_at)
  VALUES (1, 'DEV-2026-001', 2, 'roland', '{"type_support":"Bâche","largeur":"300","hauteur":"200","unite":"cm","nombre_exemplaires":"1"}', 0, 45000, '{"base":0,"finitions":0,"options":0}', 'SARL Teranga Print', '+221 33 800 00 00', 'valide', 'Estimation à 0 (champs non reconnus) : prix saisi à la main', '2026-09-20 10:00:00', '2026-09-21 09:00:00', '2026-09-21 09:00:00');
INSERT INTO devis (id, numero, user_id, machine_type, data_json, prix_estime, prix_final, details_prix, client_nom, statut, converted_folder_id, dossier_id, created_at, updated_at, converted_at)
  VALUES (2, 'DEV-2026-002', 2, 'roland', '{"support":"bache","largeur":300,"hauteur":200,"unite":"cm","finitions":["coupage_decoupe"]}', 45000, 45000, '{"base":42000,"finitions":3000,"options":0}', 'SARL Teranga Print', 'converti', '5f0c1e2a-0d25-4a1b-9c2d-000000000025', 25, '2026-09-25 10:00:00', '2026-09-26 16:00:00', '2026-09-26 16:00:00');
INSERT INTO devis (id, numero, user_id, machine_type, data_json, prix_estime, client_nom, statut, created_at, updated_at)
  VALUES (3, 'DEV-2026-003', 2, 'xerox', '{"type_document":"Flyer","format":"A5","nombre_exemplaires":"1000","couleur_impression":"couleur"}', 0, 'Restaurant Chez Fatou', 'brouillon', '2026-09-29 11:00:00', '2026-09-29 11:00:00');

-- devis_historique
INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut, created_at)
  VALUES (1, 2, 'creation', 'brouillon', '2026-09-20 10:00:00');
INSERT INTO devis_historique (devis_id, user_id, action, ancien_statut, nouveau_statut, created_at)
  VALUES (1, 2, 'validation', 'brouillon', 'valide', '2026-09-21 09:00:00');
INSERT INTO devis_historique (devis_id, user_id, action, nouveau_statut, created_at)
  VALUES (2, 2, 'creation', 'brouillon', '2026-09-25 10:00:00');
INSERT INTO devis_historique (devis_id, user_id, action, ancien_statut, nouveau_statut, details_json, created_at)
  VALUES (2, 2, 'conversion', 'valide', 'converti', '{"dossier_id":25}', '2026-09-26 16:00:00');

-- factures
INSERT INTO factures (id, numero, dossier_id, user_id, montant_ht, montant_tva, montant_ttc, client_nom, client_contact, mode_paiement, statut_paiement, date_paiement, pdf_path, pdf_generated_at, created_at, updated_at)
  VALUES (1, 'FAC-2025-001', '5f0c1e2a-0d03-4a1b-9c2d-000000000003', 2, 101694.92, 18305.08, 120000, 'SARL Teranga Print', '+221 33 800 00 00', 'wave', 'paye', '2025-10-08 10:00:00', '/var/www/imprimerie/backend/uploads/factures/FAC-2025-001.pdf', '2025-10-07 12:05:00', '2025-10-07 12:00:00', '2025-10-08 10:00:00');
INSERT INTO factures (id, numero, dossier_id, user_id, montant_ht, montant_tva, montant_ttc, client_nom, mode_paiement, statut_paiement, created_at, updated_at)
  VALUES (2, 'FAC-2026-001', '23', 2, 27118.64, 4881.36, 32000, 'Traiteur Saveurs', 'cheque', 'non_paye', '2026-09-05 11:05:00', '2026-09-05 11:05:00');

-- paiements
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, mode_paiement_final, type, statut, date_encaissement, date_approbation, approuve_par, commentaire_admin, created_at, updated_at)
  VALUES (2, 2, 5, 45000, 'Espèces', 'especes', 'dossier', 'approuve', '2025-10-06 16:20:00', '2025-10-07 09:00:00', 1, 'OK caisse', '2025-10-06 16:20:00', '2025-10-07 09:00:00');
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, mode_paiement_final, reference_paiement, type, statut, date_encaissement, date_approbation, approuve_par, created_at, updated_at)
  VALUES (21, 2, 5, 18500, 'Wave', 'wave', 'WAVE-TX-88231', 'dossier', 'approuve', '2026-10-01 15:00:00', NOW() - INTERVAL '3 hours', 1, '2026-10-01 15:00:00', NOW() - INTERVAL '3 hours');
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, mode_paiement_final, notes, type, statut, date_encaissement, created_at, updated_at)
  VALUES (22, 2, 5, 63000, 'Espèces', 'especes', 'Payé en liquide à la livraison', 'dossier', 'encaisse_livreur', '2026-09-28 12:05:00', '2026-09-28 12:05:00', '2026-09-28 12:05:00');
INSERT INTO paiements (dossier_id, user_id, livreur_id, montant, mode_paiement, mode_paiement_final, reference_paiement, type, statut, date_refus, refuse_par, raison_refus, created_at, updated_at)
  VALUES (23, 2, 5, 30000, 'Orange Money', 'orange_money', 'OM-552190', 'dossier', 'refuse', '2026-09-06 09:00:00', 1, 'Montant différent du dossier (32000)', '2026-09-05 12:00:00', '2026-09-06 09:00:00');
INSERT INTO paiements (dossier_id, facture_id, user_id, montant, mode_paiement, type, statut, reference_paiement, notes, date_paiement, created_at, updated_at)
  VALUES (NULL, 2, 2, 32000, 'cheque', 'facture', 'en_attente', 'CHQ-0045871', 'Chèque à encaisser', '2026-09-06', '2026-09-06 10:00:00', '2026-09-06 10:00:00');

-- tarifs : l'écran admin a écrit prix_unitaire (sans effet sur valeur, lue par les estimateurs)
UPDATE tarifs_config SET prix_unitaire = 7500.00, updated_at = '2026-09-01 10:00:00' WHERE cle = 'bache_m2';

-- thèmes / préférences / config
INSERT INTO themes (name, display_name, colors, is_custom, created_by) VALUES
('ocean', 'Océan', '{"primary":"#0077be","secondary":"#00a9e0","success":"#06d6a0","warning":"#ffd166","error":"#ef476f","background":"#001f3f","surface":"#003459","text":"#e8f4f8","textSecondary":"#a0c4d0","border":"#004d73"}'::jsonb, true, 1);
INSERT INTO user_theme_preferences (user_id, theme_name) VALUES (1, 'dark'), (2, 'ocean');
INSERT INTO system_config (key, value, updated_at) VALUES ('last_dossier_counter_reset', '"2026-01-01T00:00:00.000Z"', '2026-01-01 00:00:00');

-- séquences alignées sur les données
DO $$
BEGIN
  PERFORM setval('users_id_seq', (SELECT MAX(id) FROM users));
  PERFORM setval('dossiers_id_seq', (SELECT MAX(id) FROM dossiers));
  PERFORM setval('fichiers_id_seq', (SELECT MAX(id) FROM fichiers));
  PERFORM setval('devis_id_seq', (SELECT MAX(id) FROM devis));
  PERFORM setval('factures_id_seq', (SELECT MAX(id) FROM factures));
  PERFORM setval('numero_commande_seq', 22);  -- dernier CMD-AAAA-NNNN utilisé : 0022
END $$;

COMMIT;
