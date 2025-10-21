const axios = require('axios');

const quickTest = async () => {
  console.log('🚀 Test rapide des permissions imprimeurs...\n');
  
  try {
    // Test sur le port 5002
    const response = await axios.get('http://localhost:5002/api/health');
    console.log('✅ Serveur accessible sur port 5002');
    
    // Test connexion Roland
    const rolandLogin = await axios.post('http://localhost:5002/api/auth/login', {
      email: 'roland@imprimerie.local',
      password: 'test123'
    });
    
    console.log('✅ Roland connecté');
    const token = rolandLogin.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    // Test changement de statut simple
    try {
      await axios.patch(
        'http://localhost:5002/api/dossiers/0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1/status',
        { status: 'en_impression', comment: 'Test Roland' },
        { headers }
      );
      console.log('✅ Roland peut changer le statut !');
    } catch (error) {
      console.log(`❌ Roland ne peut pas changer le statut: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
    
    // Test upload de fichier simple
    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const testContent = 'Test file content Roland';
      fs.writeFileSync('temp-test.txt', testContent);
      
      const formData = new FormData();
      formData.append('files', fs.createReadStream('temp-test.txt'));
      
      await axios.post(
        'http://localhost:5002/api/files/upload/0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1',
        formData,
        {
          headers: {
            ...headers,
            ...formData.getHeaders()
          }
        }
      );
      console.log('✅ Roland peut uploader des fichiers !');
      fs.unlinkSync('temp-test.txt');
    } catch (error) {
      console.log(`❌ Roland ne peut pas uploader: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
      try { fs.unlinkSync('temp-test.txt'); } catch {}
    }
    
    console.log('\n🎉 Corrections appliquées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
  }
};

quickTest();