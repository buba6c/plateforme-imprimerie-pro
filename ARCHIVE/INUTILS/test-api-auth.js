const axios = require('axios');

// Configuration de test
const BASE_URL = 'http://localhost:3001';

// Fonction de test d'authentification
async function testAuthentication() {
    console.log('🔍 Test d\'authentification API...\n');
    
    try {
        // Test 1: Login admin
        console.log('1. Test login admin...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'admin@imprimerie.local',
            password: 'admin123'
        });
        
        console.log('✅ Login réussi');
        const token = loginResponse.data.token;
        console.log('🔑 Token reçu:', token.substring(0, 20) + '...\n');
        
        // Test 2: Récupérer les dossiers avec auth
        console.log('2. Test récupération dossiers avec authentification...');
        const dossiersResponse = await axios.get(`${BASE_URL}/api/dossiers`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Dossiers récupérés avec succès');
        console.log('📊 Nombre de dossiers:', dossiersResponse.data.length);
        
        if (dossiersResponse.data.length > 0) {
            const firstDossier = dossiersResponse.data[0];
            console.log('📄 Premier dossier:', {
                id: firstDossier.id,
                nom: firstDossier.nom,
                statut: firstDossier.statut,
                client: firstDossier.client
            });
            
            // Test 3: Récupérer les détails d'un dossier spécifique
            console.log('\n3. Test récupération détails dossier...');
            const dossierDetailResponse = await axios.get(`${BASE_URL}/api/dossiers/${firstDossier.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Détails dossier récupérés avec succès');
            console.log('📋 Détails:', {
                id: dossierDetailResponse.data.id,
                nom: dossierDetailResponse.data.nom,
                statut: dossierDetailResponse.data.statut,
                nb_fichiers: dossierDetailResponse.data.fichiers ? dossierDetailResponse.data.fichiers.length : 0
            });
            
            // Test 4: Récupérer les fichiers du dossier
            if (dossierDetailResponse.data.fichiers && dossierDetailResponse.data.fichiers.length > 0) {
                console.log('\n4. Test récupération fichiers...');
                const filesResponse = await axios.get(`${BASE_URL}/api/files/dossier/${firstDossier.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('✅ Fichiers récupérés avec succès');
                console.log('📁 Nombre de fichiers:', filesResponse.data.length);
                
                if (filesResponse.data.length > 0) {
                    const firstFile = filesResponse.data[0];
                    console.log('📄 Premier fichier:', {
                        id: firstFile.id,
                        nom: firstFile.nom_fichier,
                        type: firstFile.type_mime,
                        taille: firstFile.taille
                    });
                }
            }
        }
        
        console.log('\n✅ TOUS LES TESTS PASSÉS - L\'authentification fonctionne correctement');
        
    } catch (error) {
        console.error('\n❌ ERREUR DE TEST:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        
        if (error.response?.status === 401) {
            console.log('\n🚨 PROBLÈME D\'AUTHENTIFICATION DÉTECTÉ');
            console.log('- Vérifiez les credentials dans la base de données');
            console.log('- Vérifiez la configuration JWT dans le backend');
        } else if (error.response?.status === 404) {
            console.log('\n🚨 ENDPOINT NON TROUVÉ');
            console.log('- Vérifiez que le backend est démarré sur le port 3001');
            console.log('- Vérifiez les routes dans server.js');
        }
    }
}

// Test sans authentification pour comparaison
async function testWithoutAuth() {
    console.log('\n🔍 Test sans authentification (doit échouer)...\n');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/dossiers`);
        console.log('⚠️  Attention: Accès autorisé sans authentification!');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Sécurité OK: Accès refusé sans authentification (401)');
        } else {
            console.log('❌ Erreur inattendue:', error.response?.status, error.response?.statusText);
        }
    }
}

// Exécution des tests
async function runAllTests() {
    console.log('🚀 DÉBUT DES TESTS API - AUTHENTIFICATION\n');
    console.log('='.repeat(50));
    
    await testAuthentication();
    await testWithoutAuth();
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 FIN DES TESTS');
}

runAllTests().catch(console.error);