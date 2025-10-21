-- ============================================================================
-- ÉTAPE 2: CHARGER LES TARIFS - XEROX, ROLAND ET FINITIONS
-- ============================================================================

-- ========== TARIFS XEROX ==========
-- Format A4, N&B
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1, 100, 'NB', 'A4', 100);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (101, 500, 'NB', 'A4', 80);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (501, 1000, 'NB', 'A4', 70);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1001, 999999, 'NB', 'A4', 60);

-- Format A4, Couleur
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1, 100, 'COULEUR', 'A4', 200);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (101, 500, 'COULEUR', 'A4', 150);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (501, 1000, 'COULEUR', 'A4', 120);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1001, 999999, 'COULEUR', 'A4', 100);

-- Format A3, N&B
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1, 100, 'NB', 'A3', 150);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (101, 500, 'NB', 'A3', 120);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (501, 1000, 'NB', 'A3', 100);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1001, 999999, 'NB', 'A3', 80);

-- Format A3, Couleur
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1, 100, 'COULEUR', 'A3', 300);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (101, 500, 'COULEUR', 'A3', 250);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (501, 1000, 'COULEUR', 'A3', 200);
INSERT INTO tarifs_xerox (nb_pages_min, nb_pages_max, couleur, format, prix_par_page) VALUES (1001, 999999, 'COULEUR', 'A3', 150);

-- ========== TARIFS ROLAND ==========
-- Grand format, N&B
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('A2', 'NB', 5000);
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('A1', 'NB', 8000);
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('A0', 'NB', 12000);

-- Grand format, Couleur
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('A2', 'COULEUR', 10000);
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('A1', 'COULEUR', 15000);
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('A0', 'COULEUR', 25000);

-- Custom (par m2)
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('CUSTOM', 'NB', 1000);
INSERT INTO tarifs_roland (taille, couleur, prix_unitaire) VALUES ('CUSTOM', 'COULEUR', 2000);

-- ========== FINITIONS ==========
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Agrafage', 'RELIURE', 1000);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Pliage', 'FINITION', 500);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Découpe', 'FINITION', 800);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Pelliculage', 'FINITION', 2000);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Vernis', 'FINITION', 1500);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Reliure spirale', 'RELIURE', 2500);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Reliure brochée', 'RELIURE', 3000);
INSERT INTO finitions (nom, type, prix_unitaire) VALUES ('Estampage', 'FINITION', 1200);
