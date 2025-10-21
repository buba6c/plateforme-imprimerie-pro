const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

const testFileDownload = async () => {
  console.log('🧪 Test diagnostic des téléchargements de fichiers...\n');
  
  try {
    // 1. Connexion admin
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const adminToken = adminLogin.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    
    console.log('✅ Connexion admin réussie\n');
    
    // 2. Lister tous les fichiers d'un dossier
    const dossierIds = ['0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', '9aab908f-ca0b-447e-8c23-9ed57772d123'];
    
    for (const dossierId of dossierIds) {
      console.log(`📁 Dossier: ${dossierId}`);
      
      try {
        const filesResponse = await axios.get(`${API_BASE}/files?dossier_id=${dossierId}`, { headers: adminHeaders });
        
        if (filesResponse.data.files && filesResponse.data.files.length > 0) {
          console.log(`  📋 ${filesResponse.data.files.length} fichiers trouvés:`);
          
          for (const file of filesResponse.data.files) {
            console.log(`    - ID: ${file.id}`);
            console.log(`    - Nom: ${file.original_filename || file.filename || 'Sans nom'}`);
            console.log(`    - Chemin: ${file.filepath || 'Non défini'}`);
            console.log(`    - Taille: ${file.size || 0} bytes`);
            
            // Test de téléchargement
            try {
              const downloadResponse = await axios.get(`${API_BASE}/files/download/${file.id}`, {
                headers: adminHeaders,
                timeout: 5000,
                responseType: 'stream'
              });
              
              console.log(`    ✅ Téléchargement réussi (Content-Type: ${downloadResponse.headers['content-type'] || 'non défini'})`);
              
              // Vérifier le nom du fichier dans les headers
              const contentDisposition = downloadResponse.headers['content-disposition'];
              if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=((['"]).*?\\2|[^;\\n]*)/);
                const downloadFilename = filenameMatch && filenameMatch[1] ? filenameMatch[1].replace(/['"]/g, '') : null;
                console.log(`    📥 Nom de fichier téléchargé: ${downloadFilename || 'non défini'}`);
                
                // Vérifier si le nom correspond
                const expectedName = file.original_filename || file.filename;
                if (expectedName && downloadFilename !== expectedName) {
                  console.log(`    ⚠️  PROBLÈME: Nom attendu "${expectedName}" ≠ Téléchargé "${downloadFilename}"`);
                }
              }
              
            } catch (downloadError) {
              console.log(`    ❌ Erreur téléchargement: ${downloadError.response?.data?.error || downloadError.message}`);
            }
            
            console.log(''); // Ligne vide pour la lisibilité
          }
        } else {
          console.log('  📋 Aucun fichier trouvé');
        }
        
      } catch (filesError) {
        console.log(`  ❌ Erreur listage fichiers: ${filesError.response?.data?.error || filesError.message}`);
      }
      
      console.log(''); // Ligne vide entre les dossiers
    }
    
    // 3. Test avec imprimeur Roland
    console.log('👤 Test avec imprimeur Roland...\n');
    
    const rolandLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'roland@imprimerie.local',
      password: 'test123'
    });
    
    const rolandToken = rolandLogin.data.token;
    const rolandHeaders = { Authorization: `Bearer ${rolandToken}` };
    
    // Tenter d'accéder aux fichiers du dossier Roland
    try {
      const rolandFiles = await axios.get(`${API_BASE}/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1`, { 
        headers: rolandHeaders 
      });
      
      console.log('✅ Imprimeur Roland peut lister les fichiers');
      
      if (rolandFiles.data.files && rolandFiles.data.files.length > 0) {
        const firstFile = rolandFiles.data.files[0];
        
        try {
          await axios.get(`${API_BASE}/files/download/${firstFile.id}`, { 
            headers: rolandHeaders, 
            timeout: 5000,
            responseType: 'stream'
          });
          console.log('✅ Imprimeur Roland peut télécharger les fichiers');
        } catch (downloadError) {
          console.log(`❌ Imprimeur Roland ne peut pas télécharger: ${downloadError.response?.data?.error || downloadError.message}`);
        }
      }
      
    } catch (filesError) {
      console.log(`❌ Imprimeur Roland ne peut pas lister les fichiers: ${filesError.response?.data?.error || filesError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

// Exécuter le test
testFileDownload()
  .then(() => {
    console.log('\n🎉 Test terminé');
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
  });