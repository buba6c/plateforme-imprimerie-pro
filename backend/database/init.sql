-- Script d'initialisation de la base de données PostgreSQL
-- Plateforme d'Imprimerie Numérique

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des dossiers
CREATE TABLE dossiers (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL,
    client VARCHAR(255) NOT NULL,
    type_formulaire VARCHAR(50) NOT NULL CHECK (type_formulaire IN ('roland', 'xerox')),
    statut VARCHAR(50) NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'a_revoir', 'en_impression', 'termine', 'en_livraison', 'livre')),
    preparateur_id INTEGER REFERENCES users(id),
    imprimeur_id INTEGER REFERENCES users(id),
    livreur_id INTEGER REFERENCES users(id),
    data_formulaire JSONB,
    commentaire TEXT,
    date_reception DATE DEFAULT CURRENT_DATE,
    date_impression DATE,
    date_livraison DATE,
    mode_paiement VARCHAR(50),
    montant_cfa DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des fichiers
CREATE TABLE fichiers (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    nom_original VARCHAR(255) NOT NULL,
    nom_fichier VARCHAR(255) NOT NULL,
    type_mime VARCHAR(100) NOT NULL,
    taille_bytes INTEGER NOT NULL,
    chemin_stockage VARCHAR(500) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table d'historique des changements de statut
CREATE TABLE historique_statuts (
    id SERIAL PRIMARY KEY,
    dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    ancien_statut VARCHAR(50),
    nouveau_statut VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    commentaire TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_dossiers_statut ON dossiers(statut);
CREATE INDEX idx_dossiers_type ON dossiers(type_formulaire);
CREATE INDEX idx_dossiers_preparateur ON dossiers(preparateur_id);
CREATE INDEX idx_dossiers_imprimeur ON dossiers(imprimeur_id);
CREATE INDEX idx_dossiers_livreur ON dossiers(livreur_id);
CREATE INDEX idx_fichiers_dossier ON fichiers(dossier_id);
CREATE INDEX idx_historique_dossier ON historique_statuts(dossier_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dossiers_updated_at BEFORE UPDATE ON dossiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insérer les utilisateurs par défaut
INSERT INTO users (nom, email, password_hash, role) VALUES
('Administrateur', 'admin@imprimerie.local', '$2b$12$LQv3c1yqBTVHdkuoB2x7WeqBCz5gONvmvyHsRAyNzpQhpP3Q8TJpW', 'admin'), -- mot de passe: admin123
('Jean Préparateur', 'preparateur@imprimerie.local', '$2b$12$LQv3c1yqBTVHdkuoB2x7WeqBCz5gONvmvyHsRAyNzpQhpP3Q8TJpW', 'preparateur'), -- mot de passe: admin123
('Pierre Roland', 'roland@imprimerie.local', '$2b$12$LQv3c1yqBTVHdkuoB2x7WeqBCz5gONvmvyHsRAyNzpQhpP3Q8TJpW', 'imprimeur_roland'), -- mot de passe: admin123
('Marie Xerox', 'xerox@imprimerie.local', '$2b$12$LQv3c1yqBTVHdkuoB2x7WeqBCz5gONvmvyHsRAyNzpQhpP3Q8TJpW', 'imprimeur_xerox'), -- mot de passe: admin123
('Paul Livreur', 'livreur@imprimerie.local', '$2b$12$LQv3c1yqBTVHdkuoB2x7WeqBCz5gONvmvyHsRAyNzpQhpP3Q8TJpW', 'livreur'); -- mot de passe: admin123

-- Insérer un dossier de test
INSERT INTO dossiers (numero, client, type_formulaire, preparateur_id, data_formulaire) VALUES
('DOSS-001', 'Client Test', 'roland', 2, '{"surface_m2": 5, "type_impression": ["bache"], "dimension": "200x250cm", "finition": ["oeillet_colle"]}');

-- Afficher le résumé de l'initialisation
DO $$
DECLARE
    user_count INTEGER;
    dossier_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO dossier_count FROM dossiers;
    
    RAISE NOTICE 'Base de données initialisée avec succès !';
    RAISE NOTICE 'Utilisateurs créés: %', user_count;
    RAISE NOTICE 'Dossiers de test: %', dossier_count;
    RAISE NOTICE 'Tous les utilisateurs par défaut ont le mot de passe: admin123';
END $$;