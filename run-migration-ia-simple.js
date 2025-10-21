#!/usr/bin/env node

/**
 * Script d'exécution simple de migration PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'imprimerie_user',
  password: process.env.DB_PASSWORD || 'imprimerie_password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'imprimerie_db',
  ssl: false,
});

// Statements SQL séparés
const statements = [
  // Table 1: ai_analysis_log
  `CREATE TABLE IF NOT EXISTS ai_analysis_log (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    user_input TEXT NOT NULL,
    ai_thinking_process JSONB,
    ai_output JSONB,
    confidence_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Index pour ai_analysis_log
  `CREATE INDEX IF NOT EXISTS idx_ai_analysis_user ON ai_analysis_log(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_analysis_date ON ai_analysis_log(created_at)`,
  
  // Table 2: ai_feedback_log
  `CREATE TABLE IF NOT EXISTS ai_feedback_log (
    id SERIAL PRIMARY KEY,
    quote_id INT,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_accepted BOOLEAN DEFAULT false,
    feedback_score INT DEFAULT 0 CHECK (feedback_score >= 0 AND feedback_score <= 5),
    feedback_notes TEXT,
    actual_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Index pour ai_feedback_log
  `CREATE INDEX IF NOT EXISTS idx_ai_feedback_quote ON ai_feedback_log(quote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback_log(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_feedback_accepted ON ai_feedback_log(proposal_accepted)`,
  
  // Table 3: ai_success_patterns
  `CREATE TABLE IF NOT EXISTS ai_success_patterns (
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
  )`,
  
  // Index pour ai_success_patterns
  `CREATE INDEX IF NOT EXISTS idx_ai_patterns_machine ON ai_success_patterns(recommended_machine)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_patterns_confidence ON ai_success_patterns(confidence_score)`,
  
  // Table 4: ai_optimizations_applied
  `CREATE TABLE IF NOT EXISTS ai_optimizations_applied (
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
  )`,
  
  // Index pour ai_optimizations_applied
  `CREATE INDEX IF NOT EXISTS idx_ai_optimizations_quote ON ai_optimizations_applied(quote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_optimizations_user ON ai_optimizations_applied(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_optimizations_type ON ai_optimizations_applied(optimization_type)`,
  
  // Table 5: ai_decisions_log
  `CREATE TABLE IF NOT EXISTS ai_decisions_log (
    id SERIAL PRIMARY KEY,
    analysis_id INT REFERENCES ai_analysis_log(id) ON DELETE CASCADE,
    decision_point VARCHAR(255),
    possible_choices JSONB,
    chosen_option VARCHAR(255),
    reasoning TEXT,
    confidence FLOAT DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Index pour ai_decisions_log
  `CREATE INDEX IF NOT EXISTS idx_ai_decisions_analysis ON ai_decisions_log(analysis_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_decisions_point ON ai_decisions_log(decision_point)`,
  
  // Table 6: ai_client_preferences
  `CREATE TABLE IF NOT EXISTS ai_client_preferences (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES clients(id) ON DELETE CASCADE,
    preference_key VARCHAR(100),
    preference_value JSONB,
    learn_count INT DEFAULT 0,
    confidence FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Index pour ai_client_preferences
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_client_prefs_unique ON ai_client_preferences(client_id, preference_key)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_client_prefs_client ON ai_client_preferences(client_id)`,
  
  // Table 7: ai_alternative_recommendations
  `CREATE TABLE IF NOT EXISTS ai_alternative_recommendations (
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
  )`,
  
  // Index pour ai_alternative_recommendations
  `CREATE INDEX IF NOT EXISTS idx_ai_alternatives_analysis ON ai_alternative_recommendations(analysis_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_alternatives_ranking ON ai_alternative_recommendations(ranking)`,
  
  // Table 8: ai_context_cache
  `CREATE TABLE IF NOT EXISTS ai_context_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_value JSONB,
    cache_type VARCHAR(50),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Index pour ai_context_cache
  `CREATE INDEX IF NOT EXISTS idx_ai_cache_type ON ai_context_cache(cache_type)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_context_cache(expires_at)`,
  
  // Insert data
  `INSERT INTO ai_success_patterns (pattern_hash, user_input_pattern, recommended_machine, success_count, failure_count, confidence_score)
   VALUES ('xerox_bulk_order', 'Commande en grande quantité', 'xerox', 45, 5, 0.90)
   ON CONFLICT (pattern_hash) DO NOTHING`,
  
  `INSERT INTO ai_success_patterns (pattern_hash, user_input_pattern, recommended_machine, success_count, failure_count, confidence_score)
   VALUES ('roland_custom_print', 'Impression personnalisée', 'roland', 38, 7, 0.84)
   ON CONFLICT (pattern_hash) DO NOTHING`,
];

async function runMigration() {
  console.log('🔄 Démarrage de la migration PostgreSQL pour l\'IA intelligente...\n');
  
  try {
    // Test de connexion
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ Connexion établie: ${testResult.rows[0].current_time}\n`);
    
    let executedCount = 0;
    let skippedCount = 0;
    
    // Exécuter chaque statement
    for (const statement of statements) {
      try {
        const preview = statement.substring(0, 65).replace(/\n/g, ' ');
        process.stdout.write(`⏳ ${preview}... `);
        
        await pool.query(statement);
        executedCount++;
        console.log(`✅`);
        
      } catch (err) {
        // Les éléments existants ne sont pas une erreur
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate') ||
            err.code === '42P07' || err.code === '42710') {
          skippedCount++;
          console.log(`⚠️  (existe)`);
        } else {
          console.log(`❌ ${err.message}`);
        }
      }
    }
    
    console.log(`\n✅ Migration complétée!`);
    console.log(`   ✅ Exécutés: ${executedCount}`);
    console.log(`   ⚠️  Ignorés: ${skippedCount}\n`);
    
    // Vérifier les tables créées
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'ai_%'
      ORDER BY table_name
    `);
    
    console.log(`📊 Tables créées:`);
    checkResult.rows.forEach((row, idx) => {
      console.log(`   ✅ ${idx + 1}. ${row.table_name}`);
    });
    
    console.log(`\n🎉 Total: ${checkResult.rows.length} tables créées\n`);
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

// Exécuter
runMigration();
