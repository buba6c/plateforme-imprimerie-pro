const { Pool } = require('pg');

// Configurations SSL différentes à tester
const sslConfigs = [
  { ssl: { rejectUnauthorized: false, requestCert: true } },
  { ssl: { rejectUnauthorized: false } },
  { ssl: true },
  { ssl: 'require' }
];

async function testConnectionAndFix() {
  const baseConfig = {
    user: 'imprimerixbackend_user',
    host: 'dpg-csmb3c3tq21c73bqpbtg-a.oregon-postgres.render.com',
    database: 'imprimerixbackend',
    password: 'rl1rEaokB2Vk1YRVGPVN9TxXxJnwUyKM',
    port: 5432,
    connectionTimeoutMillis: 30000,
    query_timeout: 30000
  };

  for (let i = 0; i < sslConfigs.length; i++) {
    console.log(`\n🔄 Test ${i + 1}/${sslConfigs.length} - Configuration SSL:`, JSON.stringify(sslConfigs[i]));
    
    const pool = new Pool({ ...baseConfig, ...sslConfigs[i] });
    
    try {
      const client = await pool.connect();
      console.log('✅ CONNEXION RÉUSSIE !');
      
      // Vérifier si la colonne existe
      const checkColumn = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'dossiers' AND column_name = 'valide_preparateur'
      `);
      
      if (checkColumn.rows.length === 0) {
        console.log('📝 Ajout de la colonne valide_preparateur...');
        await client.query(`
          ALTER TABLE dossiers ADD COLUMN valide_preparateur BOOLEAN DEFAULT false;
        `);
        console.log('✅ Colonne valide_preparateur ajoutée');
      } else {
        console.log('✅ Colonne valide_preparateur existe déjà');
      }
      
      // Ajouter d'autres colonnes critiques rapidement
      const criticalColumns = [
        { name: 'machine', type: 'VARCHAR(50)' },
        { name: 'description', type: 'TEXT' },
        { name: 'numero_commande', type: 'VARCHAR(100)' },
        { name: 'created_by', type: 'INTEGER REFERENCES users(id)' },
        { name: 'assigned_to', type: 'VARCHAR(50)' },
        { name: 'folder_id', type: 'UUID DEFAULT gen_random_uuid()' }
      ];
      
      for (const col of criticalColumns) {
        try {
          const exists = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'dossiers' AND column_name = '${col.name}'
          `);
          
          if (exists.rows.length === 0) {
            await client.query(`ALTER TABLE dossiers ADD COLUMN ${col.name} ${col.type};`);
            console.log(`✅ Colonne ${col.name} ajoutée`);
          }
        } catch (colError) {
          console.log(`⚠️  Erreur pour ${col.name}:`, colError.message);
        }
      }
      
      // Test final de la requête problématique
      console.log('🧪 Test de la requête de l\'API dossiers...');
      const testQuery = await client.query(`
        SELECT d.*, d.valide_preparateur, u.nom as preparateur_name, u.email as preparateur_email,
          (SELECT COUNT(*) FROM fichiers WHERE dossier_id = d.id) as nb_fichiers
        FROM dossiers d
        LEFT JOIN users u ON d.preparateur_id = u.id
        LIMIT 3
      `);
      
      console.log(`✅ SUCCÈS TOTAL ! Requête fonctionne avec ${testQuery.rows.length} résultats`);
      
      client.release();
      await pool.end();
      
      console.log('\n🎉 PROBLÈME RÉSOLU ! Le backend devrait maintenant fonctionner.');
      return true;
      
    } catch (error) {
      console.log(`❌ Échec configuration ${i + 1}:`, error.message);
      try { await pool.end(); } catch (e) {}
    }
  }
  
  console.log('\n❌ TOUTES LES CONFIGURATIONS ONT ÉCHOUÉ');
  return false;
}

// Exécuter le diagnostic et la correction
testConnectionAndFix()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });