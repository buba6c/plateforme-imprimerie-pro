const express = require('express');
const router = express.Router();
const dbHelper = require('../utils/dbHelper');
const { authenticateToken: auth, authorizeRoles } = require('../middleware/auth');

// GET /api/clients - Retourne tous les clients uniques avec d'importantes stats de CA
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 100, offset = 0, q = '' } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    let searchCondition = '';
    const params = [];
    
    // Si recherche active
    if (q) {
      searchCondition = 'AND INITCAP(LOWER(TRIM(client))) ILIKE $1';
      params.push(`%${q}%`);
    }

    const groupQuery = `
      SELECT 
        INITCAP(LOWER(TRIM(client))) as nom,
        COUNT(*) as total_dossiers,
        COUNT(CASE WHEN statut = 'livre' THEN 1 END) as dossiers_livres,
        SUM(
          COALESCE(
            NULLIF(CAST(NULLIF(regexp_replace(montant_cfa::text, '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(amount::text, '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'prix', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'prix_total', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'total', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'montant', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            0
          )
        ) as ca_genere,
        MAX(created_at) as dernier_dossier
      FROM dossiers
      WHERE client IS NOT NULL AND TRIM(client) != '' ${searchCondition}
      GROUP BY INITCAP(LOWER(TRIM(client)))
    `;

    // Wrapping for limit/offset and ordering safely
    const finalQuery = `
      ${groupQuery}
      ORDER BY ca_genere DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Combine params for execution
    const executionParams = [...params, limitNum, offsetNum];

    const [clients] = await dbHelper.query(finalQuery, executionParams);
    
    // Subquery for total count matching the search
    const countQuery = `
      SELECT COUNT(DISTINCT INITCAP(LOWER(TRIM(client)))) as total
      FROM dossiers
      WHERE client IS NOT NULL AND TRIM(client) != '' ${searchCondition}
    `;

    const [countResult] = await dbHelper.query(countQuery, params);
    
    let total = 0;
    if (countResult && countResult.rows && countResult.rows[0]) {
      total = parseInt(countResult.rows[0].total); // Postgres
    } else if (countResult && countResult.length > 0) {
      total = parseInt(countResult[0].total); // MySQL fallback
    }

    res.json({
      success: true,
      data: clients,
      total,
      has_more: offsetNum + limitNum < total
    });
  } catch (error) {
    console.error('Erreur GET /clients:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des clients.' });
  }
});

// GET /api/clients/search?q=... - Pour l'auto-complétion très rapide (Combobox)
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, data: [] });
    }

    const query = `
      SELECT DISTINCT INITCAP(LOWER(TRIM(client))) as nom
      FROM dossiers
      WHERE INITCAP(LOWER(TRIM(client))) ILIKE $1
      LIMIT 10
    `;

    const [clients] = await dbHelper.query(query, [`%${q.trim()}%`]);
    res.json({ success: true, data: clients.map(c => c.nom) });
  } catch (error) {
    console.error('Erreur GET /clients/search:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche du client' });
  }
});

// GET /api/clients/top - Meilleurs clients (Dashboard)
router.get('/top', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const query = `
      SELECT 
        INITCAP(LOWER(TRIM(client))) as nom,
        COUNT(*) as total_dossiers,
        SUM(
          COALESCE(
            NULLIF(CAST(NULLIF(regexp_replace(montant_cfa::text, '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(amount::text, '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'prix', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'prix_total', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'total', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            NULLIF(CAST(NULLIF(regexp_replace(data_formulaire->>'montant', '[^0-9.]', '', 'g'), '') AS numeric), 0),
            0
          )
        ) as ca_genere
      FROM dossiers
      WHERE client IS NOT NULL AND TRIM(client) != ''
      GROUP BY INITCAP(LOWER(TRIM(client)))
      ORDER BY ca_genere DESC
      LIMIT $1
    `;

    const [clients] = await dbHelper.query(query, [limit]);
    res.json({ success: true, data: clients });
  } catch (error) {
    console.error('Erreur GET /clients/top:', error);
    res.status(500).json({ error: 'Erreur lors du calcul du Top Clients' });
  }
});


// POST /api/clients/merge - Fusionne deux clients
router.post('/merge', auth, async (req, res) => {
  try {
    const { sourceClient, targetClient } = req.body;
    
    if (!sourceClient || !targetClient) {
      return res.status(400).json({ success: false, error: 'Veuillez spécifier le client source et le client cible.' });
    }

    if (sourceClient.trim().toLowerCase() === targetClient.trim().toLowerCase()) {
       return res.status(400).json({ success: false, error: 'La source et la cible sont identiques.'});
    }

    // Mise à jour de tous les dossiers appartenant à sourceClient
    const query = `
      UPDATE dossiers
      SET client = $1
      WHERE INITCAP(LOWER(TRIM(client))) = INITCAP(LOWER(TRIM($2)))
    `;

    const [result] = await dbHelper.query(query, [targetClient, sourceClient]);
    
    res.json({ 
      success: true, 
      message: `Les dossiers de "${sourceClient}" ont été fusionnés vers "${targetClient}".`
    });
  } catch (error) {
    console.error('Erreur POST /clients/merge:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la fusion des clients.' });
  }
});

module.exports = router;
