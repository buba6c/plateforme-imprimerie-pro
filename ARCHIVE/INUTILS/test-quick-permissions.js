const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

const testQuickPermissions = async () => {
  console.log('🧪 Test rapide des permissions...');
  
  try {
    // Test avec l'admin
    console.log('\n👤 Test Admin...');
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    const adminToken = adminLogin.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    
    // Tester l'accès à un dossier Roland
    const rolandDossier = await axios.get(`${API_BASE}/dossiers/0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1`, { headers: adminHeaders });
    console.log('✅ Admin peut accéder au dossier Roland');
    
    // Tester l'accès à un dossier Xerox 
    const xeroxDossier = await axios.get(`${API_BASE}/dossiers/9aab908f-ca0b-447e-8c23-9ed57772d123`, { headers: adminHeaders });
    console.log('✅ Admin peut accéder au dossier Xerox');
    
  } catch (error) {
    console.log('❌ Erreur admin:', error.response?.data?.error || error.message);
  }
  
  try {
    // Test avec l'imprimeur Roland
    console.log('\n👤 Test Imprimeur Roland...');
    const rolandLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'roland@test.com', 
      password: 'roland123'
    });
    
    const rolandToken = rolandLogin.data.token;
    const rolandHeaders = { Authorization: `Bearer ${rolandToken}` };
    
    // Tester l'accès à un dossier Roland - devrait marcher
    try {
      const rolandDossier = await axios.get(`${API_BASE}/dossiers/0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1`, { headers: rolandHeaders });
      console.log('✅ Imprimeur Roland peut accéder au dossier Roland');
      
      // Tester le téléchargement de fichiers
      try {
        const filesResponse = await axios.get(`${API_BASE}/files?dossier_id=0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1`, { headers: rolandHeaders });
        console.log('✅ Imprimeur Roland peut lister les fichiers du dossier Roland');
        
        if (filesResponse.data.files && filesResponse.data.files.length > 0) {
          const firstFile = filesResponse.data.files[0];
          await axios.get(`${API_BASE}/files/download/${firstFile.id}`, { headers: rolandHeaders, timeout: 5000 });
          console.log('✅ Imprimeur Roland peut télécharger les fichiers du dossier Roland');
        }
      } catch (fileError) {
        console.log('❌ Imprimeur Roland ne peut pas accéder aux fichiers:', fileError.response?.data?.error || fileError.message);
      }
      
    } catch (dossierError) {
      console.log('❌ Imprimeur Roland ne peut pas accéder au dossier Roland:', dossierError.response?.data?.error || dossierError.message);
    }
    
    // Tester l'accès à un dossier Xerox - devrait être limité
    try {
      const xeroxDossier = await axios.get(`${API_BASE}/dossiers/9aab908f-ca0b-447e-8c23-9ed57772d123`, { headers: rolandHeaders });
      console.log('✅ Imprimeur Roland peut voir le dossier Xerox (lecture seule)');
    } catch (xeroxError) {
      console.log('⚠️ Imprimeur Roland ne peut pas accéder au dossier Xerox:', xeroxError.response?.data?.error || xeroxError.message);
    }
    
  } catch (error) {
    console.log('❌ Erreur imprimeur Roland:', error.response?.data?.error || error.message);
  }
  
  try {
    // Test avec l'imprimeur Xerox
    console.log('\n👤 Test Imprimeur Xerox...');
    const xeroxLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'xerox@test.com',
      password: 'xerox123' 
    });
    
    const xeroxToken = xeroxLogin.data.token;
    const xeroxHeaders = { Authorization: `Bearer ${xeroxToken}` };
    
    // Tester l'accès à un dossier Xerox - devrait marcher
    try {
      const xeroxDossier = await axios.get(`${API_BASE}/dossiers/9aab908f-ca0b-447e-8c23-9ed57772d123`, { headers: xeroxHeaders });
      console.log('✅ Imprimeur Xerox peut accéder au dossier Xerox');
      
      // Tester le téléchargement de fichiers
      try {
        const filesResponse = await axios.get(`${API_BASE}/files?dossier_id=9aab908f-ca0b-447e-8c23-9ed57772d123`, { headers: xeroxHeaders });
        console.log('✅ Imprimeur Xerox peut lister les fichiers du dossier Xerox');
        
        if (filesResponse.data.files && filesResponse.data.files.length > 0) {
          const firstFile = filesResponse.data.files[0];
          await axios.get(`${API_BASE}/files/download/${firstFile.id}`, { headers: xeroxHeaders, timeout: 5000 });
          console.log('✅ Imprimeur Xerox peut télécharger les fichiers du dossier Xerox');
        }
      } catch (fileError) {
        console.log('❌ Imprimeur Xerox ne peut pas accéder aux fichiers:', fileError.response?.data?.error || fileError.message);
      }
      
    } catch (dossierError) {
      console.log('❌ Imprimeur Xerox ne peut pas accéder au dossier Xerox:', dossierError.response?.data?.error || dossierError.message);
    }
    
  } catch (error) {
    console.log('❌ Erreur imprimeur Xerox:', error.response?.data?.error || error.message);
  }
  
  console.log('\n🎉 Tests terminés');
};

// Exécuter le test
testQuickPermissions()
  .catch(error => {
    console.error('❌ Erreur générale:', error);
  });