-- Migration PostgreSQL: Ajout des tables pour l'IA Intelligente
-- Convertie de MySQL vers PostgreSQL
-- Date: 2025-10-18

-- ========================================
-- 1. TABLE: ai_analysis_log
-- ========================================
CREATE TABLE IF NOT EXISTS ai_analysis_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  ai_thinking_process JSONB,
  ai_output JSONB,
  confidence_score FLOAT DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_user ON ai_analysis_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_date ON ai_analysis_log(created_at);

-- ========================================
-- 2. TABLE: ai_feedback_log
-- ========================================
CREATE TABLE IF NOT EXISTS ai_feedback_log (
  id SERIAL PRIMARY KEY,
  quote_id INT,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposal_accepted BOOLEAN DEFAULT false,
  feedback_score INT DEFAULT 0 CHECK (feedback_score >= 0 AND feedback_score <= 5),
  feedback_notes TEXT,
  actual_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_quote ON ai_feedback_log(quote_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_accepted ON ai_feedback_log(proposal_accepted);

-- ========================================
-- 3. TABLE: ai_success_patterns
-- ========================================
CREATE TABLE IF NOT EXISTS ai_success_patterns (
  id SERIAL PRIMARY KEY,
  pattern_hash VARCHAR(255) UNIQUE NOT NULL,
  user_input_pattern TEXT,
  extracted_data JSONB,
  recommended_machine VARCHAR(50),
  success_count INT DEFAULT 1,
  failure_count INT DEFAULT 0,
  confidence_score FLOAT DEFAULT 0.5,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_patterns_machine ON ai_success_patterns(recommended_machine);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_confidence ON ai_success_patterns(confidence_score);

-- ========================================
-- 4. TABLE: ai_optimizations_applied
-- ========================================
CREATE TABLE IF NOT EXISTS ai_optimizations_applied (
  id SERIAL PRIMARY KEY,
  quote_id INT,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  optimization_type VARCHAR(100),
  optimization_description TEXT,
  before_config JSONB,
  after_config JSONB,
  estimated_cost_reduction DECIMAL(10, 2),
  actual_cost_reduction DECIMAL(10, 2),
  was_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_optimizations_quote ON ai_optimizations_applied(quote_id);
CREATE INDEX IF NOT EXISTS idx_ai_optimizations_user ON ai_optimizations_applied(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_optimizations_type ON ai_optimizations_applied(optimization_type);

-- ========================================
-- 5. TABLE: ai_decisions_log
-- ========================================
CREATE TABLE IF NOT EXISTS ai_decisions_log (
  id SERIAL PRIMARY KEY,
  analysis_id INT REFERENCES ai_analysis_log(id) ON DELETE CASCADE,
  decision_point VARCHAR(255),
  possible_choices JSONB,
  chosen_option VARCHAR(255),
  reasoning TEXT,
  confidence FLOAT DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_analysis ON ai_decisions_log(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_point ON ai_decisions_log(decision_point);

-- ========================================
-- 6. TABLE: ai_client_preferences
-- ========================================
CREATE TABLE IF NOT EXISTS ai_client_preferences (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id) ON DELETE CASCADE,
  preference_key VARCHAR(100),
  preference_value JSONB,
  learn_count INT DEFAULT 0,
  confidence FLOAT DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_client_prefs_unique ON ai_client_preferences(client_id, preference_key);
CREATE INDEX IF NOT EXISTS idx_ai_client_prefs_client ON ai_client_preferences(client_id);

-- ========================================
-- 7. TABLE: ai_alternative_recommendations
-- ========================================
CREATE TABLE IF NOT EXISTS ai_alternative_recommendations (
  id SERIAL PRIMARY KEY,
  analysis_id INT REFERENCES ai_analysis_log(id) ON DELETE CASCADE,
  alternative_name VARCHAR(255),
  alternative_description TEXT,
  alternative_spec JSONB,
  estimated_cost DECIMAL(10, 2),
  estimated_benefit JSONB,
  ranking INT,
  reason_for_ranking TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_alternatives_analysis ON ai_alternative_recommendations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_alternatives_ranking ON ai_alternative_recommendations(ranking);

-- ========================================
-- 8. TABLE: ai_context_cache
-- ========================================
CREATE TABLE IF NOT EXISTS ai_context_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  cache_value JSONB,
  cache_type VARCHAR(50),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_type ON ai_context_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_context_cache(expires_at);

-- ========================================
-- VUES SQL
-- ========================================

-- Vue: Statistiques IA
DROP VIEW IF EXISTS v_ai_statistics CASCADE;
CREATE VIEW v_ai_statistics AS
SELECT
  COUNT(DISTINCT user_id) as total_users,
  COUNT(*) as total_analyses,
  ROUND(AVG(confidence_score)::NUMERIC, 3) as avg_confidence,
  DATE_TRUNC('day', created_at)::DATE as analysis_date
FROM ai_analysis_log
GROUP BY DATE_TRUNC('day', created_at)::DATE
ORDER BY analysis_date DESC;

-- Vue: Top patterns réussis
DROP VIEW IF EXISTS v_top_ai_patterns CASCADE;
CREATE VIEW v_top_ai_patterns AS
SELECT
  pattern_hash,
  user_input_pattern,
  recommended_machine,
  success_count,
  failure_count,
  ROUND((success_count::FLOAT / NULLIF(success_count + failure_count, 0) * 100)::NUMERIC, 2) as success_percentage,
  confidence_score,
  last_used
FROM ai_success_patterns
WHERE success_count + failure_count > 0
ORDER BY confidence_score DESC
LIMIT 10;

-- ========================================
-- FONCTIONS SQL
-- ========================================

-- Fonction: Recalculer les scores de confiance
CREATE OR REPLACE FUNCTION recalculate_ai_confidence_scores()
RETURNS void AS $$
BEGIN
  UPDATE ai_analysis_log 
  SET confidence_score = (
    SELECT AVG(CAST(feedback_score AS FLOAT)) / 5.0 
    FROM ai_feedback_log 
    WHERE ai_feedback_log.quote_id = ai_analysis_log.id
  )
  WHERE id IN (SELECT DISTINCT quote_id FROM ai_feedback_log WHERE quote_id IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Fonction: Nettoyer les anciens logs
CREATE OR REPLACE FUNCTION cleanup_old_ai_logs(days_to_keep INT DEFAULT 90)
RETURNS void AS $$
BEGIN
  DELETE FROM ai_analysis_log 
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep
    AND id NOT IN (SELECT analysis_id FROM ai_decisions_log);
  
  DELETE FROM ai_context_cache
  WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- DONNÉES D'INITIALISATION
-- ========================================

INSERT INTO ai_success_patterns (pattern_hash, user_input_pattern, recommended_machine, success_count, failure_count, confidence_score)
VALUES 
  ('xerox_bulk_order', 'Commande en grande quantité', 'xerox', 45, 5, 0.90),
  ('roland_custom_print', 'Impression personnalisée', 'roland', 38, 7, 0.84),
  ('cost_optimization', 'Optimisation des coûts', 'any', 42, 10, 0.81)
ON CONFLICT (pattern_hash) DO NOTHING;

-- ========================================
-- CONFIRMATIONS
-- ========================================
SELECT 'Migration 009 PostgreSQL: Tables d''IA intelligente créées avec succès' as message;
