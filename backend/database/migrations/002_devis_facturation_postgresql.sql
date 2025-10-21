-- ============================================
-- Migration PostgreSQL: Système Devis & Facturation + OpenAI
-- Date: 2025-10-09
-- Description: Création des tables pour la gestion des devis, factures, tarification et configuration OpenAI
-- ============================================

-- Types ENUM pour PostgreSQL
DO $$ BEGIN
    CREATE TYPE machine_type AS ENUM ('roland', 'xerox');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE statut_devis AS ENUM ('brouillon', 'en_attente', 'valide', 'refuse', 'converti');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE mode_paiement_type AS ENUM ('wave', 'orange_money', 'virement', 'cheque', 'especes');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE statut_paiement_type AS ENUM ('non_paye', 'paye', 'partiellement_paye', 'annule');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE type_machine_tarif AS ENUM ('roland', 'xerox', 'global');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE test_status_type AS ENUM ('success', 'failed', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- Table: devis
-- Description: Stocke tous les devis créés par les préparateurs
CREATE TABLE IF NOT EXISTS devis (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL, -- Numéro unique du devis (ex: DEV-2025-001)
    user_id INTEGER NOT NULL, -- ID du préparateur qui a créé le devis
    machine_type machine_type NOT NULL, -- Type de machine pour ce devis
    
    -- Données du formulaire stockées en JSON
    data_json TEXT NOT NULL, -- Données complètes du formulaire Roland ou Xerox en JSON
    
    -- Tarification
    prix_estime DECIMAL(10, 2) DEFAULT NULL, -- Prix estimé automatiquement (IA ou calcul)
    prix_final DECIMAL(10, 2) DEFAULT NULL, -- Prix final validé par le préparateur
    details_prix TEXT DEFAULT NULL, -- Détail du calcul (JSON avec répartition par poste)
    
    -- Métadonnées client
    client_nom VARCHAR(255) DEFAULT NULL, -- Nom du client
    client_contact VARCHAR(255) DEFAULT NULL, -- Contact du client
    
    -- Statut et workflow
    statut statut_devis DEFAULT 'brouillon', -- Statut du devis
    converted_folder_id VARCHAR(36) DEFAULT NULL, -- UUID du dossier créé si converti
    
    -- Notes et commentaires
    notes TEXT DEFAULT NULL, -- Notes internes du préparateur
    commentaire_refus TEXT DEFAULT NULL, -- Raison du refus (si statut=refuse)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP NULL DEFAULT NULL, -- Date de validation du devis
    converted_at TIMESTAMP NULL DEFAULT NULL -- Date de conversion en dossier
);

-- Indexes pour devis
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);
CREATE INDEX IF NOT EXISTS idx_devis_machine_type ON devis(machine_type);
CREATE INDEX IF NOT EXISTS idx_devis_converted_folder ON devis(converted_folder_id);
CREATE INDEX IF NOT EXISTS idx_devis_created_at ON devis(created_at);

-- Foreign keys pour devis (à adapter selon votre schéma)
-- ALTER TABLE devis ADD CONSTRAINT fk_devis_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE devis ADD CONSTRAINT fk_devis_folder FOREIGN KEY (converted_folder_id) REFERENCES dossiers(folder_id) ON DELETE SET NULL;


