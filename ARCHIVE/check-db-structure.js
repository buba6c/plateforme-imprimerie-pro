// Test de vérification de la structure de base de données
const { query } = require('./backend/config/database');

async function checkDatabaseStructure() {
  console.log('🔍 Vérification de la structure de la base de données...\n');

  try {
    // Vérifier les tables existantes
    const tablesResult = await query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('dossiers', 'users', 'dossier_status_history')
      ORDER BY table_name, ordinal_position
    `);

    console.log('📋 Structure des tables:');
    let currentTable = '';
    tablesResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        console.log(`\n▼ ${row.table_name.toUpperCase()}`);
        currentTable = row.table_name;
      }
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Vérifier s'il y a des dossiers
    const dossiersCount = await query('SELECT COUNT(*) as count FROM dossiers');
    console.log(`\n📊 Nombre de dossiers: ${dossiersCount.rows[0].count}`);

    // Si il y a des dossiers, afficher quelques exemples
    if (parseInt(dossiersCount.rows[0].count) > 0) {
      const sampleDossiers = await query('SELECT * FROM dossiers LIMIT 3');
      console.log('\n📄 Exemples de dossiers:');
      sampleDossiers.rows.forEach((dossier, i) => {
        console.log(`\n${i + 1}. ID: ${dossier.id}`);
        console.log(`   Numéro: ${dossier.numero_commande || dossier.numero || 'N/A'}`);
        console.log(`   Type: ${dossier.type_formulaire || dossier.type || 'N/A'}`);
        console.log(`   Statut: ${dossier.statut || dossier.status || 'N/A'}`);
        console.log(`   Créé le: ${dossier.created_at}`);
      });
    }

    console.log('\n✅ Vérification terminée');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
  
  process.exit(0);
}

checkDatabaseStructure();