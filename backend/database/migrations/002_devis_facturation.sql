-- ============================================
-- Migration: Système Devis & Facturation + OpenAI
-- Date: 2025-10-09
-- Description: Création des tables pour la gestion des devis, factures, tarification et configuration OpenAI
-- ============================================

-- Table: devis
-- Description: Stocke tous les devis créés par les préparateurs
CREATE TABLE IF NOT EXISTS devis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Numéro unique du devis (ex: DEV-2025-001)',
    user_id INT NOT NULL COMMENT 'ID du préparateur qui a créé le devis',
    machine_type ENUM('roland', 'xerox') NOT NULL COMMENT 'Type de machine pour ce devis',
    
    -- Données du formulaire stockées en JSON
    data_json TEXT NOT NULL COMMENT 'Données complètes du formulaire Roland ou Xerox en JSON',
    
    -- Tarification
    prix_estime DECIMAL(10, 2) DEFAULT NULL COMMENT 'Prix estimé automatiquement (IA ou calcul)',
    prix_final DECIMAL(10, 2) DEFAULT NULL COMMENT 'Prix final validé par le préparateur',
    details_prix TEXT DEFAULT NULL COMMENT 'Détail du calcul (JSON avec répartition par poste)',
    
    -- Métadonnées client
    client_nom VARCHAR(255) DEFAULT NULL COMMENT 'Nom du client',
    client_contact VARCHAR(255) DEFAULT NULL COMMENT 'Contact du client',
    
    -- Statut et workflow
    statut ENUM('brouillon', 'en_attente', 'valide', 'refuse', 'converti') DEFAULT 'brouillon' COMMENT 'Statut du devis',
    converted_folder_id VARCHAR(36) DEFAULT NULL COMMENT 'UUID du dossier créé si converti',
    
    -- Notes et commentaires
    notes TEXT DEFAULT NULL COMMENT 'Notes internes du préparateur',
    commentaire_refus TEXT DEFAULT NULL COMMENT 'Raison du refus (si statut=refuse)',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    validated_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Date de validation du devis',
    converted_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Date de conversion en dossier',
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_statut (statut),
    INDEX idx_machine_type (machine_type),
    INDEX idx_converted_folder (converted_folder_id),
    INDEX idx_created_at (created_at),
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (converted_folder_id) REFERENCES dossiers(folder_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des devis créés par les préparateurs';


-- Table: factures
-- Description: Stocke toutes les factures générées automatiquement ou manuellement
CREATE TABLE IF NOT EXISTS factures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Numéro unique de facture (ex: FAC-2025-001)',
    dossier_id VARCHAR(36) NOT NULL COMMENT 'UUID du dossier lié',
    user_id INT NOT NULL COMMENT 'ID du préparateur (propriétaire du dossier)',
    
    -- Montants
    montant_ht DECIMAL(10, 2) DEFAULT NULL COMMENT 'Montant hors taxes',
    montant_tva DECIMAL(10, 2) DEFAULT NULL COMMENT 'Montant de la TVA',
    montant_ttc DECIMAL(10, 2) NOT NULL COMMENT 'Montant total TTC',
    
    -- Informations client
    client_nom VARCHAR(255) NOT NULL COMMENT 'Nom du client facturé',
    client_contact VARCHAR(255) DEFAULT NULL COMMENT 'Contact du client',
    client_adresse TEXT DEFAULT NULL COMMENT 'Adresse de facturation',
    
    -- Paiement
    mode_paiement ENUM('wave', 'orange_money', 'virement', 'cheque', 'especes') DEFAULT 'especes' COMMENT 'Mode de paiement',
    statut_paiement ENUM('non_paye', 'paye', 'partiellement_paye', 'annule') DEFAULT 'non_paye' COMMENT 'Statut du paiement',
    date_paiement TIMESTAMP NULL DEFAULT NULL COMMENT 'Date du paiement effectif',
    
    -- PDF et documents
    pdf_path VARCHAR(500) DEFAULT NULL COMMENT 'Chemin du PDF de la facture',
    pdf_generated_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Date de génération du PDF',
    
    -- Métadonnées
    notes TEXT DEFAULT NULL COMMENT 'Notes internes',
    details_json TEXT DEFAULT NULL COMMENT 'Détails complets de la facture en JSON',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création (= fin de livraison)',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_dossier_id (dossier_id),
    INDEX idx_user_id (user_id),
    INDEX idx_statut_paiement (statut_paiement),
    INDEX idx_created_at (created_at),
    INDEX idx_mode_paiement (mode_paiement),
    
    -- Foreign keys
    FOREIGN KEY (dossier_id) REFERENCES dossiers(folder_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table des factures générées';


-- Table: tarifs_config
-- Description: Configuration des tarifs pour Roland et Xerox (modifiable par admin)
CREATE TABLE IF NOT EXISTS tarifs_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_machine ENUM('roland', 'xerox', 'global') NOT NULL COMMENT 'Type de machine concerné',
    categorie VARCHAR(100) NOT NULL COMMENT 'Catégorie du tarif (ex: base, finition, option)',
    cle VARCHAR(100) NOT NULL COMMENT 'Clé unique du tarif (ex: prix_m2_bache, pelliculage)',
    label VARCHAR(255) NOT NULL COMMENT 'Libellé lisible du tarif',
    
    -- Valeurs
    valeur DECIMAL(10, 2) NOT NULL COMMENT 'Valeur du tarif (prix en FCFA)',
    unite VARCHAR(50) DEFAULT NULL COMMENT 'Unité (m², page, forfait, etc.)',
    
    -- Métadonnées
    description TEXT DEFAULT NULL COMMENT 'Description détaillée',
    actif BOOLEAN DEFAULT TRUE COMMENT 'Tarif actif ou non',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Contraintes
    UNIQUE KEY unique_tarif (type_machine, categorie, cle),
    INDEX idx_type_machine (type_machine),
    INDEX idx_categorie (categorie),
    INDEX idx_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuration des tarifs modifiables par admin';


-- Table: openai_config
-- Description: Configuration de l'API OpenAI et base de connaissance tarifaire
CREATE TABLE IF NOT EXISTS openai_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Clé API (chiffrée)
    api_key_encrypted TEXT DEFAULT NULL COMMENT 'Clé API OpenAI chiffrée',
    api_key_iv VARCHAR(100) DEFAULT NULL COMMENT 'Vecteur d\'initialisation pour le chiffrement',
    is_active BOOLEAN DEFAULT FALSE COMMENT 'Activation de l\'IA pour les estimations',
    
    -- Base de connaissance texte
    knowledge_base_text TEXT DEFAULT NULL COMMENT 'Base de connaissance tarifaire en texte libre',
    
    -- Base de connaissance PDF
    knowledge_base_pdf_path VARCHAR(500) DEFAULT NULL COMMENT 'Chemin du fichier PDF de connaissance',
    knowledge_base_pdf_name VARCHAR(255) DEFAULT NULL COMMENT 'Nom original du fichier PDF',
    knowledge_base_pdf_size INT DEFAULT NULL COMMENT 'Taille du fichier en octets',
    
    -- Statistiques d'utilisation
    total_requests INT DEFAULT 0 COMMENT 'Nombre total de requêtes à l\'API',
    last_request_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Dernière utilisation',
    last_test_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Dernier test de connexion',
    last_test_status ENUM('success', 'failed', 'pending') DEFAULT 'pending' COMMENT 'Résultat du dernier test',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuration OpenAI pour estimation intelligente';

-- Insertion d'une ligne de configuration par défaut
INSERT INTO openai_config (is_active) VALUES (FALSE);


-- Table: devis_historique
-- Description: Historique des modifications de devis (audit)
CREATE TABLE IF NOT EXISTS devis_historique (
    id INT AUTO_INCREMENT PRIMARY KEY,
    devis_id INT NOT NULL COMMENT 'ID du devis modifié',
    user_id INT NOT NULL COMMENT 'Utilisateur ayant effectué la modification',
    action VARCHAR(50) NOT NULL COMMENT 'Type d\'action (creation, modification, validation, conversion, etc.)',
    ancien_statut VARCHAR(50) DEFAULT NULL COMMENT 'Ancien statut avant modification',
    nouveau_statut VARCHAR(50) DEFAULT NULL COMMENT 'Nouveau statut après modification',
    details_json TEXT DEFAULT NULL COMMENT 'Détails de la modification en JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_devis_id (devis_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historique des modifications de devis';


-- ============================================
-- DONNÉES INITIALES: Tarifs par défaut
-- ============================================

-- Tarifs Roland (Impression grand format)
INSERT INTO tarifs_config (type_machine, categorie, cle, label, valeur, unite, description, actif) VALUES
-- Supports de base
('roland', 'support', 'bache_m2', 'Bâche standard', 7000.00, 'm²', 'Prix au m² pour impression bâche standard', TRUE),
('roland', 'support', 'vinyle_m2', 'Vinyle adhésif', 9500.00, 'm²', 'Prix au m² pour impression vinyle adhésif', TRUE),
('roland', 'support', 'papier_photo_m2', 'Papier photo', 8500.00, 'm²', 'Prix au m² pour impression papier photo', TRUE),
('roland', 'support', 'toile_canvas_m2', 'Toile Canvas', 12000.00, 'm²', 'Prix au m² pour impression toile canvas', TRUE),

-- Finitions Roland
('roland', 'finition', 'pelliculage', 'Pelliculage', 1500.00, 'm²', 'Pelliculage mat ou brillant', TRUE),
('roland', 'finition', 'vernis', 'Vernis sélectif', 2000.00, 'm²', 'Application de vernis sélectif', TRUE),
('roland', 'finition', 'decoupe_forme', 'Découpe à la forme', 2000.00, 'forfait', 'Découpe à la forme personnalisée', TRUE),
('roland', 'finition', 'oeillets', 'Pose d\'œillets', 500.00, 'unité', 'Prix par œillet posé', TRUE),

-- Options Roland
('roland', 'option', 'livraison_express', 'Livraison express', 5000.00, 'forfait', 'Livraison express sous 24h', TRUE),
('roland', 'option', 'retouche_graphique', 'Retouche graphique', 3000.00, 'forfait', 'Retouche graphique mineure', TRUE),

-- Tarifs Xerox (Impression numérique petit format)
-- Papiers de base
('xerox', 'papier', 'a4_80g_nb', 'A4 80g Noir & Blanc', 25.00, 'page', 'Impression A4 80g noir et blanc', TRUE),
('xerox', 'papier', 'a4_80g_couleur', 'A4 80g Couleur', 75.00, 'page', 'Impression A4 80g couleur', TRUE),
('xerox', 'papier', 'a3_80g_nb', 'A3 80g Noir & Blanc', 50.00, 'page', 'Impression A3 80g noir et blanc', TRUE),
('xerox', 'papier', 'a3_80g_couleur', 'A3 80g Couleur', 150.00, 'page', 'Impression A3 80g couleur', TRUE),
('xerox', 'papier', 'a4_120g_couleur', 'A4 120g Couleur', 100.00, 'page', 'Impression A4 120g couleur', TRUE),

-- Finitions Xerox
('xerox', 'finition', 'reliure_spirale', 'Reliure spirale', 500.00, 'unité', 'Reliure spirale plastique', TRUE),
('xerox', 'finition', 'reliure_thermique', 'Reliure thermique', 800.00, 'unité', 'Reliure thermique collée', TRUE),
('xerox', 'finition', 'agrafage', 'Agrafage', 50.00, 'unité', 'Agrafage simple', TRUE),
('xerox', 'finition', 'perforation', 'Perforation', 25.00, 'unité', 'Perforation pour classeur', TRUE),
('xerox', 'finition', 'plastification_a4', 'Plastification A4', 200.00, 'page', 'Plastification A4 mat ou brillant', TRUE),

-- Façonnage Xerox
('xerox', 'faconnage', 'pliage_2_plis', 'Pliage 2 plis', 50.00, 'unité', 'Pliage simple en 2', TRUE),
('xerox', 'faconnage', 'pliage_3_plis', 'Pliage 3 plis', 75.00, 'unité', 'Pliage accordéon en 3', TRUE),
('xerox', 'faconnage', 'decoupe', 'Découpe format', 100.00, 'unité', 'Découpe au format souhaité', TRUE),

-- Tarifs globaux (remises, frais)
('global', 'remise', 'volume_20m2', 'Remise volume 20m²+', -10.00, '%', 'Remise de 10% à partir de 20m²', TRUE),
('global', 'remise', 'volume_500pages', 'Remise volume 500 pages+', -15.00, '%', 'Remise de 15% à partir de 500 pages', TRUE),
('global', 'frais', 'urgence', 'Frais d\'urgence', 5000.00, 'forfait', 'Frais supplémentaires pour traitement urgent', TRUE),
('global', 'frais', 'creation_fichier', 'Création fichier PAO', 7500.00, 'forfait', 'Création fichier à partir de maquette', TRUE);


-- ============================================
-- TRIGGERS: Auto-génération des numéros
-- ============================================

-- Trigger pour générer automatiquement le numéro de devis
DELIMITER //
CREATE TRIGGER before_insert_devis
BEFORE INSERT ON devis
FOR EACH ROW
BEGIN
    DECLARE next_num INT;
    DECLARE current_year VARCHAR(4);
    
    SET current_year = YEAR(CURRENT_DATE);
    
    -- Trouver le prochain numéro pour l'année en cours
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(numero, '-', -1) AS UNSIGNED)), 0) + 1
    INTO next_num
    FROM devis
    WHERE numero LIKE CONCAT('DEV-', current_year, '-%');
    
    -- Générer le numéro avec padding (DEV-2025-001)
    SET NEW.numero = CONCAT('DEV-', current_year, '-', LPAD(next_num, 3, '0'));
