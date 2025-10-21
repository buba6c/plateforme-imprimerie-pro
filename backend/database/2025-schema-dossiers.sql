-- Nouvelle structure pour la gestion des dossiers et fichiers
-- Utilise UUID pour les identifiants

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client VARCHAR(255) NOT NULL,
  machine VARCHAR(50) CHECK (machine IN ('Roland', 'Xerox')),
  statut VARCHAR(50) DEFAULT 'En cours', -- En cours, À revoir, En impression, Terminé, Livré
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fichiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID REFERENCES dossiers(id) ON DELETE CASCADE,
  nom VARCHAR(255),
  chemin TEXT,
  type VARCHAR(50),
  taille INT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dossiers_machine ON dossiers(machine);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut ON dossiers(statut);
CREATE INDEX IF NOT EXISTS idx_fichiers_dossier_id ON fichiers(dossier_id);
