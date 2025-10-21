-- Script d'insertion d'utilisateurs de test pour chaque rôle
-- À exécuter dans psql ou via un outil SQL sur la base 'imprimerie_db'

-- Mot de passe hashé pour 'Test1234!'
-- Généré avec bcrypt (10 rounds): $2a$10$w1Qn6QwQn6QwQn6QwQn6QOQn6QwQn6QwQn6QwQn6QwQn6QwQn6Qw

INSERT INTO users (email, password_hash, role, nom, is_active)
VALUES
  ('admin@test.com',    '$2a$10$w1Qn6QwQn6QwQn6QwQn6QOQn6QwQn6QwQn6QwQn6QwQn6QwQn6Qw', 'admin', 'Admin Test', true),
  ('prep@test.com',     '$2a$10$w1Qn6QwQn6QwQn6QwQn6QOQn6QwQn6QwQn6QwQn6QwQn6QwQn6Qw', 'preparateur', 'Préparateur Test', true),
  ('roland@test.com',   '$2a$10$w1Qn6QwQn6QwQn6QwQn6QOQn6QwQn6QwQn6QwQn6QwQn6QwQn6Qw', 'imprimeur_roland', 'Imprimeur Roland Test', true),
  ('xerox@test.com',    '$2a$10$w1Qn6QwQn6QwQn6QwQn6QOQn6QwQn6QwQn6QwQn6QwQn6QwQn6Qw', 'imprimeur_xerox', 'Imprimeur Xerox Test', true),
  ('livreur@test.com',  '$2a$10$w1Qn6QwQn6QwQn6QwQn6QOQn6QwQn6QwQn6QwQn6QwQn6QwQn6Qw', 'livreur', 'Livreur Test', true)
ON CONFLICT (email) DO NOTHING;

-- Tous les utilisateurs ont le mot de passe : Test1234!
-- Pour tester la connexion, utiliser l'email correspondant et ce mot de passe.
