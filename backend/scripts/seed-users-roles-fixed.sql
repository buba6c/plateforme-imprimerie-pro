-- Seed SQL conforme au schéma users (EvocomPrint)
-- Comptes de test avec emails et hash bcrypt

INSERT INTO users (nom, email, password_hash, role, is_active)
VALUES
('Admin', 'admin@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'admin', true),
('Preparateur', 'preparateur@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'preparateur', true),
('Roland', 'roland@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'imprimeur_roland', true),
('Xerox', 'xerox@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'imprimeur_xerox', true),
('Livreur', 'livreur@evocomprint.com', '$2b$10$xQr0k0aPOvHnIp5kOFVgM.qr7ZfZNQl5ZJgQLBNMJ4u7fB.Y4zBD2', 'livreur', true)
ON CONFLICT (email) DO NOTHING;

-- Les mots de passe sont tous "admin123" pour simplifier les tests.
-- À adapter si besoin pour chaque rôle.
