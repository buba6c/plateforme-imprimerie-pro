const axios = require('axios');

async function testFiles() {
    try {
        console.log('🔑 Authentification...');
        const authResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@test.com',
            password: 'admin123'
        });
        
        const token = authResponse.data.token;
        console.log('✅ Authentifié');
        
        // Test avec folder_id
        const dossierId = 'ef326557-a743-4441-ad51-ec0cc9f05ef7'; // ID principal de DOSS-001
        console.log('\n📁 Test GET /api/files?dossier_id=' + dossierId);
        
        const filesResponse = await axios.get(`http://localhost:5001/api/files?dossier_id=${dossierId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ SUCCÈS fichiers:', filesResponse.status);
        console.log('📄 Nombre de fichiers:', filesResponse.data.files?.length || 0);
        
    } catch (error) {
        console.log('❌ ERREUR:', error.response?.status, error.response?.data?.message || error.message);
    }
}

testFiles();