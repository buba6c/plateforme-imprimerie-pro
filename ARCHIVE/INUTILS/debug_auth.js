/**
 * TEST DEBUG - Vérifier l'authentification et le token
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTY2MjIxMywiZXhwIjoxNzU5NzQ4NjEzfQ.EfFlkspaV6tsQ99Jc4HQ5nCClbMFbNATIzCXkq92bw4';

async function debugAuth() {
  console.log('🔍 DEBUG - Authentification et token');
  console.log('='.repeat(40));

  try {
    // 1. Vérifier que le token fonctionne sur une route basique
    console.log('\n📋 1. TEST - Token sur route basique...');
    try {
      const userResponse = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
      });
      console.log('✅ Token valide sur /auth/me');
      console.log(`   User: ${userResponse.data.user?.nom || 'N/A'}`);
      console.log(`   Role: ${userResponse.data.user?.role || 'N/A'}`);
    } catch (error) {
      console.log(`❌ Token invalide: ${error.response?.status} - ${error.response?.statusText}`);
      if (error.response?.data) {
        console.log('   Erreur:', error.response.data);
      }
    }

    // 2. Tester l'authentification sur la route files
    console.log('\n📄 2. TEST - Authentification route files...');
    try {
      const filesListResponse = await axios.get(`${API_BASE}/files`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
      });
      console.log(`✅ Route /files accessible (${filesListResponse.status})`);
    } catch (error) {
      console.log(`❌ Route /files inaccessible: ${error.response?.status}`);
      if (error.response?.data) {
        console.log('   Erreur:', error.response.data);
      }
    }

    // 3. Tester spécifiquement la route preview
    console.log('\n👁️ 3. TEST - Route preview spécifique...');
    const testFileId = '8b8cd4c2-a309-4ba3-8732-e9dc9f2a35eb'; // ID d'un fichier de test
    
    try {
      const previewResponse = await axios.get(`${API_BASE}/files/preview/${testFileId}`, {
        headers: { 
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Accept': '*/*'
        },
        validateStatus: () => true // Accept tous les status codes pour voir la réponse
      });
      
      console.log(`📊 Response Status: ${previewResponse.status}`);
      console.log(`📊 Response Headers:`, Object.keys(previewResponse.headers));
      
      if (previewResponse.status === 401) {
        console.log('❌ Erreur 401 - Non autorisé');
        console.log('   Response:', previewResponse.data);
      } else if (previewResponse.status === 404) {
        console.log('⚠️ Erreur 404 - Fichier non trouvé');
        console.log('   Response:', previewResponse.data);
      } else {
        console.log('✅ Route preview accessible');
        console.log(`   Content-Type: ${previewResponse.headers['content-type']}`);
      }
      
    } catch (error) {
      console.log(`❌ Erreur lors du test preview: ${error.message}`);
    }

    // 4. Vérifier le format du token
    console.log('\n🔑 4. ANALYSE DU TOKEN...');
    console.log(`Token utilisé: ${ADMIN_TOKEN.substring(0, 50)}...`);
    
    // Decoder le JWT pour voir s'il est expiré
    try {
      const parts = ADMIN_TOKEN.split('.');
      const payload = JSON.parse(atob(parts[1]));
      console.log('📋 Payload JWT:');
      console.log(`   User ID: ${payload.id}`);
      console.log(`   Role: ${payload.role}`);
      console.log(`   Issued at: ${new Date(payload.iat * 1000).toLocaleString()}`);
      console.log(`   Expires at: ${new Date(payload.exp * 1000).toLocaleString()}`);
      
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.log('❌ TOKEN EXPIRÉ !');
      } else {
        console.log('✅ Token encore valide');
      }
      
    } catch (e) {
      console.log('❌ Impossible de décoder le JWT');
    }

    // 5. Recommandations
    console.log('\n💡 RECOMMANDATIONS:');
    console.log('1. Si le token est expiré, se reconnecter sur http://localhost:3001');
    console.log('2. Vérifier que le middleware authenticateToken est bien appliqué');
    console.log('3. Contrôler les headers CORS si nécessaire');
    console.log('4. Tester avec un nouveau token si problème persiste');

  } catch (error) {
    console.log(`❌ Erreur générale: ${error.message}`);
  }
}

debugAuth();