-- Table: factures
-- Description: Stocke toutes les factures générées automatiquement ou manuellement
CREATE TABLE IF NOT EXISTS factures (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL, -- Numéro unique de facture (ex: FAC-2025-001)
    dossier_id VARCHAR(36) NOT NULL, -- UUID du dossier lié
    user_id INTEGER NOT NULL, -- ID du préparateur (propriétaire du dossier)
    
    -- Montants
    montant_ht DECIMAL(10, 2) DEFAULT NULL, -- Montant hors taxes
    montant_tva DECIMAL(10, 2) DEFAULT NULL, -- Montant de la TVA
    montant_ttc DECIMAL(10, 2) NOT NULL, -- Montant total TTC
    
    -- Informations client
    client_nom VARCHAR(255) NOT NULL, -- Nom du client facturé
    client_contact VARCHAR(255) DEFAULT NULL, -- Contact du client
    client_adresse TEXT DEFAULT NULL, -- Adresse de facturation
    
    -- Paiement
    mode_paiement mode_paiement_type DEFAULT 'especes', -- Mode de paiement
    statut_paiement statut_paiement_type DEFAULT 'non_paye', -- Statut du paiement
    date_paiement TIMESTAMP NULL DEFAULT NULL, -- Date du paiement effectif
    
    -- PDF et documents
    pdf_path VARCHAR(500) DEFAULT NULL, -- Chemin du PDF de la facture
    pdf_generated_at TIMESTAMP NULL DEFAULT NULL, -- Date de génération du PDF
    
    -- Métadonnées
    notes TEXT DEFAULT NULL, -- Notes internes
    details_json TEXT DEFAULT NULL, -- Détails complets de la facture en JSON
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Date de création (= fin de livraison)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes pour factures
CREATE INDEX IF NOT EXISTS idx_factures_dossier_id ON factures(dossier_id);
CREATE INDEX IF NOT EXISTS idx_factures_user_id ON factures(user_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut_paiement ON factures(statut_paiement);
CREATE INDEX IF NOT EXISTS idx_factures_created_at ON factures(created_at);
CREATE INDEX IF NOT EXISTS idx_factures_mode_paiement ON factures(mode_paiement);

-- Foreign keys pour factures (à adapter selon votre schéma)
-- ALTER TABLE factures ADD CONSTRAINT fk_factures_dossier FOREIGN KEY (dossier_id) REFERENCES dossiers(folder_id) ON DELETE CASCADE;
-- ALTER TABLE factures ADD CONSTRAINT fk_factures_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- Table: tarifs_config
-- Description: Configuration des tarifs pour Roland et Xerox (modifiable par admin)
CREATE TABLE IF NOT EXISTS tarifs_config (
    id SERIAL PRIMARY KEY,
    type_machine type_machine_tarif NOT NULL, -- Type de machine concerné
    categorie VARCHAR(100) NOT NULL, -- Catégorie du tarif (ex: base, finition, option)
    cle VARCHAR(100) NOT NULL, -- Clé unique du tarif (ex: prix_m2_bache, pelliculage)
    label VARCHAR(255) NOT NULL, -- Libellé lisible du tarif
    
    -- Valeurs
    valeur DECIMAL(10, 2) NOT NULL, -- Valeur du tarif (prix en FCFA)
    unite VARCHAR(50) DEFAULT NULL, -- Unité (m², page, forfait, etc.)
    
    -- Métadonnées
    description TEXT DEFAULT NULL, -- Description détaillée
    actif BOOLEAN DEFAULT TRUE, -- Tarif actif ou non
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    UNIQUE (type_machine, categorie, cle)
);

-- Indexes pour tarifs_config
CREATE INDEX IF NOT EXISTS idx_tarifs_type_machine ON tarifs_config(type_machine);
CREATE INDEX IF NOT EXISTS idx_tarifs_categorie ON tarifs_config(categorie);
CREATE INDEX IF NOT EXISTS idx_tarifs_actif ON tarifs_config(actif);


-- Table: openai_config
-- Description: Configuration de l'API OpenAI et base de connaissance tarifaire
CREATE TABLE IF NOT EXISTS openai_config (
    id SERIAL PRIMARY KEY,
    
    -- Clé API (chiffrée)
    api_key_encrypted TEXT DEFAULT NULL, -- Clé API OpenAI chiffrée
    api_key_iv VARCHAR(100) DEFAULT NULL, -- Vecteur d'initialisation pour le chiffrement
    is_active BOOLEAN DEFAULT FALSE, -- Activation de l'IA pour les estimations
    
    -- Base de connaissance texte
    knowledge_base_text TEXT DEFAULT NULL, -- Base de connaissance tarifaire en texte libre
    
    -- Base de connaissance PDF
    knowledge_base_pdf_path VARCHAR(500) DEFAULT NULL, -- Chemin du fichier PDF de connaissance
    knowledge_base_pdf_name VARCHAR(255) DEFAULT NULL, -- Nom original du fichier PDF
    knowledge_base_pdf_size INTEGER DEFAULT NULL, -- Taille du fichier en octets
    
    -- Statistiques d'utilisation
    total_requests INTEGER DEFAULT 0, -- Nombre total de requêtes à l'API
    last_request_at TIMESTAMP NULL DEFAULT NULL, -- Dernière utilisation
    last_test_at TIMESTAMP NULL DEFAULT NULL, -- Dernier test de connexion
    last_test_status test_status_type DEFAULT 'pending', -- Résultat du dernier test
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion d'une ligne de configuration par défaut
INSERT INTO openai_config (is_active) 
SELECT FALSE
WHERE NOT EXISTS (SELECT 1 FROM openai_config LIMIT 1);


-- Table: devis_historique
-- Description: Historique des modifications de devis (audit)
CREATE TABLE IF NOT EXISTS devis_historique (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL, -- ID du devis modifié
    user_id INTEGER NOT NULL, -- Utilisateur ayant effectué la modification
    action VARCHAR(50) NOT NULL, -- Type d'action (creation, modification, validation, conversion, etc.)
    ancien_statut VARCHAR(50) DEFAULT NULL, -- Ancien statut avant modification
    nouveau_statut VARCHAR(50) DEFAULT NULL, -- Nouveau statut après modification
    details_json TEXT DEFAULT NULL, -- Détails de la modification en JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes pour devis_historique
CREATE INDEX IF NOT EXISTS idx_historique_devis_id ON devis_historique(devis_id);
CREATE INDEX IF NOT EXISTS idx_historique_user_id ON devis_historique(user_id);
CREATE INDEX IF NOT EXISTS idx_historique_action ON devis_historique(action);
CREATE INDEX IF NOT EXISTS idx_historique_created_at ON devis_historique(created_at);

-- Foreign keys pour historique (à adapter)
-- ALTER TABLE devis_historique ADD CONSTRAINT fk_historique_devis FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE;
-- ALTER TABLE devis_historique ADD CONSTRAINT fk_historique_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- ============================================
-- FONCTIONS ET TRIGGERS
-- ============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour devis
DROP TRIGGER IF EXISTS update_devis_updated_at ON devis;
CREATE TRIGGER update_devis_updated_at 
    BEFORE UPDATE ON devis 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour factures
DROP TRIGGER IF EXISTS update_factures_updated_at ON factures;
CREATE TRIGGER update_factures_updated_at 
    BEFORE UPDATE ON factures 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour tarifs_config
DROP TRIGGER IF EXISTS update_tarifs_updated_at ON tarifs_config;
CREATE TRIGGER update_tarifs_updated_at 
    BEFORE UPDATE ON tarifs_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour openai_config
DROP TRIGGER IF EXISTS update_openai_updated_at ON openai_config;
CREATE TRIGGER update_openai_updated_at 
    BEFORE UPDATE ON openai_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- FONCTIONS POUR AUTO-NUMÉROTATION
-- ============================================

-- Fonction pour générer le numéro de devis automatiquement
CREATE OR REPLACE FUNCTION generate_devis_numero()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    next_num INTEGER;
    new_numero VARCHAR(50);
BEGIN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
        year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 10) AS INTEGER)), 0) + 1
        INTO next_num
        FROM devis
        WHERE numero LIKE 'DEV-' || year_part || '-%';
        
        new_numero := 'DEV-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
        NEW.numero := new_numero;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-numérotation des devis
