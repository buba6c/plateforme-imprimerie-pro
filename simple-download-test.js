const axios = require('axios');

const simpleDownloadTest = async () => {
  console.log('🔍 Test simple de téléchargement...\n');
  
  try {
    // Connexion admin
    const adminLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@imprimerie.local',
      password: 'test123'
    });
    
    const headers = { Authorization: `Bearer ${adminLogin.data.token}` };
    
    // Lister les fichiers
    const filesResponse = await axios.get('http://localhost:5001/api/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', { headers });
    
    if (filesResponse.data.files.length > 0) {
      const file = filesResponse.data.files[0];
      console.log(`📥 Test téléchargement de: ${file.original_filename || file.filename}`);
      
      // Téléchargement avec head pour voir les headers
      const headResponse = await axios.head(`http://localhost:5001/api/files/download/${file.id}`, { headers });
      
      console.log('📋 Headers retournés par le serveur:');
      console.log(`  Content-Disposition: "${headResponse.headers['content-disposition']}"`);
      console.log(`  Content-Type: ${headResponse.headers['content-type']}`);
      console.log(`  Content-Length: ${headResponse.headers['content-length']}`);
      
      // Vérifier le parsing du nom de fichier côté frontend
      const contentDisposition = headResponse.headers['content-disposition'];
      if (contentDisposition) {
        console.log('\n🔧 Tests de parsing du nom de fichier:');
        
        // Ancienne regex
        const oldMatch = contentDisposition.match(/filename="(.+)"/);
        console.log(`  Ancienne regex (/filename="(.+)"/): ${oldMatch ? oldMatch[1] : 'pas de match'}`);
        
        // Nouvelle regex
        const newMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (newMatch && newMatch[1]) {
          const parsed = newMatch[1].replace(/^["']|["']$/g, '');
          console.log(`  Nouvelle regex: "${parsed}"`);
        } else {
          console.log('  Nouvelle regex: pas de match');
        }
        
        // Regex très simple pour test
        const simpleMatch = contentDisposition.match(/filename="([^"]+)"/);
        console.log(`  Regex simple (/filename="([^"]+)"/): ${simpleMatch ? simpleMatch[1] : 'pas de match'}`);
      }
      
    } else {
      console.log('❌ Aucun fichier trouvé');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
};

simpleDownloadTest();