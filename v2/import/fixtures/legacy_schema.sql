-- =============================================================================
-- EvocomPrint (legacy) : schéma PostgreSQL de PRODUCTION reconstruit
-- -----------------------------------------------------------------------------
-- Fixture de test (et base de travail pour l'importeur v2).
-- Ce fichier N'EST PAS un script de migration : il REMPLACE tout le schéma public.
--
-- Sources combinées (cf. audit B §1-§3) :
--   [SQL-VPS]  backend/database/init.sql
--              backend/database/fix-all-issues.sql
--              backend/database/migrations/002_devis_facturation_postgresql.sql
--              backend/database/migrations/create_themes_table.sql
--              backend/database/migrations/add_sections_and_amount.sql
--              backend/database/migrations/add-description-telephone.js
--   [SQL-main] colonnes/tables créées uniquement par des scripts de origin/main
--              (fix-schema-manuel.sql, add_payment_system.sql, system_config…)
--   [CODE]     colonnes/tables utilisées par le code atteignable mais créées par
--              AUCUN script (ajoutées à la main en prod) : types inférés.
--
-- Choix assumés (le vrai schéma de prod n'est pas observable) :
--   * dossiers.statut : CHECK mixte snake_case + libellés français (18 valeurs,
--     dernier état connu = commit 8830971). Le seed ajoute des lignes héritées
--     ('nouveau') puis repose la contrainte en NOT VALID, comme en prod.
--   * fichiers : les DEUX familles de colonnes coexistent (nom_original/... et
--     nom/chemin/...) ; les NOT NULL de init.sql sont relâchés, sinon l'un des
--     deux chemins d'insertion échoue.
--   * factures.dossier_id reste VARCHAR(36) (seule DDL existante) : il reçoit
--     tantôt un folder_id UUID, tantôt un id entier en texte. Conséquence
--     reproduite : les jointures `d.id = f.dossier_id` de routes/paiements.js
--     échouent (42883) sur cette base, comme elles échoueraient en prod si la
--     colonne n'a pas été retypée.
--   * paiements.dossier_id : INTEGER (la jointure sans cast `p.dossier_id = d.id`
--     de la liste des dossiers fonctionne en prod).
--   * dossier_activity_log.dossier_id : VARCHAR(64) (reçoit l'id entier, sauf
--     'file_deleted' qui reçoit le folder_id UUID).
--   * Vues v_devis_complet / v_factures_complet corrigées : `u.username`
--     n'existe pas, remplacé par `u.nom AS username`.
--   * Aucun trigger [SQL-main] dangereux (add_status_history,
--     create_paiement_trigger…) : présence en prod inconnue.
-- =============================================================================

SET client_min_messages = warning;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO PUBLIC;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- init.sql (uuid_generate_v4)

-- =============================================================================
-- Types ENUM (002_devis_facturation_postgresql.sql)
-- =============================================================================
CREATE TYPE machine_type         AS ENUM ('roland', 'xerox');
CREATE TYPE statut_devis         AS ENUM ('brouillon', 'en_attente', 'valide', 'refuse', 'converti');
CREATE TYPE mode_paiement_type   AS ENUM ('wave', 'orange_money', 'virement', 'cheque', 'especes');
CREATE TYPE statut_paiement_type AS ENUM ('non_paye', 'paye', 'partiellement_paye', 'annule');
CREATE TYPE type_machine_tarif   AS ENUM ('roland', 'xerox', 'global');
CREATE TYPE test_status_type     AS ENUM ('success', 'failed', 'pending');

-- =============================================================================
-- users
-- =============================================================================
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    uuid          UUID DEFAULT uuid_generate_v4() UNIQUE,
    nom           VARCHAR(255) NOT NULL,              -- contient « prénom nom »
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL
                  CHECK (role IN ('admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox', 'livreur')),
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [CODE] routes/auth.js:119, services/statistiques.js:316
    last_login    TIMESTAMP,
    -- [CODE] routes/themes.js:77,105
    prenom        VARCHAR(100)
);

-- =============================================================================
-- dossiers (table centrale)
-- =============================================================================
CREATE TABLE dossiers (
    -- init.sql
    id               SERIAL PRIMARY KEY,
    numero           VARCHAR(50) UNIQUE NOT NULL,
    client           VARCHAR(255) NOT NULL,
    -- CHECK assoupli (casse brute écrite par le code : 'roland' / 'Roland')
    type_formulaire  VARCHAR(50)
                     CONSTRAINT dossiers_type_formulaire_check
                     CHECK (type_formulaire IN ('roland', 'xerox', 'Roland', 'Xerox') OR type_formulaire IS NULL),
    -- fix-all-issues.sql : VARCHAR(100) ; CHECK mixte (voir plus bas)
    statut           VARCHAR(100) NOT NULL DEFAULT 'en_cours',
    preparateur_id   INTEGER REFERENCES users(id),
    imprimeur_id     INTEGER REFERENCES users(id),       -- jamais écrit
    livreur_id       INTEGER REFERENCES users(id),       -- jamais écrit
    data_formulaire  JSONB,
    commentaire      TEXT,
    date_reception   DATE DEFAULT CURRENT_DATE,
    date_impression  DATE,                               -- morte
    date_livraison   DATE,
    mode_paiement    VARCHAR(50),
    montant_cfa      DECIMAL(10,2),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- fix-all-issues.sql
    folder_id                   UUID DEFAULT gen_random_uuid(),   -- ni UNIQUE ni NOT NULL côté VPS
    numero_commande             VARCHAR(100),
    valide_preparateur          BOOLEAN DEFAULT FALSE,
    date_validation_preparateur TIMESTAMP,
    commentaire_revision        TEXT,
    -- add-description-telephone.js
    telephone_client VARCHAR(20),
    description      TEXT,
    -- add_sections_and_amount.sql
    amount           DECIMAL(12,2) DEFAULT NULL,
    sections         JSONB DEFAULT '[]'::jsonb,
    supports         JSONB DEFAULT '[]'::jsonb,
    schema_version   INTEGER DEFAULT 1,
    -- [SQL-main] fix-schema-manuel.sql / complete_schema_update.sql / add_payment_system.sql
    machine               VARCHAR(50),                    -- 'Roland' / 'Xerox' (PUT uniquement)
    created_by            INTEGER REFERENCES users(id),   -- jamais écrit par le code VPS
    quantite              INTEGER DEFAULT 1,
    client_email          VARCHAR(255),
    client_telephone      VARCHAR(50),                    -- morte (le code écrit telephone_client)
    date_livraison_prevue DATE,
    date_livraison_reelle DATE,                           -- le code écrit CURRENT_TIMESTAMP : heure perdue
    revision_comment      TEXT,                           -- morte
    assigned_to           VARCHAR(50),                    -- morte
    statut_paiement       VARCHAR(20) DEFAULT 'non_paye'
                          CHECK (statut_paiement IN ('non_paye', 'paye', 'approuve_admin')),
    commentaires          TEXT,                           -- PUT /dossiers/:id (≠ commentaire)
    -- [CODE] aucune DDL dans aucune branche
    urgent                    BOOLEAN DEFAULT false,
    adresse_livraison         TEXT,
    notes_livraison           TEXT,
    mode_paiement_final       VARCHAR(50),                -- inclut 'a_la_livraison'
    derniere_relance_paiement TIMESTAMP,
    commentaire_report        TEXT
);

-- Dernier état connu de la contrainte (commit 8830971) : 9 snake_case + 9 français
ALTER TABLE dossiers ADD CONSTRAINT dossiers_statut_check CHECK (statut IN (
    'en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'imprime',
    'pret_livraison', 'en_livraison', 'livre', 'termine',
    'En cours', 'À revoir', 'Prêt impression', 'En impression', 'Imprimé',
    'Prêt livraison', 'En livraison', 'Livré', 'Terminé'
));

COMMENT ON COLUMN dossiers.amount   IS 'Montant facultatif en CFA - Visible Admin/Préparateur/Livreur, masqué Imprimeurs';
COMMENT ON COLUMN dossiers.sections IS 'Sections dynamiques Xerox : [{id, type, mode_impression, copies, paper_types: [{grammage, type, format, couleur, pages}], finitions[], faconnage[]}]';
COMMENT ON COLUMN dossiers.supports IS 'Supports Roland : [{id, type_support, largeur, hauteur, unite, exemplaires, finitions}]';
COMMENT ON COLUMN dossiers.schema_version IS 'Version du schéma (1=legacy, 2=avec sections) pour rétro-compatibilité';

-- Séquence des numéros de commande (CMD-AAAA-NNNN) : [SQL-main] fix-schema-manuel.sql
CREATE SEQUENCE numero_commande_seq START 1;

-- =============================================================================
-- fichiers : deux familles de colonnes
-- =============================================================================
CREATE TABLE fichiers (
    id              SERIAL PRIMARY KEY,
    dossier_id      INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    -- famille « init.sql » (routes/files.js : upload, chunked) ; NOT NULL relâchés
    nom_original    VARCHAR(255),
    nom_fichier     VARCHAR(255),
    type_mime       VARCHAR(100),
    taille_bytes    INTEGER,                 -- plafond 2 Gio
    chemin_stockage VARCHAR(500),            -- 'uploads/dossiers/<id>/<ts>_<nom>' (parfois absolu)
    uploaded_by     INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [SQL-main] fix-schema-manuel.sql
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- famille « nom/chemin » (routes/dossiers.js POST /:id/fichiers) : schema-nouvelle-structure.sql
    nom             VARCHAR(255),
    chemin          TEXT,                    -- 'uploads/<id>/<fichier>' alors que le disque a uploads/dossiers/<folder_id>/
    type            VARCHAR(50),             -- 'image' | 'document' (pas un MIME)
    taille          INTEGER,
    mime_type       VARCHAR(100),
    extension       VARCHAR(10),
    checksum        VARCHAR(64)
);

-- =============================================================================
-- Historique des statuts
-- =============================================================================
-- init.sql (table legacy, libellés français dans nouveau_statut)
CREATE TABLE historique_statuts (
    id             SERIAL PRIMARY KEY,
    dossier_id     INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
    ancien_statut  VARCHAR(50),
    nouveau_statut VARCHAR(50) NOT NULL,
    user_id        INTEGER REFERENCES users(id),
    commentaire    TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- [SQL-main] fix-schema-manuel.sql + colonne `comment` écrite par le code
-- (routes/dossiers.js:1756,2120,2675) et définie par aucun script.
CREATE TABLE dossier_status_history (
    id         SERIAL PRIMARY KEY,
    dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes      TEXT,
    folder_id  UUID,
    comment    TEXT                         -- [CODE]
);

-- [CODE] aucune DDL : colonnes inférées de middleware/permissions.js:431
CREATE TABLE dossier_activity_log (
    id         SERIAL PRIMARY KEY,
    dossier_id VARCHAR(64),                 -- id entier OU folder_id UUID (file_deleted)
    user_id    INTEGER,                     -- pas de FK : les logs survivent aux suppressions
    action     VARCHAR(50) NOT NULL,        -- created, updated, status_changed, file_uploaded, file_deleted, deleted
    details    TEXT,                        -- JSON.stringify(...)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- [SQL-main] autoFixSchema.js / fix-schema-manuel.sql
CREATE TABLE dossier_formulaires (
    id              SERIAL PRIMARY KEY,
    dossier_id      INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    type_formulaire VARCHAR(50) NOT NULL,   -- casse brute
    details         JSONB NOT NULL,
    date_saisie     TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Devis / factures / paiements / tarifs / OpenAI (002_devis_facturation_postgresql.sql)
-- =============================================================================
CREATE TABLE devis (
    id                  SERIAL PRIMARY KEY,
    numero              VARCHAR(50) UNIQUE NOT NULL,
    user_id             INTEGER NOT NULL,
    machine_type        machine_type NOT NULL,
    data_json           TEXT NOT NULL,
    prix_estime         DECIMAL(10,2) DEFAULT NULL,
    prix_final          DECIMAL(10,2) DEFAULT NULL,
    details_prix        TEXT DEFAULT NULL,
    client_nom          VARCHAR(255) DEFAULT NULL,
    client_contact      VARCHAR(255) DEFAULT NULL,
    statut              statut_devis DEFAULT 'brouillon',
    converted_folder_id VARCHAR(36) DEFAULT NULL,
    notes               TEXT DEFAULT NULL,
    commentaire_refus   TEXT DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at        TIMESTAMP NULL DEFAULT NULL,
    converted_at        TIMESTAMP NULL DEFAULT NULL,
    -- [CODE] routes/devis.js:686-722, services/conversionService.js:103
    numero_devis        VARCHAR(50),
    client_email        VARCHAR(255),
    product_type        VARCHAR(100),
    details             TEXT,
    items_json          TEXT,
    source              VARCHAR(50),
    dossier_id          INTEGER
);

CREATE TABLE factures (
    id               SERIAL PRIMARY KEY,
    numero           VARCHAR(50) UNIQUE NOT NULL,
    dossier_id       VARCHAR(36) NOT NULL,    -- folder_id UUID ou id entier en texte
    user_id          INTEGER NOT NULL,
    montant_ht       DECIMAL(10,2) DEFAULT NULL,
    montant_tva      DECIMAL(10,2) DEFAULT NULL,
    montant_ttc      DECIMAL(10,2) NOT NULL,
    client_nom       VARCHAR(255) NOT NULL,
    client_contact   VARCHAR(255) DEFAULT NULL,
    client_adresse   TEXT DEFAULT NULL,
    mode_paiement    mode_paiement_type DEFAULT 'especes',
    statut_paiement  statut_paiement_type DEFAULT 'non_paye',
    date_paiement    TIMESTAMP NULL DEFAULT NULL,
    pdf_path         VARCHAR(500) DEFAULT NULL,   -- chemin ABSOLU (services/pdfService.js)
    pdf_generated_at TIMESTAMP NULL DEFAULT NULL,
    notes            TEXT DEFAULT NULL,
    details_json     TEXT DEFAULT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [CODE] routes/devis.js:479
    devis_id         INTEGER
);

-- [CODE] forme réelle utilisée par routes/paiements.js (toutes les DDL du dépôt sont incompatibles)
-- statut : 'en_attente' | 'encaisse_livreur' | 'approuve' | 'refuse'  ;  type : 'facture' | 'dossier'
CREATE TABLE paiements (
    id                  SERIAL PRIMARY KEY,
    dossier_id          INTEGER,               -- sans FK ; create-from-dossier y pousse un UUID (échec 22P02)
    facture_id          INTEGER,
    user_id             INTEGER,
    livreur_id          INTEGER,
    montant             DECIMAL(10,2),
    mode_paiement       VARCHAR(50),
    mode_paiement_final VARCHAR(50),
    reference_paiement  VARCHAR(255),
    notes               TEXT,
    type                VARCHAR(20) DEFAULT 'dossier',
    statut              VARCHAR(30) DEFAULT 'en_attente',
    date_paiement       TIMESTAMP,
    date_approbation    TIMESTAMP,
    date_encaissement   TIMESTAMP,
    approuve_par        INTEGER,
    notes_admin         TEXT,                  -- lu (paiements.js:72)
    commentaire_admin   TEXT,                  -- écrit (paiements.js:257)
    date_refus          TIMESTAMP,
    refuse_par          INTEGER,
    raison_refus        TEXT,
    photo_recu_path     VARCHAR(500),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tarifs_config (
    id           SERIAL PRIMARY KEY,
    type_machine type_machine_tarif NOT NULL,
    categorie    VARCHAR(100) NOT NULL,
    cle          VARCHAR(100) NOT NULL,
    label        VARCHAR(255) NOT NULL,
    valeur       DECIMAL(10,2) NOT NULL,        -- lu par les estimateurs
    unite        VARCHAR(50) DEFAULT NULL,
    description  TEXT DEFAULT NULL,
    actif        BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [CODE] écrit par l'écran admin (routes/tarifs.js:46), jamais lu par les estimateurs
    prix_unitaire DECIMAL(10,2),
    UNIQUE (type_machine, categorie, cle)
);

CREATE TABLE openai_config (
    id                      SERIAL PRIMARY KEY,
    api_key_encrypted       TEXT DEFAULT NULL,      -- morte
    api_key_iv              VARCHAR(100) DEFAULT NULL,  -- morte
    is_active               BOOLEAN DEFAULT FALSE,
    knowledge_base_text     TEXT DEFAULT NULL,
    knowledge_base_pdf_path VARCHAR(500) DEFAULT NULL,
    knowledge_base_pdf_name VARCHAR(255) DEFAULT NULL,
    knowledge_base_pdf_size INTEGER DEFAULT NULL,
    total_requests          INTEGER DEFAULT 0,
    last_request_at         TIMESTAMP NULL DEFAULT NULL,
    last_test_at            TIMESTAMP NULL DEFAULT NULL,
    last_test_status        test_status_type DEFAULT 'pending',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- [CODE] clé EN CLAIR (routes/openai-config.js:68, services/openaiService.js:100-107)
    api_key                 TEXT
);

CREATE TABLE devis_historique (
    id             SERIAL PRIMARY KEY,
    devis_id       INTEGER NOT NULL,
    user_id        INTEGER NOT NULL,
    action         VARCHAR(50) NOT NULL,
    ancien_statut  VARCHAR(50) DEFAULT NULL,
    nouveau_statut VARCHAR(50) DEFAULT NULL,
    details_json   TEXT DEFAULT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Thèmes (create_themes_table.sql)
-- =============================================================================
CREATE TABLE themes (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    colors       JSONB NOT NULL,
    is_custom    BOOLEAN DEFAULT true,
    is_active    BOOLEAN DEFAULT true,
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_theme_preferences (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);

-- =============================================================================
-- system_config ([SQL-main] 20250930_add_system_config_table.sql)
-- =============================================================================
CREATE TABLE system_config (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- Index
-- =============================================================================
CREATE INDEX idx_dossiers_statut          ON dossiers(statut);
CREATE INDEX idx_dossiers_type            ON dossiers(type_formulaire);
CREATE INDEX idx_dossiers_preparateur     ON dossiers(preparateur_id);
CREATE INDEX idx_dossiers_imprimeur       ON dossiers(imprimeur_id);
CREATE INDEX idx_dossiers_livreur         ON dossiers(livreur_id);
CREATE INDEX idx_dossiers_preparateur_id  ON dossiers(preparateur_id);
CREATE INDEX idx_dossiers_type_formulaire ON dossiers(type_formulaire);
CREATE INDEX idx_dossiers_created_at      ON dossiers(created_at DESC);
CREATE INDEX idx_dossiers_folder_id       ON dossiers(folder_id);
CREATE INDEX idx_dossiers_sections        ON dossiers USING GIN (sections);
CREATE INDEX idx_dossiers_supports        ON dossiers USING GIN (supports);
CREATE INDEX idx_dossiers_statut_paiement ON dossiers(statut_paiement);
CREATE INDEX idx_fichiers_dossier         ON fichiers(dossier_id);
CREATE INDEX idx_historique_dossier       ON historique_statuts(dossier_id);
CREATE INDEX idx_status_history_dossier_id      ON dossier_status_history(dossier_id);
CREATE INDEX idx_dossier_formulaires_dossier_id ON dossier_formulaires(dossier_id);

CREATE INDEX idx_devis_user_id          ON devis(user_id);
CREATE INDEX idx_devis_statut           ON devis(statut);
CREATE INDEX idx_devis_machine_type     ON devis(machine_type);
CREATE INDEX idx_devis_converted_folder ON devis(converted_folder_id);
CREATE INDEX idx_devis_created_at       ON devis(created_at);
CREATE INDEX idx_factures_dossier_id      ON factures(dossier_id);
CREATE INDEX idx_factures_user_id         ON factures(user_id);
CREATE INDEX idx_factures_statut_paiement ON factures(statut_paiement);
CREATE INDEX idx_factures_created_at      ON factures(created_at);
CREATE INDEX idx_factures_mode_paiement   ON factures(mode_paiement);
CREATE INDEX idx_tarifs_type_machine ON tarifs_config(type_machine);
CREATE INDEX idx_tarifs_categorie    ON tarifs_config(categorie);
CREATE INDEX idx_tarifs_actif        ON tarifs_config(actif);
CREATE INDEX idx_historique_devis_id   ON devis_historique(devis_id);
CREATE INDEX idx_historique_user_id    ON devis_historique(user_id);
CREATE INDEX idx_historique_action     ON devis_historique(action);
CREATE INDEX idx_historique_created_at ON devis_historique(created_at);
CREATE INDEX idx_themes_name       ON themes(name);
CREATE INDEX idx_themes_custom     ON themes(is_custom);
CREATE INDEX idx_themes_active     ON themes(is_active);
CREATE INDEX idx_themes_created_by ON themes(created_by);
CREATE INDEX idx_user_theme_user_id    ON user_theme_preferences(user_id);
CREATE INDEX idx_user_theme_theme_name ON user_theme_preferences(theme_name);

-- =============================================================================
-- Fonctions et triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at    BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dossiers_updated_at BEFORE UPDATE ON dossiers      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devis_updated_at    BEFORE UPDATE ON devis         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON factures      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tarifs_updated_at   BEFORE UPDATE ON tarifs_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_openai_updated_at   BEFORE UPDATE ON openai_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Numérotation auto devis / factures (MAX()+1 sans verrou : course possible, comme en prod)
CREATE OR REPLACE FUNCTION generate_devis_numero()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    next_num INTEGER;
BEGIN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
        year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 10) AS INTEGER)), 0) + 1
          INTO next_num
          FROM devis
         WHERE numero LIKE 'DEV-' || year_part || '-%';
        NEW.numero := 'DEV-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_numero_devis BEFORE INSERT ON devis FOR EACH ROW EXECUTE FUNCTION generate_devis_numero();

CREATE OR REPLACE FUNCTION generate_facture_numero()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    next_num INTEGER;
BEGIN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
        year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 10) AS INTEGER)), 0) + 1
          INTO next_num
          FROM factures
         WHERE numero LIKE 'FAC-' || year_part || '-%';
        NEW.numero := 'FAC-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_numero_facture BEFORE INSERT ON factures FOR EACH ROW EXECUTE FUNCTION generate_facture_numero();

