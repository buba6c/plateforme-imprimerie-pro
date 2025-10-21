-- 🏗️ NOUVELLE STRUCTURE BASE DE DONNÉES
-- =====================================
-- Suppression des anciennes tables pour reconstruction propre

-- Supprimer les anciennes tables si elles existent
DROP TABLE IF EXISTS fichiers CASCADE;
DROP TABLE IF EXISTS dossier_status_history CASCADE;  
DROP TABLE IF EXISTS dossiers CASCADE;

-- 📂 Table des dossiers avec UUID
CREATE TABLE dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client VARCHAR(255) NOT NULL,
  machine VARCHAR(50) CHECK (machine IN ('Roland', 'Xerox')),
  statut VARCHAR(50) DEFAULT 'En cours' CHECK (statut IN ('En cours', 'À revoir', 'En impression', 'Terminé', 'Livré')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Champs supplémentaires pour contexte métier
  numero_commande VARCHAR(100) UNIQUE,
  description TEXT,
  commentaires TEXT,
  quantite INTEGER DEFAULT 1,
  
  -- Informations client
  client_email VARCHAR(255),
  client_telephone VARCHAR(50),
  
  -- Informations livraison
  date_livraison_prevue DATE,
  date_livraison_reelle DATE,
  montant_paiement DECIMAL(10,2),
  mode_paiement VARCHAR(50),
  
  -- Métadonnées de workflow
  validé_preparateur BOOLEAN DEFAULT FALSE,
  date_validation_preparateur TIMESTAMP,
  commentaire_revision TEXT
);

-- 📄 Table des fichiers liés aux dossiers
CREATE TABLE fichiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
  nom VARCHAR(255) NOT NULL,
  chemin TEXT NOT NULL,
  type VARCHAR(50),
  taille INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  uploaded_by INTEGER REFERENCES users(id),
  
  -- Métadonnées fichiers
  mime_type VARCHAR(100),
  extension VARCHAR(10),
  checksum VARCHAR(64) -- Pour éviter les doublons
);

-- 📋 Table d'historique des changements de statut
CREATE TABLE dossier_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
  ancien_statut VARCHAR(50),
  nouveau_statut VARCHAR(50),
  commentaire TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 📊 Index pour performance
CREATE INDEX idx_dossiers_machine ON dossiers(machine);
CREATE INDEX idx_dossiers_statut ON dossiers(statut);
CREATE INDEX idx_dossiers_created_by ON dossiers(created_by);
CREATE INDEX idx_dossiers_created_at ON dossiers(created_at DESC);
CREATE INDEX idx_fichiers_dossier_id ON fichiers(dossier_id);
CREATE INDEX idx_status_history_dossier_id ON dossier_status_history(dossier_id);

-- 🔢 Séquence pour numéros de commande
CREATE SEQUENCE IF NOT EXISTS numero_commande_seq START 1000;

-- 📈 Fonction trigger pour mise à jour automatique updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 🎯 Trigger pour updated_at sur dossiers
CREATE TRIGGER update_dossiers_updated_at 
    BEFORE UPDATE ON dossiers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 🎯 Trigger pour historique automatique des changements de statut
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Seulement si le statut change réellement
    IF OLD.statut IS DISTINCT FROM NEW.statut THEN
        INSERT INTO dossier_status_history (dossier_id, ancien_statut, nouveau_statut, changed_by)
        VALUES (NEW.id, OLD.statut, NEW.statut, NEW.created_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_dossier_status_change 
    AFTER UPDATE ON dossiers 
    FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- ✅ Vérification de la structure
SELECT 'Tables créées avec succès:' as message;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('dossiers', 'fichiers', 'dossier_status_history');

-- 🎉 Structure prête pour les nouveaux workflows !
SELECT 'Base de données prête pour le nouveau système de gestion des dossiers!' as status;