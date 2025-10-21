const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function checkTables() {
  try {
    const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables trouvées:', result.rows.length);
    if (result.rows.length === 0) {
      console.log('❌ AUCUNE TABLE - LA BASE EST VIDE !');
      console.log('🚨 Les tables doivent être créées avec le script init.sql');
    } else {
      result.rows.forEach(row => console.log('- ' + row.table_name));
    }
  } catch (err) {
    console.error('Erreur:', err.message);
  }
  process.exit(0);
}

checkTables();