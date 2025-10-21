const axios = require('axios');

const testButtonsFix = async () => {
  console.log('🔧 Test de la correction des boutons d\'imprimeurs...\n');
  
  try {
    // Test connexion imprimeur Roland
    const rolandLogin = await axios.post('http://localhost:5003/api/auth/login', {
      email: 'roland@imprimerie.local',
      password: 'test123'
    });
    
    console.log('✅ Roland connecté');
    const token = rolandLogin.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    // Test avec la nouvelle route PATCH /status
    console.log('\n🚀 Test changement de statut avec PATCH /status...');
    try {
      const response = await axios.patch(
        'http://localhost:5003/api/dossiers/0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1/status',
        { 
          status: 'en_impression',
          comment: 'Test correction boutons imprimeurs'
        },
        { headers }
      );
      
      console.log('✅ Changement de statut réussi !');
      console.log('📄 Réponse:', response.data);
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Dossier non trouvé (404)');
        console.log('💡 Cela signifie que l\'ID du dossier n\'est pas trouvé dans la base');
      } else if (error.response?.status === 403) {
        console.log('❌ Permission refusée (403)');
        console.log('💡 L\'utilisateur n\'a pas la permission change_status sur ce dossier');
      } else {
        console.log(`❌ Erreur: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Test avec l'ancienne route PUT /statut pour comparaison
    console.log('\n🔄 Test avec l\'ancienne route PUT /statut pour comparaison...');
    try {
      const response = await axios.put(
        'http://localhost:5003/api/dossiers/0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1/statut',
        { 
          nouveau_statut: 'En impression',
          commentaire: 'Test ancienne route'
        },
        { headers }
      );
      
      console.log('✅ Ancienne route fonctionne aussi');
      
    } catch (error) {
      console.log(`❌ Ancienne route échoue: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      console.log('💡 Ceci est normal - l\'ancienne route nécessite la permission "update"');
    }
    
    // Lister les dossiers disponibles pour Roland
    console.log('\n📋 Dossiers disponibles pour Roland...');
    try {
      const dossiersResponse = await axios.get('http://localhost:5003/api/dossiers', { headers });
      console.log(`📁 Roland voit ${dossiersResponse.data.dossiers?.length || 0} dossier(s)`);
      
      const rolandDossiers = dossiersResponse.data.dossiers?.filter(d => 
        (d.type_formulaire || d.machine || '').toLowerCase().includes('roland')
      ) || [];
      
      if (rolandDossiers.length > 0) {
        const testDossier = rolandDossiers[0];
        console.log(`🎯 Test avec dossier Roland: ${testDossier.numero || testDossier.id}`);
        console.log(`   Statut: ${testDossier.statut}`);
        console.log(`   Machine: ${testDossier.type_formulaire || testDossier.machine}`);
        
        // Test sur un dossier Roland réel
        try {
          await axios.patch(
            `http://localhost:5003/api/dossiers/${testDossier.id}/status`,
            { 
              status: 'en_impression',
              comment: 'Test sur dossier Roland réel'
            },
            { headers }
          );
          console.log('✅ Changement réussi sur dossier Roland réel !');
        } catch (error) {
          console.log(`❌ Erreur sur dossier Roland: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Erreur listing dossiers: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n🎉 Test terminé - La correction utilise maintenant PATCH /status au lieu de PUT /statut');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

testButtonsFix();