DROP TRIGGER IF EXISTS auto_numero_devis ON devis;
CREATE TRIGGER auto_numero_devis
    BEFORE INSERT ON devis
    FOR EACH ROW
    EXECUTE FUNCTION generate_devis_numero();


-- Fonction pour générer le numéro de facture automatiquement
CREATE OR REPLACE FUNCTION generate_facture_numero()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    next_num INTEGER;
    new_numero VARCHAR(50);
BEGIN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
        year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 10) AS INTEGER)), 0) + 1
        INTO next_num
        FROM factures
        WHERE numero LIKE 'FAC-' || year_part || '-%';
        
        new_numero := 'FAC-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
        NEW.numero := new_numero;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-numérotation des factures
DROP TRIGGER IF EXISTS auto_numero_facture ON factures;
CREATE TRIGGER auto_numero_facture
    BEFORE INSERT ON factures
    FOR EACH ROW
    EXECUTE FUNCTION generate_facture_numero();


-- ============================================
-- VUES POUR FACILITER LES REQUÊTES
-- ============================================

-- Vue complète des devis avec informations utilisateur
CREATE OR REPLACE VIEW v_devis_complet AS
SELECT 
    d.*,
    u.username,
    u.email,
    u.role
FROM devis d
LEFT JOIN users u ON d.user_id = u.id;

