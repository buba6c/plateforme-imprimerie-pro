-- Ajoute une table pour stocker la configuration système (maintenance, quotas, etc.)
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insère la valeur par défaut pour le mode maintenance
INSERT INTO system_config (key, value)
VALUES ('maintenance_mode', '{"enabled": false}')
ON CONFLICT (key) DO NOTHING;
