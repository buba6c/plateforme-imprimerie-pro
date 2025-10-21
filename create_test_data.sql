-- 📊 CRÉATION DONNÉES DE TEST - CONFORMES CAHIER DES CHARGES
-- =========================================================

-- Nettoyer les données existantes
DELETE FROM dossiers;

-- Récupérer l'ID du préparateur (supposons ID = 2 pour preparateur@imprimerie.local)
-- Nous utiliserons un ID fixe pour simplifier

-- Insertion des 6 dossiers de test selon le cahier des charges
INSERT INTO dossiers (
  numero, client, type_formulaire, statut, preparateur_id, 
  data_formulaire, commentaire, quantite
) VALUES 

-- 🔧 DOSSIERS ROLAND
('WF-ROLAND-001', 'Café Central', 'roland', 'en_cours', 2, 
 '{"dimension": "100x70", "surface_m2": 7, "types_impression": ["Bâche"]}', 
 'Dossier test Roland en cours', 1),

('WF-ROLAND-002', 'Boulangerie Martin', 'roland', 'a_revoir', 2, 
 '{"dimension": "80x60", "surface_m2": 4.8, "types_impression": ["Vinyle"]}', 
 'Dossier à revoir - spécifications manquantes', 1),

('WF-ROLAND-003', 'Restaurant Gourmet', 'roland', 'en_impression', 2, 
 '{"dimension": "200x100", "surface_m2": 20, "types_impression": ["Bâche"]}', 
 'Dossier en cours d''impression', 1),

-- 🖨️ DOSSIERS XEROX  
('WF-XEROX-001', 'Bureau Conseil', 'xerox', 'termine', 2, 
 '{"format": "A4", "type_document": "Flyer", "nombre_exemplaires": 500, "type_papier": "150g"}', 
 'Dossier terminé, prêt livraison', 1),

('WF-XEROX-002', 'Clinique Santé', 'xerox', 'en_livraison', 2, 
 '{"format": "A3", "type_document": "Affiche", "nombre_exemplaires": 100, "type_papier": "200g"}', 
 'Dossier en cours de livraison', 1),

('WF-XEROX-003', 'École Primaire', 'xerox', 'livre', 2, 
 '{"format": "A4", "type_document": "Brochure", "nombre_exemplaires": 200, "type_papier": "120g"}', 
 'Dossier livré et archivé', 1);

-- Vérification des données créées
SELECT 
  'RÉSUMÉ DES DONNÉES CRÉÉES' as info,
  type_formulaire,
  statut,
  COUNT(*) as count
FROM dossiers 
GROUP BY type_formulaire, statut 
ORDER BY type_formulaire, statut;