-- Thèmes
CREATE OR REPLACE FUNCTION update_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_themes_updated_at
  BEFORE UPDATE ON themes FOR EACH ROW EXECUTE FUNCTION update_themes_updated_at();
CREATE TRIGGER trigger_update_user_theme_preferences_updated_at
  BEFORE UPDATE ON user_theme_preferences FOR EACH ROW EXECUTE FUNCTION update_themes_updated_at();

-- Sections / supports (add_sections_and_amount.sql)
CREATE OR REPLACE FUNCTION validate_sections_structure(sections_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  IF jsonb_typeof(sections_data) != 'array' THEN
    RETURN FALSE;
  END IF;
  IF jsonb_array_length(sections_data) = 0 THEN
    RETURN TRUE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- NB : jsonb_array_length lève une erreur si sections/supports n'est pas un tableau
-- (bloque alors tout UPDATE de la ligne) : comportement de prod conservé.
CREATE OR REPLACE FUNCTION update_schema_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.sections IS NOT NULL AND jsonb_array_length(NEW.sections) > 0) OR
     (NEW.supports IS NOT NULL AND jsonb_array_length(NEW.supports) > 0) THEN
    NEW.schema_version = 2;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_schema_version
  BEFORE INSERT OR UPDATE ON dossiers FOR EACH ROW EXECUTE FUNCTION update_schema_version();

