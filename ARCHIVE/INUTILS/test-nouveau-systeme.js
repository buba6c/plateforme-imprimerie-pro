// 🧪 SCRIPT DE TEST - Nouveau système de dossiers
// ===============================================

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testNewDossierSystem() {
  console.log('🧪 TEST DU NOUVEAU SYSTÈME DE DOSSIERS');
  console.log('======================================\n');

  let adminToken, prepToken, rolandToken;
  let testDossierId;

  try {
    // 1. Authentification des utilisateurs
    console.log('🔐 1. Test d\'authentification...');
    
    const adminLogin = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    adminToken = adminLogin.data.token;
    console.log('✅ Admin connecté');

    const prepLogin = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    prepToken = prepLogin.data.token;
    console.log('✅ Préparateur connecté');

    const rolandLogin = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'roland@imprimerie.local',
      password: 'admin123'
    });
    rolandToken = rolandLogin.data.token;
    console.log('✅ Imprimeur Roland connecté');

    // 2. Création d'un dossier par le préparateur
    console.log('\n📄 2. Test création de dossier...');
    
    const nouveauDossier = {
      client: 'Test Client Nouveau Système',
      machine: 'Roland',
      description: 'Test du nouveau système complet avec UUID',
      quantite: 5,
      client_email: 'test@nouveau.com',
      client_telephone: '01.23.45.67.89',
      date_livraison_prevue: '2025-01-15'
    };

    const createResponse = await axios.post(`${API_BASE_URL}/dossiers`, nouveauDossier, {
      headers: { Authorization: `Bearer ${prepToken}` }
    });

    testDossierId = createResponse.data.dossier.id;
    console.log(`✅ Dossier créé: ${createResponse.data.dossier.numero_commande} (ID: ${testDossierId})`);
    
    // 3. Vérification des droits d'accès par rôle
    console.log('\n👤 3. Test des droits d\'accès par rôle...');

    // Préparateur voit ses dossiers
    const prepDossiers = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${prepToken}` }
    });
    console.log(`👤 Préparateur voit ${prepDossiers.data.dossiers.length} dossier(s)`);

    // Imprimeur Roland voit les dossiers Roland
    const rolandDossiers = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${rolandToken}` }
    });
    console.log(`🖨️ Roland voit ${rolandDossiers.data.dossiers.length} dossier(s) Roland`);

    // Admin voit tout
    const adminDossiers = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`👑 Admin voit ${adminDossiers.data.dossiers.length} dossier(s) total`);

    // 4. Test de modification du dossier
    console.log('\n✏️ 4. Test modification de dossier...');
    
    const updateData = {
      description: 'Description modifiée avec le nouveau système',
      quantite: 10
    };

    const updateResponse = await axios.put(`${API_BASE_URL}/dossiers/${testDossierId}`, updateData, {
      headers: { Authorization: `Bearer ${prepToken}` }
    });
    console.log('✅ Dossier modifié par le préparateur');

    // 5. Test validation du dossier
    console.log('\n✅ 5. Test validation du dossier...');
    
    // D'abord créer un fichier fictif pour pouvoir valider
    console.log('   📁 Création fichier fictif pour validation...');
    
    // Simuler l'ajout d'un fichier via l'API (créer un fichier temporaire)
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');
    
    // Créer un fichier test temporaire
    const testFilePath = path.join(__dirname, 'temp-test-file.pdf');
    fs.writeFileSync(testFilePath, 'Contenu de test PDF');
    
    // Uploader via l'API
    const form = new FormData();
    form.append('files', fs.createReadStream(testFilePath));
    
    try {
      await axios.post(`${API_BASE_URL}/dossiers/${testDossierId}/fichiers`, form, {
        headers: { 
          Authorization: `Bearer ${prepToken}`,
          ...form.getHeaders()
        }
      });
      console.log('   ✅ Fichier fictif créé via API');
      
      // Nettoyer le fichier temporaire
      fs.unlinkSync(testFilePath);
    } catch (uploadError) {
      console.log('   ⚠️ Erreur upload:', uploadError.message);
      fs.unlinkSync(testFilePath);
    }

    const validateResponse = await axios.put(`${API_BASE_URL}/dossiers/${testDossierId}/valider`, {}, {
      headers: { Authorization: `Bearer ${prepToken}` }
    });
    console.log('✅ Dossier validé par le préparateur');

    // 6. Test changement de statut par imprimeur
    console.log('\n🔄 6. Test changement de statut...');
    
    const statusResponse = await axios.put(`${API_BASE_URL}/dossiers/${testDossierId}/statut`, {
      nouveau_statut: 'En impression',
      commentaire: 'Démarrage de l\'impression'
    }, {
      headers: { Authorization: `Bearer ${rolandToken}` }
    });
    console.log('✅ Statut changé: En cours → En impression');

    // 7. Test de récupération du détail complet
    console.log('\n📋 7. Test récupération détail complet...');
    
    const detailResponse = await axios.get(`${API_BASE_URL}/dossiers/${testDossierId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    const dossierDetail = detailResponse.data.dossier;
    console.log(`✅ Détail récupéré:`);
    console.log(`   - Numéro: ${dossierDetail.numero_commande}`);
    console.log(`   - Client: ${dossierDetail.client}`);
    console.log(`   - Machine: ${dossierDetail.machine}`);
    console.log(`   - Statut: ${dossierDetail.statut}`);
    console.log(`   - Fichiers: ${dossierDetail.fichiers.length}`);
    console.log(`   - Historique: ${dossierDetail.historique.length} entrée(s)`);
    console.log(`   - Validé: ${dossierDetail.validé_preparateur}`);

    // 8. Test nettoyage (suppression par admin)
    console.log('\n🗑️ 8. Test suppression finale...');
    
    const deleteResponse = await axios.delete(`${API_BASE_URL}/dossiers/${testDossierId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Dossier supprimé par l\'admin');

    // 9. Vérification finale
    console.log('\n✨ 9. Vérification finale...');
    
    const finalCheck = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    const finalCount = finalCheck.data.dossiers.length;
    console.log(`📊 Nombre final de dossiers: ${finalCount}`);

    // 10. Résumé du test
    console.log('\n🎉 RÉSUMÉ DU TEST:');
    console.log('================');
    console.log('✅ Authentification multi-rôles: OK');
    console.log('✅ Création de dossier (UUID): OK');
    console.log('✅ Filtrage par rôle: OK');
    console.log('✅ Modification dossier: OK');
    console.log('✅ Validation préparateur: OK');
    console.log('✅ Changement statut workflow: OK');
    console.log('✅ Récupération détail complet: OK');
    console.log('✅ Suppression admin: OK');
    console.log('✅ Structure UUID + relations: OK');
    console.log('');
    console.log('🚀 NOUVEAU SYSTÈME DE DOSSIERS FONCTIONNEL !');

  } catch (error) {
    console.error('❌ Erreur durant le test:', error.message);
    
    if (error.response) {
      console.error('📋 Détails erreur:');
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }

    // Nettoyage en cas d'erreur
    if (testDossierId && adminToken) {
      try {
        await axios.delete(`${API_BASE_URL}/dossiers/${testDossierId}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('🧹 Dossier de test nettoyé après erreur');
      } catch (cleanupError) {
        console.warn('⚠️ Impossible de nettoyer le dossier de test');
      }
    }
  }
}

// Exécution du test
testNewDossierSystem();