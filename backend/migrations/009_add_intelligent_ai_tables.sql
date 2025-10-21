-- Migration: Tables d'Apprentissage et de Mémoire pour l'IA
-- Date: 2025-10-18
-- Description: Support du système d'apprentissage continu de l'IA

-- Table pour enregistrer les analyses IA
CREATE TABLE IF NOT EXISTS ai_analysis_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_input TEXT NOT NULL,
  ai_thinking_process JSON,
  ai_output JSON,
  confidence_score FLOAT DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_date (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table pour le feedback utilisateur
CREATE TABLE IF NOT EXISTS ai_feedback_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_id INT,
  user_id INT NOT NULL,
  proposal_accepted BOOLEAN DEFAULT false,
  feedback_score INT DEFAULT 0, -- 1-5
  feedback_notes TEXT,
  actual_result JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quote (quote_id),
  INDEX idx_user (user_id),
  INDEX idx_accepted (proposal_accepted),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table pour mémoriser les patterns réussis
CREATE TABLE IF NOT EXISTS ai_success_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pattern_hash VARCHAR(255) UNIQUE NOT NULL,
  user_input_pattern TEXT,
  extracted_data JSON,
  recommended_machine VARCHAR(50),
  success_count INT DEFAULT 1,
  failure_count INT DEFAULT 0,
  confidence_score FLOAT DEFAULT 0.5,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_machine (recommended_machine),
  INDEX idx_confidence (confidence_score)
);

-- Table pour les optimisations appliquées
CREATE TABLE IF NOT EXISTS ai_optimizations_applied (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_id INT,
  optimization_type VARCHAR(100), -- 'machine_switch', 'quantity_adjustment', 'material_change', 'timing'
  original_value JSON,
  optimized_value JSON,
  savings_amount DECIMAL(10, 2) DEFAULT 0,
  savings_percentage FLOAT DEFAULT 0,
  reasoning TEXT,
  user_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quote (quote_id),
  INDEX idx_type (optimization_type),
  INDEX idx_accepted (user_accepted)
);

-- Table pour les décisions de l'IA par catégorie
CREATE TABLE IF NOT EXISTS ai_decisions_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  decision_category VARCHAR(50), -- 'machine_choice', 'material_selection', 'quantity_optimization'
  user_context TEXT,
  ai_decision JSON,
  decision_confidence FLOAT,
  user_accepted BOOLEAN,
  actual_outcome JSON,
  feedback_score INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (decision_category),
  INDEX idx_accepted (user_accepted)
);

-- Table pour les recommandations alternatives
CREATE TABLE IF NOT EXISTS ai_alternative_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  base_recommendation_id INT,
  rank INT, -- 1 = primary, 2 = secondary, 3 = fallback
  alternative_machine VARCHAR(50),
  alternative_config JSON,
  reasoning TEXT,
  price_difference DECIMAL(10, 2),
  quality_score INT,
  lead_time_days INT,
  selected_by_user BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_base_recommendation (base_recommendation_id),
  INDEX idx_rank (rank)
);

-- Table pour les préférences d'IA par client
CREATE TABLE IF NOT EXISTS ai_client_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT,
  preferred_machine VARCHAR(50),
  preferred_quality_level VARCHAR(50), -- 'standard', 'premium', 'eco'
  typical_budget_min DECIMAL(10, 2),
  typical_budget_max DECIMAL(10, 2),
  preferred_lead_time INT, -- jours
  rejected_options JSON,
  success_rate FLOAT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client (client_id),
  UNIQUE KEY unique_client (client_id)
);

-- Table pour la cache de contexte tarifaire
CREATE TABLE IF NOT EXISTS ai_context_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE,
  tariff_data JSON,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  INDEX idx_expires (expires_at)
);

-- Créer des indices pour optimiser les recherches
CREATE INDEX idx_ai_analysis_user_date ON ai_analysis_log(user_id, created_at);
CREATE INDEX idx_ai_feedback_score ON ai_feedback_log(feedback_score, created_at);
CREATE INDEX idx_ai_optimization_type_date ON ai_optimizations_applied(optimization_type, created_at);
CREATE INDEX idx_ai_pattern_confidence ON ai_success_patterns(confidence_score, recommended_machine);

-- Procédure stockée pour calculer le score de confiance
DELIMITER //

CREATE PROCEDURE recalculate_ai_confidence_scores()
BEGIN
  UPDATE ai_success_patterns
  SET confidence_score = (
    SELECT 
      (success_count / (success_count + failure_count + 1)) * 100
    FROM ai_feedback_log
    WHERE pattern_hash = ai_success_patterns.pattern_hash
  )
  WHERE success_count > 0;
END //

DELIMITER ;

-- Procédure pour nettoyer les anciennes données
DELIMITER //

CREATE PROCEDURE cleanup_old_ai_logs(IN days_to_keep INT)
BEGIN
  DELETE FROM ai_analysis_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
  
  DELETE FROM ai_feedback_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
  
  DELETE FROM ai_decisions_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
END //

DELIMITER ;

-- Vue pour les statistiques IA
CREATE OR REPLACE VIEW v_ai_statistics AS
SELECT 
  DATE(created_at) as analysis_date,
  COUNT(*) as total_analyses,
  SUM(CASE WHEN proposal_accepted THEN 1 ELSE 0 END) as accepted_proposals,
  AVG(feedback_score) as avg_feedback_score,
  AVG(confidence_score) as avg_confidence_score
FROM ai_feedback_log
GROUP BY DATE(created_at)
ORDER BY analysis_date DESC;

-- Vue pour les patterns les plus utilisés
CREATE OR REPLACE VIEW v_top_ai_patterns AS
SELECT 
  pattern_hash,
  recommended_machine,
  success_count,
  failure_count,
  confidence_score,
  (success_count / (success_count + failure_count)) * 100 as success_rate,
  last_used
FROM ai_success_patterns
WHERE success_count >= 3
ORDER BY success_rate DESC, success_count DESC
LIMIT 50;

-- Ajouter des colonnes optionnelles si elles n'existent pas
ALTER TABLE devis 
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_confidence FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_reasoning JSON DEFAULT NULL;

-- Ajouter des colonnes optionnelles à la table commandes
ALTER TABLE commandes
ADD COLUMN IF NOT EXISTS ai_suggestion_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_feedback_provided BOOLEAN DEFAULT false;
