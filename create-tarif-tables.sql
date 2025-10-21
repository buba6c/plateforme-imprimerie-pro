-- Migration: Créer les tables tarifs pour l'IA

-- Table des tarifs Xerox
CREATE TABLE IF NOT EXISTS tarifs_xerox (
  id SERIAL PRIMARY KEY,
  nb_pages_min INTEGER NOT NULL,
  nb_pages_max INTEGER NOT NULL,
  couleur VARCHAR(50) NOT NULL, -- 'NB' ou 'COULEUR'
  format VARCHAR(10) NOT NULL,  -- 'A4', 'A3', etc
  prix_par_page DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tarifs Roland
CREATE TABLE IF NOT EXISTS tarifs_roland (
  id SERIAL PRIMARY KEY,
  taille VARCHAR(50) NOT NULL,  -- 'A2', 'A1', 'A0', 'CUSTOM'
  couleur VARCHAR(50) NOT NULL, -- 'NB' ou 'COULEUR'
  prix_unitaire DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des finitions
CREATE TABLE IF NOT EXISTS finitions (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,   -- 'RELIURE', 'FINITION', etc
  prix_unitaire DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer les indices pour performance
CREATE INDEX IF NOT EXISTS idx_tarifs_xerox_couleur ON tarifs_xerox(couleur);
CREATE INDEX IF NOT EXISTS idx_tarifs_xerox_format ON tarifs_xerox(format);
CREATE INDEX IF NOT EXISTS idx_tarifs_roland_couleur ON tarifs_roland(couleur);
CREATE INDEX IF NOT EXISTS idx_tarifs_roland_taille ON tarifs_roland(taille);
CREATE INDEX IF NOT EXISTS idx_finitions_type ON finitions(type);
