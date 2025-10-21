const crypto = require('crypto');

// Clé de chiffrement (doit correspondre à celle utilisée par le backend)
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex').slice(0, 32);
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Récupérer les valeurs depuis la DB (remplacer par les vraies valeurs)
const db = require('../config/database');

async function testDecrypt() {
  try {
    const result = await db.query('SELECT api_key_encrypted, api_key_iv FROM openai_config WHERE id = 1');
    
    if (result.rows.length === 0) {
      console.log('❌ Aucune configuration trouvée');
      return;
    }
    
    const { api_key_encrypted, api_key_iv } = result.rows[0];
    
    console.log('📊 Informations récupérées:');
    console.log(`- Clé chiffrée (longueur): ${api_key_encrypted.length}`);
    console.log(`- IV (longueur): ${api_key_iv.length}`);
    console.log(`- IV (valeur): ${api_key_iv}`);
    
    // Vérifier que l'IV est bien hex
    const ivBuffer = Buffer.from(api_key_iv, 'hex');
    console.log(`- IV Buffer (longueur): ${ivBuffer.length} bytes (attendu: 16)`);
    
    if (ivBuffer.length !== 16) {
      console.log('❌ IV invalide: doit faire 16 bytes (32 caractères hex)');
      return;
    }
    
    // Tentative de déchiffrement
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      ivBuffer
    );
    
    let decrypted = decipher.update(api_key_encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log('\n✅ Déchiffrement réussi!');
    console.log(`- Clé API: ${decrypted.substring(0, 7)}...${decrypted.substring(decrypted.length - 4)}`);
    console.log(`- Longueur: ${decrypted.length} caractères`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du déchiffrement:');
    console.error(error.message);
    console.error('\nDétails:', error);
    process.exit(1);
  }
}

testDecrypt();
