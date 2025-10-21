-- Données de test pour EvocomPrint
-- Ce script insère des utilisateurs et dossiers de test

-- Insérer des utilisateurs de test (si ils n'existent pas déjà)
INSERT INTO users (prenom, nom, email, password, role, statut) VALUES
('Admin', 'Principal', 'admin@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'admin', 'actif'),
('Jean', 'Preparateur', 'preparateur@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'preparateur', 'actif'),
('Marc', 'Roland', 'roland@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'imprimeur_roland', 'actif'),
('Sophie', 'Xerox', 'xerox@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'imprimeur_xerox', 'actif'),
('Pierre', 'Livreur', 'livreur@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'livreur', 'actif')
ON CONFLICT (email) DO NOTHING;

-- Insérer des dossiers de test
INSERT INTO dossiers (
    numero_commande,
    client_nom,
    client_email,
    client_telephone,
    type,
    status,
    description,
    quantite,
    format_papier,
    urgence,
    deadline,
    created_by,
    created_at,
    updated_at
) VALUES
-- Dossiers Roland
('CMD-2024-001', 'Entreprise ABC', 'contact@abc.com', '01.23.45.67.89', 'roland', 'nouveau', 
 'Impression de brochures commerciales couleur', 500, 'A4', false, 
 NOW() + INTERVAL '7 days', 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),

('CMD-2024-002', 'Mairie de Exemple', 'mairie@exemple.fr', '01.45.67.89.01', 'roland', 'en_preparation', 
 'Affiches pour événement municipal', 100, 'A3', true, 
 NOW() + INTERVAL '3 days', 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 hour'),

('CMD-2024-003', 'Restaurant Le Gourmet', 'resto@legourmet.fr', '01.56.78.90.12', 'roland', 'pret_impression', 
 'Menus du restaurant format A4 recto-verso', 200, 'A4', false, 
 NOW() + INTERVAL '5 days', 2, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '30 minutes'),

('CMD-2024-004', 'Cabinet Médical', 'contact@cabinet-med.fr', '01.67.89.01.23', 'roland', 'en_impression', 
 'Formulaires médicaux personnalisés', 1000, 'A4', false, 
 NOW() + INTERVAL '10 days', 2, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours'),

-- Dossiers Xerox
('CMD-2024-005', 'École Primaire', 'ecole@primaire.edu', '01.78.90.12.34', 'xerox', 'nouveau', 
 'Cahiers d\'exercices pour élèves', 2000, 'A4', false, 
 NOW() + INTERVAL '14 days', 1, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

('CMD-2024-006', 'Association Sports', 'contact@assoc-sports.org', '01.89.01.23.45', 'xerox', 'en_preparation', 
 'Flyers pour tournoi de tennis', 800, 'A5', true, 
 NOW() + INTERVAL '2 days', 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 hours'),

('CMD-2024-007', 'Pharmacie Central', 'pharma@central.fr', '01.90.12.34.56', 'xerox', 'imprime', 
 'Ordonnanciers sécurisés', 500, 'A4', false, 
 NOW() + INTERVAL '8 days', 2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

('CMD-2024-008', 'Boulangerie Dupont', 'boulangerie@dupont.fr', '01.12.34.56.78', 'xerox', 'pret_livraison', 
 'Cartes de fidélité clients', 1500, 'Carte', false, 
 NOW() + INTERVAL '6 days', 2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours'),

-- Dossiers avec différents statuts pour test complet
('CMD-2024-009', 'Garage Renault', 'garage@renault-exemple.fr', '01.23.45.67.90', 'roland', 'en_livraison', 
 'Factures et devis personnalisés', 300, 'A4', false, 
 NOW() + INTERVAL '12 days', 2, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),

('CMD-2024-010', 'Coiffeur Style', 'contact@style-coiffure.fr', '01.34.56.78.91', 'xerox', 'livre', 
 'Cartes de rendez-vous', 200, 'Carte', false, 
 NOW() + INTERVAL '4 days', 2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),

('CMD-2024-011', 'URGENT - Avocat Martin', 'avocat@martin-droit.fr', '01.45.67.89.02', 'roland', 'nouveau', 
 'Dossiers juridiques confidentiels', 50, 'A4', true, 
 NOW() + INTERVAL '1 day', 1, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'),

('CMD-2024-012', 'Agence Immobilière', 'contact@immo-plus.fr', '01.56.78.90.13', 'xerox', 'termine', 
 'Plaquettes commerciales immobilier', 1000, 'A4', false, 
 NOW() + INTERVAL '15 days', 1, NOW() - INTERVAL '1 week', NOW() - INTERVAL '3 days');

-- Insérer l'historique des statuts pour les dossiers qui ont changé de statut
INSERT INTO dossier_status_history (dossier_id, old_status, new_status, changed_by, changed_at) VALUES
-- Dossier CMD-2024-002 (en_preparation)
(2, NULL, 'nouveau', 1, NOW() - INTERVAL '1 day'),
(2, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '1 hour'),

-- Dossier CMD-2024-003 (pret_impression)  
(3, NULL, 'nouveau', 2, NOW() - INTERVAL '6 hours'),
(3, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '4 hours'),
(3, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '30 minutes'),

-- Dossier CMD-2024-004 (en_impression)
(4, NULL, 'nouveau', 2, NOW() - INTERVAL '4 hours'),
(4, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '3 hours'),
(4, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '2 hours 30 minutes'),
(4, 'pret_impression', 'en_impression', 3, NOW() - INTERVAL '2 hours'),

-- Dossier CMD-2024-006 (en_preparation)
(6, NULL, 'nouveau', 1, NOW() - INTERVAL '1 day'),
(6, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '4 hours'),

-- Dossier CMD-2024-007 (imprime)
(7, NULL, 'nouveau', 2, NOW() - INTERVAL '2 days'),
(7, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '2 days' + INTERVAL '2 hours'),
(7, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
(7, 'pret_impression', 'en_impression', 4, NOW() - INTERVAL '1 day' + INTERVAL '6 hours'),
(7, 'en_impression', 'imprime', 4, NOW() - INTERVAL '1 day'),

-- Dossier CMD-2024-008 (pret_livraison)
(8, NULL, 'nouveau', 2, NOW() - INTERVAL '1 day'),
(8, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '1 day' + INTERVAL '3 hours'),
(8, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '12 hours'),
(8, 'pret_impression', 'en_impression', 4, NOW() - INTERVAL '10 hours'),
(8, 'en_impression', 'imprime', 4, NOW() - INTERVAL '8 hours'),
(8, 'imprime', 'pret_livraison', 4, NOW() - INTERVAL '6 hours'),

-- Dossier CMD-2024-009 (en_livraison)
(9, NULL, 'nouveau', 2, NOW() - INTERVAL '3 days'),
(9, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '3 days' + INTERVAL '2 hours'),
(9, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
(9, 'pret_impression', 'en_impression', 3, NOW() - INTERVAL '2 days'),
(9, 'en_impression', 'imprime', 3, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
(9, 'imprime', 'pret_livraison', 3, NOW() - INTERVAL '1 day' + INTERVAL '6 hours'),
(9, 'pret_livraison', 'en_livraison', 5, NOW() - INTERVAL '1 day'),

-- Dossier CMD-2024-010 (livre)
(10, NULL, 'nouveau', 2, NOW() - INTERVAL '5 days'),
(10, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '5 days' + INTERVAL '2 hours'),
(10, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '4 days' + INTERVAL '12 hours'),
(10, 'pret_impression', 'en_impression', 4, NOW() - INTERVAL '4 days'),
(10, 'en_impression', 'imprime', 4, NOW() - INTERVAL '3 days' + INTERVAL '12 hours'),
(10, 'imprime', 'pret_livraison', 4, NOW() - INTERVAL '3 days'),
(10, 'pret_livraison', 'en_livraison', 5, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
(10, 'en_livraison', 'livre', 5, NOW() - INTERVAL '2 days'),

-- Dossier CMD-2024-012 (termine)
(12, NULL, 'nouveau', 1, NOW() - INTERVAL '1 week'),
(12, 'nouveau', 'en_preparation', 2, NOW() - INTERVAL '1 week' + INTERVAL '2 hours'),
(12, 'en_preparation', 'pret_impression', 2, NOW() - INTERVAL '6 days'),
(12, 'pret_impression', 'en_impression', 4, NOW() - INTERVAL '5 days' + INTERVAL '12 hours'),
(12, 'en_impression', 'imprime', 4, NOW() - INTERVAL '5 days'),
(12, 'imprime', 'pret_livraison', 4, NOW() - INTERVAL '4 days' + INTERVAL '12 hours'),
(12, 'pret_livraison', 'en_livraison', 5, NOW() - INTERVAL '4 days'),
(12, 'en_livraison', 'livre', 5, NOW() - INTERVAL '3 days' + INTERVAL '12 hours'),
(12, 'livre', 'termine', 1, NOW() - INTERVAL '3 days');

-- Insérer quelques fichiers de test (simulés)
INSERT INTO dossier_files (dossier_id, original_filename, stored_filename, mimetype, size, uploaded_by, uploaded_at) VALUES
(1, 'brochure_abc_v1.pdf', 'dossier1_brochure_abc_v1_20240101.pdf', 'application/pdf', 2048000, 1, NOW() - INTERVAL '2 hours'),
(1, 'logo_abc.png', 'dossier1_logo_abc_20240101.png', 'image/png', 152000, 1, NOW() - INTERVAL '2 hours'),

(2, 'affiche_mairie.ai', 'dossier2_affiche_mairie_20240102.ai', 'application/illustrator', 5120000, 1, NOW() - INTERVAL '1 day'),
(2, 'texte_evenement.docx', 'dossier2_texte_evenement_20240102.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 45000, 1, NOW() - INTERVAL '1 day'),

(3, 'menu_gourmet_v2.pdf', 'dossier3_menu_gourmet_v2_20240103.pdf', 'application/pdf', 892000, 2, NOW() - INTERVAL '6 hours'),

(4, 'formulaire_medical.pdf', 'dossier4_formulaire_medical_20240104.pdf', 'application/pdf', 234000, 2, NOW() - INTERVAL '4 hours'),
(4, 'en_tete_cabinet.png', 'dossier4_en_tete_cabinet_20240104.png', 'image/png', 678000, 2, NOW() - INTERVAL '4 hours'),

(11, 'dossier_urgent_martin.pdf', 'dossier11_urgent_martin_20240111.pdf', 'application/pdf', 1024000, 1, NOW() - INTERVAL '30 minutes');

-- Afficher le résultat
SELECT 'Données de test insérées avec succès !' as message;
SELECT 'Utilisateurs créés:', COUNT(*) as nombre FROM users;
SELECT 'Dossiers créés:', COUNT(*) as nombre FROM dossiers;
SELECT 'Entrées d''historique créées:', COUNT(*) as nombre FROM dossier_status_history;
SELECT 'Fichiers de test créés:', COUNT(*) as nombre FROM dossier_files;