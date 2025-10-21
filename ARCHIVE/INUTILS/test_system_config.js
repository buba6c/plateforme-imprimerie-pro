// Test de fonctionnalité des paramètres système
const { Pool } = require('pg');

const pool = new Pool({
  user: 'imprimerie_user',
  host: 'localhost', 
  database: 'imprimerie_db',
  password: 'secure_password_123',
  port: 5432,
});

async function testSystemConfig() {
  try {
    // Vérifier si la table system_config existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_config'
      );
    `);
    
    console.log('✓ Table system_config existe:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ Création de la table system_config...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ Table system_config créée');
      
      // Insérer quelques paramètres par défaut
      const defaultParams = [
        ['app_name', 'EvocomPrint'],
        ['app_version', '3.0.0'],
        ['max_file_size', '50'],
        ['session_timeout', '3600'],
        ['maintenance_mode', JSON.stringify({ enabled: false, message: 'Maintenance en cours...' })],
        ['dark_mode', JSON.stringify({ enabled: false })],
      ];
      
      for (const [key, value] of defaultParams) {
        await pool.query(
          'INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO NOTHING',
          [key, value]
        );
      }
      console.log('✓ Paramètres par défaut insérés');
    }
    
    // Test d'insertion d'un paramètre
    await pool.query(
      'INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      ['test_param', 'test_value']
    );
    
    // Test de lecture
    const result = await pool.query('SELECT * FROM system_config WHERE key = $1', ['test_param']);
    console.log('✓ Test lecture paramètre:', result.rows[0]);
    
    // Liste tous les paramètres
    const allParams = await pool.query('SELECT key, value, updated_at FROM system_config ORDER BY key ASC');
    console.log('✓ Paramètres existants:', allParams.rows.length, 'entrées');
    allParams.rows.forEach(row => {
      console.log(`  - ${row.key}: ${row.value}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

testSystemConfig();