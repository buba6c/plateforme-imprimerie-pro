-- Ajout du paramètre global de mode sombre (par défaut)
INSERT INTO system_config (key, value)
VALUES ('dark_mode', '{"enabled": false}')
ON CONFLICT (key) DO NOTHING;
