-- Formulaire de commande enrichi et corrections de prix de l'audit du 8 octobre 2026.
--
-- Tarifs : sur une base déjà installée, les nouveaux codes sont créés SANS prix (l'administrateur
-- les renseigne dans Tarifs ; tant qu'un prix manque, le calcul s'arrête avec un message clair).
-- Une base neuve (table vide au moment de la migration) les reçoit de la grille de départ
-- (shared/src/tarifs-defaut.ts) au premier lancement : la liste ci-dessous doit rester alignée.
-- Les codes déjà présents (avec leur prix) ne sont jamais modifiés par l'ajout.

-- 1. Livraison commune aux deux machines : rangée en Roland, elle était introuvable pour un dossier Xerox.
UPDATE tarifs SET machine = 'global'
WHERE code = 'livraison' AND machine = 'roland'
  AND NOT EXISTS (SELECT 1 FROM tarifs WHERE code = 'livraison' AND machine = 'global');

-- 2. A3 : carte de visite importée en « divers » à l'unité (100 cartes facturées au prix d'une) :
--    support Xerox facturé par exemplaire, prix conservé.
UPDATE tarifs SET machine = 'xerox'
WHERE code = 'carte_visite' AND machine = 'global'
  AND NOT EXISTS (SELECT 1 FROM tarifs WHERE code = 'carte_visite' AND machine = 'xerox');
UPDATE tarifs
SET categorie = 'support',
    unite = CASE WHEN unite IN ('exemplaire', 'page', 'feuille') THEN unite ELSE 'exemplaire' END
WHERE code = 'carte_visite' AND machine = 'xerox'
  AND (categorie <> 'support' OR unite NOT IN ('exemplaire', 'page', 'feuille'));

-- 3. A5 : reliures et découpe à la forme comptées par exemplaire (l'ancienne plateforme comptait ainsi ;
--    au forfait, la saisie manuelle donnait 500 FCFA et l'assistant 10 000 FCFA pour le même travail).
UPDATE tarifs SET unite = 'exemplaire'
WHERE unite = 'forfait'
  AND ((machine = 'xerox' AND code IN ('reliure_spirale', 'reliure_thermique')) OR (machine = 'roland' AND code = 'coupage_decoupe'));

-- 4. Nouveaux codes du formulaire (sans prix).
INSERT INTO tarifs (machine, categorie, code, libelle, unite, prix, actif, ordre)
SELECT v.machine, v.categorie, v.code, v.libelle, v.unite, NULL, true,
       coalesce((SELECT max(t.ordre) FROM tarifs t), 0) + v.n
FROM (VALUES
  (1,  'roland', 'support',  'kakemono',             'Kakémono (structure comprise)', 'exemplaire'),
  (2,  'roland', 'finition', 'contrecollage_m2',     'Contrecollage PVC ou forex',    'm2'),
  (3,  'roland', 'finition', 'oeillets',             'Œillets',                       'unite'),
  (4,  'roland', 'finition', 'ourlet',               'Ourlet',                        'ml'),
  (5,  'roland', 'finition', 'collage',              'Collage des bords',             'ml'),
  (6,  'xerox',  'support',  'papier_a5_couleur',    'A5 couleur',                    'page'),
  (7,  'xerox',  'support',  'papier_a5_nb',         'A5 noir et blanc',              'page'),
  (8,  'xerox',  'support',  'papier_a6_couleur',    'A6 couleur',                    'page'),
  (9,  'xerox',  'support',  'papier_a6_nb',         'A6 noir et blanc',              'page'),
  (10, 'xerox',  'support',  'papier_sra3_couleur',  'SRA3 couleur',                  'page'),
  (11, 'xerox',  'support',  'papier_sra3_nb',       'SRA3 noir et blanc',            'page'),
  (12, 'xerox',  'support',  'papier_10x15_couleur', 'Photo 10 × 15',                 'page'),
  (13, 'xerox',  'support',  'papier_13x18_couleur', 'Photo 13 × 18',                 'page'),
  (14, 'xerox',  'support',  'papier_20x30_couleur', 'Photo 20 × 30',                 'page'),
  (15, 'xerox',  'support',  'carte_visite',         'Carte de visite',               'exemplaire'),
  (16, 'xerox',  'option',   'papier_couche_135',    'Papier couché 135 g',           'feuille'),
  (17, 'xerox',  'option',   'papier_couche_170',    'Papier couché 170 g',           'feuille'),
  (18, 'xerox',  'option',   'papier_carte_250_350', 'Papier carte 250 à 350 g',      'feuille'),
  (19, 'xerox',  'option',   'autocollant',          'Papier autocollant',            'feuille'),
  (20, 'xerox',  'option',   'papier_offset',        'Papier offset',                 'feuille'),
  (21, 'xerox',  'option',   'papier_grimat',        'Papier grimat',                 'feuille'),
  (22, 'xerox',  'finition', 'pelliculage_mat',      'Pelliculage mat',               'feuille'),
  (23, 'xerox',  'finition', 'pelliculage_brillant', 'Pelliculage brillant',          'feuille'),
  (24, 'xerox',  'finition', 'vernis_uv',            'Vernis UV',                     'feuille'),
  (25, 'xerox',  'finition', 'coupe',                'Coupe au format',               'forfait'),
  (26, 'xerox',  'finition', 'agrafage',             'Agrafage (piqûre)',             'exemplaire'),
  (27, 'xerox',  'finition', 'dos_carre_colle',      'Dos carré collé',               'exemplaire'),
  (28, 'xerox',  'finition', 'rainage_pliage',       'Rainage et pliage',             'exemplaire'),
  (29, 'xerox',  'finition', 'decoupe_forme',        'Découpe à la forme',            'exemplaire'),
  (30, 'xerox',  'finition', 'numerotation',         'Numérotation',                  'exemplaire'),
  (31, 'global', 'divers',   'correction_fichiers',  'Correction des fichiers',       'forfait')
) AS v(n, machine, categorie, code, libelle, unite)
WHERE EXISTS (SELECT 1 FROM tarifs)
ON CONFLICT (machine, code) DO NOTHING;

-- 5. Devis : mode de remise, adresse, délai de fabrication, acompte et conditions de paiement.
ALTER TABLE devis
  ADD COLUMN mode_remise text NOT NULL DEFAULT 'livraison' CHECK (mode_remise IN ('livraison', 'retrait')),
  ADD COLUMN adresse_livraison text,
  ADD COLUMN delai_jours integer CHECK (delai_jours IS NULL OR (delai_jours >= 0 AND delai_jours <= 365)),
  ADD COLUMN acompte_pourcent integer CHECK (acompte_pourcent IS NULL OR (acompte_pourcent >= 0 AND acompte_pourcent <= 100)),
  ADD COLUMN conditions_paiement text;