END//
DELIMITER ;


-- Trigger pour générer automatiquement le numéro de facture
DELIMITER //
CREATE TRIGGER before_insert_facture
BEFORE INSERT ON factures
FOR EACH ROW
BEGIN
    DECLARE next_num INT;
    DECLARE current_year VARCHAR(4);
    
    SET current_year = YEAR(CURRENT_DATE);
    
    -- Trouver le prochain numéro pour l'année en cours
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(numero, '-', -1) AS UNSIGNED)), 0) + 1
    INTO next_num
    FROM factures
    WHERE numero LIKE CONCAT('FAC-', current_year, '-%');
    
    -- Générer le numéro avec padding (FAC-2025-001)
    SET NEW.numero = CONCAT('FAC-', current_year, '-', LPAD(next_num, 3, '0'));
END//
DELIMITER ;


-- ============================================
-- VUES UTILES
-- ============================================

-- Vue: devis avec informations utilisateur
CREATE OR REPLACE VIEW v_devis_complet AS
SELECT 
    d.*,
    u.prenom,
    u.nom,
    u.email,
    dos.numero AS dossier_numero,
    dos.statut AS dossier_statut
FROM devis d
LEFT JOIN users u ON d.user_id = u.id
LEFT JOIN dossiers dos ON d.converted_folder_id = dos.folder_id;


