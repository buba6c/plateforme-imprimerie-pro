-- Script d'initialisation PostgreSQL pour Render
-- Exécuté automatiquement lors du premier déploiement

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- TABLES PRINCIPALES
-- ============================================================================

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des dossiers
CREATE TABLE IF NOT EXISTS dossiers (
    id SERIAL PRIMARY KEY,
    folder_id UUID UNIQUE DEFAULT uuid_generate_v4(),
    numero_commande VARCHAR(255) UNIQUE NOT NULL,
    client_nom VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_telephone VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'nouveau',
    priority VARCHAR(20) DEFAULT 'normale',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_livraison_prevue TIMESTAMP,
    date_livraison_reelle TIMESTAMP,
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    estimated_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de l'historique des statuts
CREATE TABLE IF NOT EXISTS dossier_status_history (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Table des fichiers
CREATE TABLE IF NOT EXISTS dossier_files (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(255),
    file_type VARCHAR(50),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Table des devis
CREATE TABLE IF NOT EXISTS devis (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    numero_devis VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    prix_unitaire DECIMAL(10,2),
    quantite INTEGER DEFAULT 1,
    prix_total DECIMAL(10,2),
    statut VARCHAR(50) DEFAULT 'en_attente',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_expiration TIMESTAMP,
    created_by UUID REFERENCES users(id),
    validated_by UUID REFERENCES users(id),
    validated_at TIMESTAMP
);

-- Table des paiements
CREATE TABLE IF NOT EXISTS paiements (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    devis_id INTEGER REFERENCES devis(id),
    montant DECIMAL(10,2) NOT NULL,
    methode_paiement VARCHAR(100),
    statut VARCHAR(50) DEFAULT 'en_attente',
    reference_transaction VARCHAR(255),
    date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- ============================================================================
-- INDEX POUR PERFORMANCE
-- ============================================================================

-- Index pour les dossiers
CREATE INDEX IF NOT EXISTS idx_dossiers_folder_id ON dossiers(folder_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_numero_commande ON dossiers(numero_commande);
CREATE INDEX IF NOT EXISTS idx_dossiers_status ON dossiers(status);
CREATE INDEX IF NOT EXISTS idx_dossiers_client_nom ON dossiers(client_nom);
CREATE INDEX IF NOT EXISTS idx_dossiers_created_at ON dossiers(created_at);

-- Index pour l'historique
CREATE INDEX IF NOT EXISTS idx_status_history_dossier_id ON dossier_status_history(dossier_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON dossier_status_history(changed_at);

-- Index pour les fichiers
CREATE INDEX IF NOT EXISTS idx_files_dossier_id ON dossier_files(dossier_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON dossier_files(uploaded_at);

-- Index pour les utilisateurs
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- TRIGGERS POUR MISE À JOUR AUTOMATIQUE
-- ============================================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_dossiers_updated_at BEFORE UPDATE ON dossiers
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- UTILISATEUR ADMINISTRATEUR PAR DÉFAUT
-- ============================================================================

-- Insérer un utilisateur admin par défaut (password: admin123)
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin',
    'admin@imprimerie.com',
    '$2b$10$rQJ9.CZGz4wKgJQxrHQoE.wHLg4Q/kP.YrZHMh5dLqTqYxD2MHnYu',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- DONNÉES DE TEST (optionnel pour développement)
-- ============================================================================

-- Insérer quelques dossiers de test si en mode développement
DO $$
BEGIN
    IF current_setting('server_version_num')::int >= 120000 THEN
        -- PostgreSQL 12+ syntax
        INSERT INTO dossiers (numero_commande, client_nom, client_email, description, status) 
        VALUES 
            ('CMD-2024-001', 'Entreprise ABC', 'contact@abc.com', 'Impression flyers', 'nouveau'),
            ('CMD-2024-002', 'Restaurant XYZ', 'resto@xyz.com', 'Cartes de menu', 'en_cours')
        ON CONFLICT (numero_commande) DO NOTHING;
    END IF;
END $$;