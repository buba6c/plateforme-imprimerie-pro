-- Configuration et données pour Render
-- Script exécuté après l'initialisation principale

-- ============================================================================
-- CONFIGURATION POSTGRESQL POUR RENDER
-- ============================================================================

-- Optimisation pour Render (limites de ressources)
ALTER SYSTEM SET shared_buffers = '32MB';
ALTER SYSTEM SET effective_cache_size = '128MB';
ALTER SYSTEM SET maintenance_work_mem = '16MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET seq_page_cost = 1.0;

-- Configuration pour les connexions limitées sur Render
ALTER SYSTEM SET max_connections = 20;
ALTER SYSTEM SET shared_preload_libraries = '';

-- ============================================================================
-- VUES UTILES POUR L'APPLICATION
-- ============================================================================

-- Vue pour les statistiques des dossiers
CREATE OR REPLACE VIEW dossier_stats AS
SELECT 
    status,
    COUNT(*) as count,
    AVG(final_price) as avg_price,
    SUM(final_price) as total_revenue
FROM dossiers 
WHERE final_price IS NOT NULL
GROUP BY status;

-- Vue pour les dossiers avec informations complètes
CREATE OR REPLACE VIEW dossiers_complets AS
SELECT 
    d.*,
    u_created.username as created_by_username,
    u_assigned.username as assigned_to_username,
    COUNT(f.id) as file_count,
    COUNT(dv.id) as devis_count,
    SUM(p.montant) as total_paid
FROM dossiers d
LEFT JOIN users u_created ON d.created_by = u_created.id
LEFT JOIN users u_assigned ON d.assigned_to = u_assigned.id
LEFT JOIN dossier_files f ON d.id = f.dossier_id AND f.is_active = true
LEFT JOIN devis dv ON d.id = dv.dossier_id
LEFT JOIN paiements p ON d.id = p.dossier_id AND p.statut = 'valide'
GROUP BY d.id, u_created.username, u_assigned.username;

-- ============================================================================
-- FONCTIONS UTILES
-- ============================================================================

-- Fonction pour générer un numéro de commande automatique
CREATE OR REPLACE FUNCTION generate_numero_commande()
RETURNS TEXT AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INTEGER;
    new_numero TEXT;
BEGIN
    year_prefix := 'CMD-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-';
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_commande FROM LENGTH(year_prefix) + 1) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM dossiers 
    WHERE numero_commande LIKE year_prefix || '%';
    
    new_numero := year_prefix || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN new_numero;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le prix total d'un devis
CREATE OR REPLACE FUNCTION calculate_devis_total(devis_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total DECIMAL(10,2);
BEGIN
    SELECT prix_unitaire * quantite
    INTO total
    FROM devis
    WHERE id = devis_id;
    
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DONNÉES DE CONFIGURATION
-- ============================================================================

-- Table de configuration de l'application
CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuration par défaut
INSERT INTO app_config (key, value, description) VALUES
    ('app_name', 'Plateforme Imprimerie', 'Nom de l''application'),
    ('max_file_size', '100', 'Taille maximale des fichiers en MB'),
    ('allowed_file_types', 'pdf,doc,docx,jpg,jpeg,png,gif', 'Types de fichiers autorisés'),
    ('default_status', 'nouveau', 'Statut par défaut des nouveaux dossiers'),
    ('workflow_enabled', 'true', 'Activation du workflow automatique'),
    ('email_notifications', 'false', 'Notifications par email'),
    ('render_environment', 'true', 'Indicateur environnement Render')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- PERMISSIONS ET SÉCURITÉ
-- ============================================================================

-- Révocation des permissions publiques par défaut
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- Accorder les permissions nécessaires à l'utilisateur de l'application
-- (Les permissions sont automatiquement accordées au propriétaire sur Render)

-- ============================================================================
-- LOGGING ET MONITORING
-- ============================================================================

-- Table pour les logs d'audit
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    record_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- NETTOYAGE AUTOMATIQUE (pour optimiser les performances sur Render)
-- ============================================================================

-- Fonction pour nettoyer les anciens logs (garde 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Programme de nettoyage (à exécuter manuellement ou via cron)
-- SELECT cleanup_old_logs();