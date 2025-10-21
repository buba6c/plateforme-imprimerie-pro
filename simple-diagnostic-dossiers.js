/**
 * 🔍 Diagnostic simple de la table dossiers
 */

const dbHelper = require('./backend/utils/dbHelper');

async function simpleDiagnostic() {
  try {
    console.log('📋 Diagnostic de la table dossiers...');
    
    // Afficher les noms de colonnes uniquement
    const result = await dbHelper.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'dossiers'
      ORDER BY ordinal_position
    `);
    
    console.log('🔍 Colonnes existantes dans la table dossiers:');
    result.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.column_name}`);
    });
    
    // Voir quelques enregistrements avec leurs vraies colonnes
    const sample = await dbHelper.query('SELECT * FROM dossiers LIMIT 1');
    if (sample.length > 0) {
      console.log('\n📄 Colonnes d\'un dossier existant:');
      console.log(Object.keys(sample[0]));
    }
    
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

simpleDiagnostic();