const axios = require('axios');

async function testFilesEndpoint() {
    try {
        // 1. Authentification
        console.log('🔑 Authentification...');
        const authResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        
        const token = authResponse.data.token;
        console.log('✅ Authentifié');

        // 2. Test direct de la route des fichiers avec différents types d'ID
        const testIds = [
            { type: 'UUID principal', id: 'ef326557-a743-4441-ad51-ec0cc9f05ef7' },
            { type: 'Folder ID', id: '0b5db656-573e-49ed-874b-8566883b5fdd' },
            { type: 'Numéro', id: 'DOSS-001' }
        ];

        for (const test of testIds) {
            console.log(`\n📁 Test GET /api/files?dossier_id=${test.id} (${test.type})`);
            
            try {
                const response = await axios.get(`http://localhost:5001/api/files?dossier_id=${test.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                console.log('✅ SUCCÈS:', response.status);
                console.log('   Fichiers:', response.data.files?.length || 0);
                
            } catch (error) {
                console.log('❌ ERREUR:', error.response?.status, error.response?.data?.error || error.message);
                if (error.response?.data?.code) {
                    console.log('   Code:', error.response.data.code);
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Erreur générale:', error.message);
    }
}

testFilesEndpoint();