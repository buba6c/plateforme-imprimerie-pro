const dbHelper = require('./utils/dbHelper');
const openaiService = require('./services/openaiService');

async function diagnosticOpenAI() {
  console.log('🔍 DIAGNOSTIC OPENAI');
  console.log('===================\n');

  try {
    // 1. Config OpenAI
    console.log('1️⃣ Configuration OpenAI...');
    const config = await openaiService.getOpenAIConfig();
    
    if (!config) {
      console.log('❌ Aucune configuration OpenAI');
      return;
    }

    console.log(`✅ Config trouvée - Activé: ${config.is_active ? 'OUI' : 'NON'}`);
    console.log(`   Clé API: ${config.api_key_encrypted ? 'Configurée' : 'Manquante'}`);
    console.log(`   Requêtes: ${config.total_requests || 0}`);

    // 2. Test client
    console.log('\n2️⃣ Test client OpenAI...');
    const client = await openaiService.getOpenAIClient();
    console.log(client ? '✅ Client OK' : '❌ Client KO');

    // 3. Derniers devis
    console.log('\n3️⃣ Derniers devis...');
    const [devis] = await dbHelper.query(
      'SELECT numero, machine_type, prix_estime, details_prix FROM devis ORDER BY created_at DESC LIMIT 2'
    );
    
    devis.forEach(d => {
      let details = {};
      try { details = JSON.parse(d.details_prix || '{}'); } catch(e) {}
      console.log(`   ${d.numero}: IA = ${details.ia_used ? 'OUI' : 'NON'}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

diagnosticOpenAI();