-- =============================================================================
-- Vues (corrigées : u.username n'existe pas dans users)
-- =============================================================================
CREATE OR REPLACE VIEW v_devis_complet AS
SELECT d.*, u.nom AS username, u.email, u.role
FROM devis d
LEFT JOIN users u ON d.user_id = u.id;

CREATE OR REPLACE VIEW v_factures_complet AS
SELECT f.*, u.nom AS username, u.email, u.role
FROM factures f
LEFT JOIN users u ON f.user_id = u.id;

CREATE OR REPLACE VIEW v_stats_devis_user AS
SELECT
    user_id,
    COUNT(*) AS total_devis,
    COUNT(CASE WHEN statut = 'brouillon'  THEN 1 END) AS brouillon,
    COUNT(CASE WHEN statut = 'en_attente' THEN 1 END) AS en_attente,
    COUNT(CASE WHEN statut = 'valide'     THEN 1 END) AS valide,
    COUNT(CASE WHEN statut = 'refuse'     THEN 1 END) AS refuse,
    COUNT(CASE WHEN statut = 'converti'   THEN 1 END) AS converti,
    SUM(prix_final) AS total_montant,
    MAX(created_at) AS dernier_devis
FROM devis
GROUP BY user_id;

-- add_sections_and_amount.sql (inutilisée, mais bloque tout DROP COLUMN sur dossiers)
CREATE OR REPLACE VIEW dossiers_with_amount AS
SELECT d.*,
       CASE WHEN d.amount IS NOT NULL THEN d.amount ELSE NULL END AS montant_visible
FROM dossiers d;

-- =============================================================================
-- Données de référence livrées par les scripts (thèmes, tarifs, config)
-- =============================================================================
INSERT INTO themes (name, display_name, colors, is_custom, created_by) VALUES
('light', 'Clair (Par défaut)',
 '{"primary":"#007bff","secondary":"#6c757d","success":"#22c55e","warning":"#f59e0b","error":"#ef4444","background":"#ffffff","surface":"#f9fafb","text":"#1f2937","textSecondary":"#6b7280","border":"#e5e7eb"}'::jsonb,
 false, NULL),
('dark', 'Sombre (Par défaut)',
 '{"primary":"#3b82f6","secondary":"#8b92a5","success":"#22c55e","warning":"#f59e0b","error":"#ef4444","background":"#111827","surface":"#1f2937","text":"#f9fafb","textSecondary":"#d1d5db","border":"#374151"}'::jsonb,
 false, NULL);

-- Ligne de configuration OpenAI par défaut (id = 1 : le code écrit toujours WHERE id = 1)
INSERT INTO openai_config (is_active) VALUES (FALSE);

-- Tarifs initiaux, tels que livrés par 002_devis_facturation_postgresql.sql:383-421
-- (le fichier annonce « ~24 tarifs », il en contient 23)
INSERT INTO tarifs_config (type_machine, categorie, cle, label, valeur, unite, description, actif) VALUES
('roland', 'support',  'bache_m2',              'Bâche standard',        7000.00, 'm²',      'Prix au m² pour impression bâche standard',   TRUE),
('roland', 'support',  'vinyle_m2',             'Vinyle adhésif',        9500.00, 'm²',      'Prix au m² pour impression vinyle adhésif',   TRUE),
('roland', 'support',  'papier_photo_m2',       'Papier photo',          8500.00, 'm²',      'Prix au m² pour impression papier photo',     TRUE),
('roland', 'support',  'toile_canvas_m2',       'Toile Canvas',         12000.00, 'm²',      'Prix au m² pour impression toile canvas',     TRUE),
('roland', 'finition', 'pelliculage',           'Pelliculage',           1500.00, 'm²',      'Pelliculage mat ou brillant',                 TRUE),
('roland', 'finition', 'vernis',                'Vernis sélectif',       2000.00, 'm²',      'Application de vernis sélectif',              TRUE),
('roland', 'finition', 'coupage_decoupe',       'Découpe à la forme',    3000.00, 'forfait', 'Découpe personnalisée',                       TRUE),
('roland', 'option',   'livraison',             'Livraison',             5000.00, 'forfait', 'Frais de livraison',                          TRUE),
('roland', 'option',   'montage',               'Montage/Installation', 10000.00, 'forfait', 'Montage et installation sur site',            TRUE),
('xerox',  'support',  'papier_a4_couleur',     'A4 Couleur',             100.00, 'page',    'Impression A4 couleur',                       TRUE),
('xerox',  'support',  'papier_a4_nb',          'A4 Noir & Blanc',         50.00, 'page',    'Impression A4 noir et blanc',                 TRUE),
('xerox',  'support',  'papier_a3_couleur',     'A3 Couleur',             200.00, 'page',    'Impression A3 couleur',                       TRUE),
('xerox',  'support',  'papier_a3_nb',          'A3 Noir & Blanc',        100.00, 'page',    'Impression A3 noir et blanc',                 TRUE),
('xerox',  'finition', 'reliure_spirale',       'Reliure spirale',        500.00, 'forfait', 'Reliure spirale métallique',                  TRUE),
('xerox',  'finition', 'reliure_thermique',     'Reliure thermique',      800.00, 'forfait', 'Reliure thermique',                           TRUE),
('xerox',  'finition', 'plastification',        'Plastification',         300.00, 'page',    'Plastification à chaud',                      TRUE),
('xerox',  'finition', 'perforation',           'Perforation',             50.00, 'page',    'Perforation 2 ou 4 trous',                    TRUE),
('xerox',  'option',   'papier_premium',        'Papier premium',          50.00, 'page',    'Supplément papier premium',                   TRUE),
('xerox',  'option',   'impression_recto_verso','Recto-verso',             20.00, 'page',    'Impression recto-verso',                      TRUE),
('global', 'divers',   'conception_graphique',  'Conception graphique', 15000.00, 'forfait', 'Création/modification de fichiers',           TRUE),
('global', 'divers',   'epreuve_numerique',     'Épreuve numérique',     2000.00, 'forfait', 'BAT numérique',                               TRUE),
('global', 'divers',   'urgence_24h',           'Urgence 24h',          10000.00, 'forfait', 'Traitement prioritaire sous 24h',             TRUE),
('global', 'divers',   'urgence_48h',           'Urgence 48h',           5000.00, 'forfait', 'Traitement prioritaire sous 48h',             TRUE);

-- [SQL-main] valeurs par défaut de system_config
INSERT INTO system_config (key, value) VALUES
('maintenance_mode', '{"enabled": false}'),
('dark_mode',        '{"enabled": false}');
