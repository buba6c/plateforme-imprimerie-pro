/**
 * Routes pour l'Agent IA Intelligent
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Import de l'agent intelligent (gestion d'erreur si le fichier n'existe pas)
let intelligentAgent;
try {
  intelligentAgent = require('../services/intelligentAgentService');
} catch (e) {
  console.warn('⚠️  intelligentAgentService non chargé, fallback activé');
  intelligentAgent = {
    reflectiveAnalysis: () => ({ success: false, error: 'Service non disponible' }),
    buildContext: () => ({ xeroxTariffs: [], rolandTariffs: [], finitions: [] })
  };
}

// Import du pool PostgreSQL
const { pool } = require('../config/database');

/**
 * POST /api/ai-agent/analyze
 * Analyse intelligente d'une demande client avec réflexion multi-étapes
 */
router.post('/analyze', async (req, res) => {
  try {
    const { request, description, currentForm } = req.body;
    const text = description || request || '';

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Paramètre "request" ou "description" requis'
      });
    }

    console.log('📊 Analyse IA reçue:', text.substring(0, 100));

    // Appeler l'agent intelligent
    const analysis = await intelligentAgent.reflectiveAnalysis(
      text,
      currentForm || {}
    );

    // Logger la requête pour apprentissage (optionnel)
    if (analysis.success && req.user) {
      try {
        await logAIAnalysis(req.user.id, text, analysis);
      } catch (e) {
        console.warn('⚠️  Logging désactivé');
      }
    }

    res.json(analysis);

  } catch (error) {
    console.error('❌ Erreur route /analyze:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'analyse',
      message: error.message
    });
  }
});

/**
 * POST /api/ai-agent/refine
 * Affiner une proposition basée sur les modifications de l'utilisateur
 */
router.post('/refine', async (req, res) => {
  try {
    const { current_proposal, user_modifications, description } = req.body;

    // Analyser les modifications
    const refinement = await intelligentAgent.reflectiveAnalysis(
      `Demande originale: ${description}\n\nModifications utilisateur: ${JSON.stringify(user_modifications)}`,
      current_proposal
    );

    res.json(refinement);

  } catch (error) {
    console.error('❌ Erreur route /refine:', error);
    res.status(500).json({ error: 'Erreur lors du raffinement' });
  }
});

/**
 * GET /api/ai-agent/context
 * Obtenir le contexte tarifaire (pour analyse frontend)
 */
router.get('/context', async (req, res) => {
  try {
    const context = await intelligentAgent.buildContext();
    
    res.json({
      success: true,
      context: {
        xerox_tariffs_count: context.xeroxTariffs?.length || 0,
        roland_tariffs_count: context.rolandTariffs?.length || 0,
        finitions_count: context.finitions?.length || 0,
        recent_quotes: context.recentQuotes?.length || 0,
        success_patterns: context.successPatterns || []
      }
    });

  } catch (error) {
    console.error('❌ Erreur route /context:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du contexte' });
  }
});

/**
 * POST /api/ai-agent/feedback
 * Enregistrer le feedback utilisateur pour l'apprentissage
 */
router.post('/feedback', async (req, res) => {
  try {
    const { quote_id, proposal_accepted, user_feedback, actual_result } = req.body;
    const userId = req.user?.id || 1; // Fallback si pas auth

    if (!quote_id) {
      return res.status(400).json({ error: 'quote_id requis' });
    }

    try {
      await pool.query(`
        INSERT INTO ai_feedback_log (
          quote_id,
          user_id,
          proposal_accepted,
          feedback_score,
          feedback_notes,
          actual_result,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        quote_id,
        userId,
        proposal_accepted ? true : false,
        user_feedback?.score || 0,
        user_feedback?.notes || '',
        actual_result ? JSON.stringify(actual_result) : null,
      ]);
    } catch (dbError) {
      console.warn('⚠️  Impossible d\'enregistrer feedback en DB:', dbError.message);
    }

    res.json({ success: true, message: 'Feedback enregistré' });

  } catch (error) {
    console.error('❌ Erreur route /feedback:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du feedback' });
  }
});

/**
 * GET /api/ai-agent/performance
 * Obtenir les stats de performance de l'IA (admin)
 */
router.get('/performance', async (req, res) => {
  try {
    let stats = [];
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_analyses,
          COALESCE(SUM(CASE WHEN proposal_accepted THEN 1 ELSE 0 END), 0) as accepted,
          ROUND(AVG(CAST(feedback_score AS FLOAT)), 2) as average_score,
          DATE(created_at) as analysis_date
        FROM ai_feedback_log
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY analysis_date DESC
        LIMIT 30
      `);
      stats = result.rows || [];
    } catch (dbError) {
      console.warn('⚠️  Impossible de récupérer les stats:', dbError.message);
    }

    const accuracy = stats.length > 0 && stats[0].total_analyses > 0
      ? ((stats[0].accepted / stats[0].total_analyses) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      stats: {
        total_analyses: stats[0]?.total_analyses || 0,
        accepted_proposals: stats[0]?.accepted || 0,
        accuracy_percentage: accuracy,
        average_feedback_score: stats[0]?.average_score || 0,
        daily_breakdown: stats
      }
    });

  } catch (error) {
    console.error('❌ Erreur route /performance:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
  }
});

// ===== HELPERS =====

async function logAIAnalysis(userId, description, analysis) {
  try {
    if (!userId || !pool) return;

    await pool.query(`
      INSERT INTO ai_analysis_log (
        user_id,
        user_input,
        ai_thinking_process,
        ai_output,
        confidence_score,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      userId,
      description.substring(0, 500),
      analysis.thinking_process ? JSON.stringify(analysis.thinking_process) : null,
      analysis.final_recommendation ? JSON.stringify(analysis.final_recommendation) : null,
      analysis.confidence_score || 0.5
    ]);
  } catch (error) {
    console.error('⚠️ Erreur logging analyse IA:', error.message);
    // Ne pas bloquer si le logging échoue
  }
}

module.exports = router;
