// Test complet de l'API getDossiers pour imprimeur_roland
const { Pool } = require('pg');
const { normalizeFromDb } = require('./backend/constants/status-mapping');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'imprimerie_db',
  user: 'imprimerie_user',
  password: 'imprimerie_password'
});

async function testImprimeurAPI() {
  try {
    console.log('=== TEST API IMPRIMEUR_ROLAND ===\n');
    
    // 1. Simuler le filtre exact du backend
    const machineExpr = 'LOWER(COALESCE(d.type_formulaire, d.machine))';
    const query = `
      SELECT d.id, d.client, d.statut, d.machine, d.type_formulaire, d.updated_at
      FROM dossiers d
      WHERE ${machineExpr} LIKE 'roland%'
        AND d.statut IN ('Prêt impression','En impression','Imprimé','Prêt livraison','pret_impression','en_impression','imprime','pret_livraison','termine')
      ORDER BY d.updated_at DESC
    `;
    
    console.log('📊 Exécution de la requête SQL...\n');
    const result = await pool.query(query);
    
    console.log(`✅ ${result.rows.length} dossiers trouvés\n`);
    
    // 2. Simuler la normalisation backend
    const normalizedDossiers = result.rows.map(d => ({
      ...d,
      statut_db: d.statut,
      statut: normalizeFromDb(d.statut)
    }));
    
    // 3. Grouper par statut normalisé
    const byStatus = {};
    normalizedDossiers.forEach(d => {
      const status = d.statut;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(d);
    });
    
    console.log('📋 Répartition par statut (après normalisation):\n');
    Object.keys(byStatus).sort().forEach(status => {
      console.log(`${status.padEnd(20)} : ${byStatus[status].length} dossier(s)`);
      byStatus[status].slice(0, 3).forEach(d => {
        console.log(`  ├─ ${d.client.padEnd(25)} | DB: ${d.statut_db.padEnd(15)} | Machine: ${(d.machine || 'NULL').padEnd(6)}`);
      });
      if (byStatus[status].length > 3) {
        console.log(`  └─ ... et ${byStatus[status].length - 3} autre(s)`);
      }
      console.log('');
    });
    
    // 4. Tester le filtre frontend
    console.log('\n=== TEST FILTRE FRONTEND ===\n');
    const pretLivraison = normalizedDossiers.filter(d => {
      const normalized = d.statut.toLowerCase().trim();
      return normalized === 'pret_livraison';
    });
    
    console.log(`✅ ${pretLivraison.length} dossiers avec statut "pret_livraison"\n`);
    if (pretLivraison.length > 0) {
      console.log('Exemples:');
      pretLivraison.slice(0, 5).forEach(d => {
        console.log(`  - ${d.client.padEnd(25)} | Statut API: ${d.statut}`);
      });
    } else {
      console.log('❌ PROBLÈME: Aucun dossier "pret_livraison" trouvé !');
      console.log('\nVérification des statuts reçus:');
      const uniqueStatuts = [...new Set(normalizedDossiers.map(d => d.statut))];
      uniqueStatuts.forEach(s => {
        console.log(`  - "${s}"`);
      });
    }
    
    pool.end();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err);
    pool.end();
  }
}

testImprimeurAPI();