-- Vue: factures avec informations complètes
CREATE OR REPLACE VIEW v_factures_complet AS
SELECT 
    f.*,
    u.prenom,
    u.nom,
    u.email,
    d.numero AS dossier_numero,
    d.machine_type AS dossier_machine,
    d.statut AS dossier_statut
FROM factures f
LEFT JOIN users u ON f.user_id = u.id
LEFT JOIN dossiers d ON f.dossier_id = d.folder_id;


-- Vue: statistiques devis par utilisateur
CREATE OR REPLACE VIEW v_stats_devis_user AS
SELECT 
    u.id AS user_id,
    u.prenom,
    u.nom,
    COUNT(d.id) AS total_devis,
    SUM(CASE WHEN d.statut = 'valide' THEN 1 ELSE 0 END) AS devis_valides,
    SUM(CASE WHEN d.statut = 'converti' THEN 1 ELSE 0 END) AS devis_convertis,
    SUM(CASE WHEN d.statut = 'refuse' THEN 1 ELSE 0 END) AS devis_refuses,
    SUM(d.prix_final) AS ca_total_devis
FROM users u
LEFT JOIN devis d ON u.id = d.user_id
WHERE u.role = 'preparateur'
GROUP BY u.id;


-- ============================================
-- PERMISSIONS ET SÉCURITÉ
-- ============================================

-- Les permissions sont gérées au niveau application (middleware auth)
-- Règles:
-- - PRÉPARATEUR: CRUD sur ses propres devis, lecture de ses factures
-- - ADMIN: Accès complet à tous les devis, factures et tarifs
-- - IMPRIMEUR/LIVREUR: Pas d'accès direct (sauf via dossiers liés)

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
