-- Mise à jour des mots de passe pour les comptes de test EvocomPrint

UPDATE users SET password_hash = '$2b$10$8belAqZWAXtl5ciwGJEmgu0QAShyBwayFEzIrjhiHddiW4Ox4orI6' WHERE email = 'preparateur@evocomprint.com';
UPDATE users SET password_hash = '$2b$10$uaM3zwLoBXDFb7PVarQAQezhIqlIHwf8xhILFZCucIbuxbfsCpTRa' WHERE email = 'roland@evocomprint.com';
UPDATE users SET password_hash = '$2b$10$p.py7SiN4q1r4FNwNUkAzuzlg1p26aZRbhIGGVdCDq8pClnv76pZy' WHERE email = 'xerox@evocomprint.com';
UPDATE users SET password_hash = '$2b$10$R0cQKf.u1cadN9BK3zEZzuFT8hDwjcpQ7Oca9dgCj2gvJUjkh5mza' WHERE email = 'livreur@evocomprint.com';