-- Vue complète des factures avec informations utilisateur
CREATE OR REPLACE VIEW v_factures_complet AS
SELECT 
    f.*,
    u.username,
    u.email,
    u.role
FROM factures f
LEFT JOIN users u ON f.user_id = u.id;

-- Vue statistiques des devis par utilisateur
CREATE OR REPLACE VIEW v_stats_devis_user AS
SELECT 
    user_id,
    COUNT(*) as total_devis,
    COUNT(CASE WHEN statut = 'brouillon' THEN 1 END) as brouillon,
    COUNT(CASE WHEN statut = 'en_attente' THEN 1 END) as en_attente,
    COUNT(CASE WHEN statut = 'valide' THEN 1 END) as valide,
    COUNT(CASE WHEN statut = 'refuse' THEN 1 END) as refuse,
    COUNT(CASE WHEN statut = 'converti' THEN 1 END) as converti,
    SUM(prix_final) as total_montant,
    MAX(created_at) as dernier_devis
FROM devis
GROUP BY user_id;


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
('roland', 'finition', 'coupage_decoupe', 'Découpe à la forme', 3000.00, 'forfait', 'Découpe personnalisée', TRUE),

-- Options Roland
('roland', 'option', 'livraison', 'Livraison', 5000.00, 'forfait', 'Frais de livraison', TRUE),
('roland', 'option', 'montage', 'Montage/Installation', 10000.00, 'forfait', 'Montage et installation sur site', TRUE),

-- Tarifs Xerox (Impression offset/numérique)
-- Supports de base
('xerox', 'support', 'papier_a4_couleur', 'A4 Couleur', 100.00, 'page', 'Impression A4 couleur', TRUE),
('xerox', 'support', 'papier_a4_nb', 'A4 Noir & Blanc', 50.00, 'page', 'Impression A4 noir et blanc', TRUE),
('xerox', 'support', 'papier_a3_couleur', 'A3 Couleur', 200.00, 'page', 'Impression A3 couleur', TRUE),
('xerox', 'support', 'papier_a3_nb', 'A3 Noir & Blanc', 100.00, 'page', 'Impression A3 noir et blanc', TRUE),

-- Finitions Xerox
('xerox', 'finition', 'reliure_spirale', 'Reliure spirale', 500.00, 'forfait', 'Reliure spirale métallique', TRUE),
('xerox', 'finition', 'reliure_thermique', 'Reliure thermique', 800.00, 'forfait', 'Reliure thermique', TRUE),
('xerox', 'finition', 'plastification', 'Plastification', 300.00, 'page', 'Plastification à chaud', TRUE),
('xerox', 'finition', 'perforation', 'Perforation', 50.00, 'page', 'Perforation 2 ou 4 trous', TRUE),

-- Options Xerox
('xerox', 'option', 'papier_premium', 'Papier premium', 50.00, 'page', 'Supplément papier premium', TRUE),
('xerox', 'option', 'impression_recto_verso', 'Recto-verso', 20.00, 'page', 'Impression recto-verso', TRUE),

-- Tarifs globaux (applicables aux deux machines)
('global', 'divers', 'conception_graphique', 'Conception graphique', 15000.00, 'forfait', 'Création/modification de fichiers', TRUE),
('global', 'divers', 'epreuve_numerique', 'Épreuve numérique', 2000.00, 'forfait', 'BAT numérique', TRUE),
('global', 'divers', 'urgence_24h', 'Urgence 24h', 10000.00, 'forfait', 'Traitement prioritaire sous 24h', TRUE),
('global', 'divers', 'urgence_48h', 'Urgence 48h', 5000.00, 'forfait', 'Traitement prioritaire sous 48h', TRUE)
ON CONFLICT (type_machine, categorie, cle) DO NOTHING;


-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

-- Afficher un message de confirmation
DO $$ 
BEGIN 
    RAISE NOTICE 'Migration Devis & Facturation PostgreSQL terminée avec succès!';
    RAISE NOTICE 'Tables créées: devis, factures, tarifs_config, openai_config, devis_historique';
    RAISE NOTICE 'Vues créées: v_devis_complet, v_factures_complet, v_stats_devis_user';
    RAISE NOTICE 'Triggers créés: auto-numérotation et update_updated_at';
    RAISE NOTICE 'Tarifs par défaut: ~24 tarifs insérés';
END $$;
