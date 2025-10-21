const axios = require('axios');
const fs = require('fs');
const path = require('path');

const testFileContentAccuracy = async () => {
  console.log('🔍 Test de précision du contenu des téléchargements...\n');
  
  try {
    // Connexion admin
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const adminToken = adminLogin.data.token;
    const headers = { Authorization: `Bearer ${adminToken}` };
    
    // Lister tous les fichiers du dossier Roland
    const filesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { headers });
    
    console.log('📋 Fichiers disponibles dans le dossier Roland:');
    filesResponse.data.files.forEach((file, index) => {
      console.log(`  ${index + 1}. Nom: ${file.original_filename || file.nom}`);
      console.log(`     ID: ${file.id.substring(0, 8)}...`);
      console.log(`     Chemin: ${file.filepath || file.chemin}`);
      console.log('');
    });
    
    // Tester le téléchargement de chaque fichier
    for (let i = 0; i < Math.min(filesResponse.data.files.length, 4); i++) {
      const file = filesResponse.data.files[i];
      const fileName = file.original_filename || file.nom;
      const filePath = file.filepath || file.chemin;
      
      console.log(`🔽 Test ${i + 1}: Téléchargement de "${fileName}"`);
      console.log(`   Chemin physique: ${filePath}`);
      
      try {
        // Lire le contenu original du fichier
        let originalContent = 'FICHIER INTROUVABLE';
        try {
          if (fs.existsSync(filePath)) {
            originalContent = fs.readFileSync(filePath, 'utf8');
          }
        } catch (readError) {
          console.log(`   ⚠️  Impossible de lire le fichier physique: ${readError.message}`);
        }
        
        console.log(`   📝 Contenu original: "${originalContent}"`);
        
        // Télécharger via l'API
        const downloadResponse = await axios.get(`http://localhost:5001/api/files/download/${file.id}`, {
          headers,
          responseType: 'text' // Pour pouvoir comparer le contenu
        });
        
        const downloadedContent = downloadResponse.data;
        console.log(`   📥 Contenu téléchargé: "${downloadedContent}"`);
        
        // Comparer les contenus
        if (downloadedContent === originalContent) {
          console.log(`   ✅ CORRECT: Les contenus correspondent parfaitement`);
        } else {
          console.log(`   ❌ PROBLEME: Contenus différents !`);
          console.log(`   📊 Longueur original: ${originalContent.length} caractères`);
          console.log(`   📊 Longueur téléchargé: ${downloadedContent.length} caractères`);
          
          // Afficher la différence caractère par caractère pour les petits fichiers
          if (originalContent.length < 100 && downloadedContent.length < 100) {
            console.log(`   🔍 Comparaison détaillée:`);
            for (let j = 0; j < Math.max(originalContent.length, downloadedContent.length); j++) {
              const origChar = originalContent[j] || '∅';
              const downChar = downloadedContent[j] || '∅';
              if (origChar !== downChar) {
                console.log(`   Pos ${j}: "${origChar}" vs "${downChar}"`);
              }
            }
          }
        }
        
        // Vérifier les headers
        const contentDisposition = downloadResponse.headers['content-disposition'];
        console.log(`   📋 Content-Disposition: ${contentDisposition}`);
        
      } catch (downloadError) {
        console.log(`   ❌ ERREUR téléchargement: ${downloadError.response?.status} - ${downloadError.response?.data?.error || downloadError.message}`);
      }
      
      console.log(''); // Ligne vide
    }
    
    // Test avec imprimeur Roland
    console.log('👤 Test avec imprimeur Roland...\n');
    
    try {
      const rolandLogin = await axios.post('http://localhost:5001/api/auth/login', {
        email: 'roland@imprimerie.local',
        password: 'test123'
      });
      
      const rolandToken = rolandLogin.data.token;
      const rolandHeaders = { Authorization: `Bearer ${rolandToken}` };
      
      const rolandFilesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
        headers: rolandHeaders 
      });
      
      console.log(`📋 Imprimeur Roland voit ${rolandFilesResponse.data.files.length} fichier(s)`);
      
      if (rolandFilesResponse.data.files.length > 0) {
        const testFile = rolandFilesResponse.data.files[0];
        const fileName = testFile.original_filename || testFile.nom;
        
        console.log(`🔽 Roland télécharge: "${fileName}"`);
        
        try {
          const rolandDownload = await axios.get(`http://localhost:5001/api/files/download/${testFile.id}`, {
            headers: rolandHeaders,
            responseType: 'text'
          });
          
          console.log(`   📥 Contenu reçu: "${rolandDownload.data}"`);
          console.log(`   ✅ Roland peut télécharger ses fichiers`);
          
        } catch (rolandError) {
          console.log(`   ❌ Erreur Roland: ${rolandError.response?.status} - ${rolandError.response?.data?.error || rolandError.message}`);
        }
      }
      
    } catch (loginError) {
      console.log(`❌ Erreur connexion Roland: ${loginError.message}`);
    }
    
    // Test avec imprimeur Xerox sur les fichiers Roland (devrait être bloqué)
    console.log('\n👤 Test avec imprimeur Xerox (accès aux fichiers Roland)...\n');
    
    try {
      const xeroxLogin = await axios.post('http://localhost:5001/api/auth/login', {
        email: 'xerox@imprimerie.local',
        password: 'test123'
      });
      
      const xeroxToken = xeroxLogin.data.token;
      const xeroxHeaders = { Authorization: `Bearer ${xeroxToken}` };
      
      const xeroxFilesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { 
        headers: xeroxHeaders 
      });
      
      console.log(`📋 Imprimeur Xerox voit ${xeroxFilesResponse.data.files.length} fichier(s) Roland`);
      
      if (xeroxFilesResponse.data.files.length > 0) {
        const testFile = xeroxFilesResponse.data.files[0];
        
        try {
          await axios.get(`http://localhost:5001/api/files/download/${testFile.id}`, {
            headers: xeroxHeaders,
            responseType: 'text'
          });
          
          console.log(`   ❌ PROBLÈME DE SÉCURITÉ: Xerox peut télécharger les fichiers Roland !`);
          
        } catch (xeroxError) {
          console.log(`   ✅ CORRECT: Xerox bloqué (${xeroxError.response?.status} - ${xeroxError.response?.data?.error || 'Accès refusé'})`);
        }
      }
      
    } catch (xeroxLoginError) {
      console.log(`❌ Erreur connexion Xerox: ${xeroxLoginError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

// Exécuter le test
testFileContentAccuracy()
  .then(() => {
    console.log('\n🎉 Test de contenu terminé');
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
  });