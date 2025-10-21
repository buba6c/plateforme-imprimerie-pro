const crypto = require('crypto');
const db = require('../config/database');
const readline = require('readline');

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex').slice(0, 32);

function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

async function fixOpenAIKey() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n🔑 Entrez votre clé API OpenAI (ou laissez vide pour annuler): ', async (apiKey) => {
      rl.close();

      if (!apiKey || apiKey.trim() === '') {
        console.log('❌ Opération annulée');
        process.exit(0);
      }

      apiKey = apiKey.trim();

      // Vérifier le format basique d'une clé OpenAI
      if (!apiKey.startsWith('sk-')) {
        console.log('⚠️  Attention: La clé ne commence pas par "sk-", ce qui est inhabituel pour OpenAI');
      }

      console.log('\n📝 Chiffrement de la clé...');
      const { encrypted, iv } = encryptApiKey(apiKey);

      console.log('✅ Chiffrement réussi');
      console.log(`- Clé chiffrée (longueur): ${encrypted.length} caractères`);
      console.log(`- IV (longueur): ${iv.length} caractères`);

      console.log('\n💾 Enregistrement dans la base de données...');

      try {
        await db.query(
          `UPDATE openai_config 
           SET api_key_encrypted = $1, 
               api_key_iv = $2,
               is_active = TRUE,
               updated_at = NOW()
           WHERE id = 1`,
          [encrypted, iv]
        );

        console.log('✅ Clé API enregistrée avec succès!');
        console.log('✅ OpenAI est maintenant activé');

        // Test de déchiffrement immédiat
        console.log('\n🧪 Test de déchiffrement...');
        const decipher = crypto.createDecipheriv(
          ENCRYPTION_ALGORITHM,
          ENCRYPTION_KEY,
          Buffer.from(iv, 'hex')
        );

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        if (decrypted === apiKey) {
          console.log('✅ Déchiffrement vérifié: OK');
        } else {
          console.log('❌ Erreur: le déchiffrement ne correspond pas à la clé originale');
        }

        process.exit(0);
      } catch (error) {
        console.error('\n❌ Erreur lors de l\'enregistrement:');
        console.error(error.message);
        process.exit(1);
      }
    });
  });
}

console.log('═══════════════════════════════════════════════════════');
console.log('🔧 Script de correction de la clé API OpenAI');
console.log('═══════════════════════════════════════════════════════');
console.log('\nCe script va réenregistrer proprement votre clé API OpenAI');
console.log('avec un chiffrement correct.');
console.log('\n⚠️  La clé sera stockée de manière sécurisée (AES-256-CBC)');

fixOpenAIKey();
