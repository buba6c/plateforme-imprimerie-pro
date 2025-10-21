/**
 * 🔍 Vérification de la structure de la table dossiers
 */

const dbHelper = require('./backend/utils/dbHelper');

async function checkDossiersTable() {
  try {
    console.log('📋 Vérification de la structure de la table dossiers...');
    
    // Vérifier si la table existe
    const tableExists = await dbHelper.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'dossiers'
    `);
    
    if (tableExists[0].count == 0) {
      console.log('❌ La table dossiers n\'existe pas !');
      return;
    }
    
    console.log('✅ La table dossiers existe');
    
    // Récupérer la structure de la table
    const columns = await dbHelper.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'dossiers'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Structure de la table dossiers:');
    console.table(columns);
    
    // Vérifier spécifiquement les colonnes nécessaires pour la conversion
    const requiredColumns = ['folder_id', 'numero', 'user_id', 'machine_type', 'data_json', 'statut', 'created_at'];
    const existingColumns = columns.map(col => col.column_name);
    
    console.log('\n🔍 Vérification des colonnes requises:');
    requiredColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });
    
    // Vérifier quelques dossiers existants
    const sampleDossiers = await dbHelper.query('SELECT * FROM dossiers LIMIT 3');
    console.log(`\n📁 Exemple de dossiers (${sampleDossiers.length} trouvés):`);
    if (sampleDossiers.length > 0) {
      console.table(sampleDossiers.map(d => ({
        id: d.id,
        folder_id: d.folder_id,
        numero: d.numero,
        statut: d.statut,
        created_at: d.created_at
      })));
    }
    
  } catch (error) {
    console.log('❌ Erreur lors de la vérification:', error.message);
    console.log('Stack:', error.stack);
  }
}

checkDossiersTable();