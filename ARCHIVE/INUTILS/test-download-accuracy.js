const axios = require('axios');
const fs = require('fs');
const path = require('path');

const testFileDownloadAccuracy = async () => {
  console.log('🔍 Test de précision des téléchargements...\n');
  
  try {
    // 1. Connexion admin
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const adminToken = adminLogin.data.token;
    const headers = { Authorization: `Bearer ${adminToken}` };
    
    // 2. Lister tous les fichiers du dossier Roland
    const filesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { headers });
    
    console.log('📋 Fichiers disponibles:');
    filesResponse.data.files.forEach((file, index) => {
      console.log(`  ${index + 1}. ID: ${file.id}`);
      console.log(`     Nom: ${file.original_filename || file.filename}`);
      console.log(`     Chemin: ${file.filepath}`);
      console.log('');
    });
    
    // 3. Tester le téléchargement de chaque fichier
    for (let i = 0; i < filesResponse.data.files.length; i++) {
      const file = filesResponse.data.files[i];
      console.log(`🔽 Test téléchargement fichier ${i + 1}: ${file.original_filename || file.filename}`);
      
      try {
        // Télécharger le fichier
        const downloadResponse = await axios.get(`http://localhost:5001/api/files/download/${file.id}`, {
          headers,
          responseType: 'stream'
        });
        
        // Vérifier les headers
        const contentDisposition = downloadResponse.headers['content-disposition'];
        const contentType = downloadResponse.headers['content-type'];
        const contentLength = downloadResponse.headers['content-length'];
        
        console.log(`  📥 Headers reçus:`);
        console.log(`    Content-Disposition: ${contentDisposition}`);
        console.log(`    Content-Type: ${contentType}`);
        console.log(`    Content-Length: ${contentLength}`);
        
        // Extraire le nom de fichier des headers
        let downloadedFilename = 'unknown';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=((['"]).*?\\2|[^;\\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            downloadedFilename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
        
        console.log(`  📄 Fichier téléchargé: "${downloadedFilename}"`);
        console.log(`  📄 Fichier attendu: "${file.original_filename || file.filename}"`);
        
        // Vérifier la correspondance
        const expectedName = file.original_filename || file.filename;
        if (downloadedFilename === expectedName) {
          console.log(`  ✅ CORRECT: Noms correspondent`);
        } else {
          console.log(`  ❌ PROBLEME: Noms différents !`);
          console.log(`    Attendu: "${expectedName}"`);
          console.log(`    Reçu: "${downloadedFilename}"`);
        }
        
        // Télécharger et vérifier le contenu
        const tempDir = path.join(__dirname, 'temp-downloads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `download-${i + 1}-${Date.now()}.tmp`);
        const writer = fs.createWriteStream(tempFilePath);
        
        downloadResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        // Lire et vérifier le contenu
        const downloadedContent = fs.readFileSync(tempFilePath, 'utf8');
        const originalContent = fs.readFileSync(file.filepath, 'utf8');
        
        console.log(`  📝 Contenu original: "${originalContent}"`);
        console.log(`  📝 Contenu téléchargé: "${downloadedContent}"`);
        
        if (downloadedContent === originalContent) {
          console.log(`  ✅ CORRECT: Contenus identiques`);
        } else {
          console.log(`  ❌ PROBLEME: Contenus différents !`);
        }
        
        // Nettoyer
        fs.unlinkSync(tempFilePath);
        
      } catch (downloadError) {
        console.log(`  ❌ ERREUR téléchargement: ${downloadError.response?.data?.error || downloadError.message}`);
      }
      
      console.log(''); // Ligne vide
    }
    
    // 4. Test avec imprimeur Roland
    console.log('👤 Test avec imprimeur Roland...\n');
    
    const rolandLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'roland@imprimerie.local',
      password: 'test123'
    });
    
    const rolandToken = rolandLogin.data.token;
    const rolandHeaders = { Authorization: `Bearer ${rolandToken}` };
    
    const rolandFilesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
      headers: rolandHeaders 
    });
    
    if (rolandFilesResponse.data.files.length > 0) {
      const testFile = rolandFilesResponse.data.files[0];
      console.log(`🔽 Imprimeur Roland télécharge: ${testFile.original_filename || testFile.filename}`);
      
      try {
        const rolandDownload = await axios.get(`http://localhost:5001/api/files/download/${testFile.id}`, {
          headers: rolandHeaders,
          responseType: 'stream'
        });
        
        const contentDisposition = rolandDownload.headers['content-disposition'];
        console.log(`  📥 Content-Disposition: ${contentDisposition}`);
        
        let downloadedFilename = 'unknown';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=((['"]).*?\\2|[^;\\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            downloadedFilename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
        
        const expectedName = testFile.original_filename || testFile.filename;
        if (downloadedFilename === expectedName) {
          console.log(`  ✅ Imprimeur Roland: Téléchargement correct`);
        } else {
          console.log(`  ❌ Imprimeur Roland: Problème de nom de fichier`);
          console.log(`    Attendu: "${expectedName}"`);
          console.log(`    Reçu: "${downloadedFilename}"`);
        }
        
      } catch (rolandError) {
        console.log(`  ❌ Erreur imprimeur Roland: ${rolandError.response?.data?.error || rolandError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

// Exécuter le test
testFileDownloadAccuracy()
  .then(() => {
    console.log('\n🎉 Test terminé');
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
  });