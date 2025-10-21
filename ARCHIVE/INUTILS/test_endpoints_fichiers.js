/**
 * TEST SPÉCIFIQUE - Endpoint des fichiers avec authentification
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTY2MjIxMywiZXhwIjoxNzU5NzQ4NjEzfQ.EfFlkspaV6tsQ99Jc4HQ5nCClbMFbNATIzCXkq92bw4';

async function testFileEndpoints() {
  console.log('🔧 TEST SPÉCIFIQUE - Endpoints des fichiers');
  console.log('='.repeat(50));

  const testFileId = '8b8cd4c2-a309-4ba3-8732-e9dc9f2a35eb';

  try {
    // 1. Test du endpoint de base des fichiers
    console.log('\n📂 1. TEST - Endpoint base /api/files...');
    try {
      const filesResponse = await axios.get(`${API_BASE}/files`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
      });
      console.log(`✅ Endpoint /api/files accessible (${filesResponse.status})`);
    } catch (error) {
      console.log(`❌ Endpoint /api/files inaccessible: ${error.response?.status || error.message}`);
    }

    // 2. Test des détails d'un fichier spécifique
    console.log('\n📄 2. TEST - Détails fichier spécifique...');
    try {
      const fileResponse = await axios.get(`${API_BASE}/files/${testFileId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
      });
      console.log(`✅ Détails fichier accessibles (${fileResponse.status})`);
      console.log('   Structure:', Object.keys(fileResponse.data));
    } catch (error) {
      console.log(`❌ Détails fichier inaccessibles: ${error.response?.status || error.message}`);
      if (error.response?.data) {
        console.log('   Erreur:', error.response.data);
      }
    }

    // 3. Test endpoint download
    console.log('\n💾 3. TEST - Endpoint download...');
    try {
      const downloadResponse = await axios.get(`${API_BASE}/files/download/${testFileId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        responseType: 'arraybuffer'
      });
      console.log(`✅ Endpoint download accessible (${downloadResponse.status})`);
      console.log(`   Content-Type: ${downloadResponse.headers['content-type']}`);
      console.log(`   Content-Length: ${downloadResponse.headers['content-length']}`);
    } catch (error) {
      console.log(`❌ Endpoint download inaccessible: ${error.response?.status || error.message}`);
      if (error.response?.data) {
        console.log('   Erreur:', error.response.data.toString());
      }
    }

    // 4. Test endpoint preview
    console.log('\n👁️ 4. TEST - Endpoint preview...');
    try {
      const previewResponse = await axios.get(`${API_BASE}/files/preview/${testFileId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        responseType: 'arraybuffer'
      });
      console.log(`✅ Endpoint preview accessible (${previewResponse.status})`);
      console.log(`   Content-Type: ${previewResponse.headers['content-type']}`);
      console.log(`   Content-Length: ${previewResponse.headers['content-length']}`);
    } catch (error) {
      console.log(`❌ Endpoint preview inaccessible: ${error.response?.status || error.message}`);
      if (error.response?.data) {
        const errorText = Buffer.from(error.response.data).toString();
        console.log('   Erreur:', errorText);
      }
    }

    // 5. Vérifier l'existence du fichier physique
    console.log('\n📁 5. VÉRIFICATION PHYSIQUE...');
    const fs = require('fs');
    const path = require('path');
    
    const expectedPath1 = path.join(process.cwd(), 'uploads/e8cd600f-209d-46a9-b302-0b2be90eae60/1759677662710_test_permissions_upload.txt');
    const expectedPath2 = path.join(process.cwd(), 'uploads/dossiers/e8cd600f-209d-46a9-b302-0b2be90eae60/1759677662710_test_permissions_upload.txt');
    
    console.log(`🔍 Test chemin 1: ${expectedPath1}`);
    if (fs.existsSync(expectedPath1)) {
      console.log('✅ Fichier physique trouvé (chemin 1)');
      const stats = fs.statSync(expectedPath1);
      console.log(`   Taille: ${stats.size} bytes`);
    } else {
      console.log('❌ Fichier physique non trouvé (chemin 1)');
    }
    
    console.log(`🔍 Test chemin 2: ${expectedPath2}`);
    if (fs.existsSync(expectedPath2)) {
      console.log('✅ Fichier physique trouvé (chemin 2)');
      const stats = fs.statSync(expectedPath2);
      console.log(`   Taille: ${stats.size} bytes`);
    } else {
      console.log('❌ Fichier physique non trouvé (chemin 2)');
    }

    // 6. Lister le contenu du dossier uploads
    console.log('\n📂 6. CONTENU DU DOSSIER UPLOADS...');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const contents = fs.readdirSync(uploadsDir);
      console.log('✅ Contenu du dossier uploads:');
      contents.forEach(item => {
        const itemPath = path.join(uploadsDir, item);
        const isDir = fs.statSync(itemPath).isDirectory();
        console.log(`   ${isDir ? '📁' : '📄'} ${item}`);
        
        if (isDir && item === 'e8cd600f-209d-46a9-b302-0b2be90eae60') {
          const subContents = fs.readdirSync(itemPath);
          subContents.forEach(subItem => {
            console.log(`      📄 ${subItem}`);
          });
        }
      });
    } else {
      console.log('❌ Dossier uploads non trouvé');
    }

  } catch (error) {
    console.log(`❌ Erreur générale: ${error.message}`);
  }
}

testFileEndpoints();