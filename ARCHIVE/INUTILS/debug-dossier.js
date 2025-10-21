const { query } = require('./backend/config/database');

async function debugDossier() {
  try {
    console.log('🔍 Test de récupération directe d\'un dossier...');
    
    // D'abord, voir la structure de la table
    const structure = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'dossiers' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Structure table dossiers:');
    structure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // Ensuite, récupérer un dossier existant
    const dossiers = await query('SELECT id, folder_id, created_by, preparateur_id FROM dossiers LIMIT 1');
    
    if (dossiers.rows.length > 0) {
      const dossier = dossiers.rows[0];
      console.log('\n📄 Premier dossier:');
      console.log('  ID:', dossier.id);
      console.log('  folder_id:', dossier.folder_id);
      console.log('  created_by:', dossier.created_by);
      console.log('  preparateur_id:', dossier.preparateur_id);
      
      // Tester la requête du middleware
      const testQuery = `
        SELECT d.*, 
               u.nom as preparateur_name
        FROM dossiers d
        LEFT JOIN users u ON d.preparateur_id = u.id
        WHERE d.id = $1
      `;
      
      const result = await query(testQuery, [dossier.id]);
      console.log('\n✅ Requête middleware réussie:', result.rows.length > 0 ? 'OUI' : 'NON');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
  
  process.exit(0);
}

debugDossier();