const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function testAttribution() {
  console.log('════════════════════════════════════════════════════════');
  console.log('🧪 Test : Attribution correcte du dossier au créateur du devis');
  console.log('════════════════════════════════════════════════════════\n');
  
  try {
    // 1. Login Préparateur A
    console.log('1️⃣ Connexion Préparateur A...');
    const prepALogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'preparateur@evocom.ci',
      password: 'prep123'
    });
    const tokenA = prepALogin.data.token;
    const prepAId = prepALogin.data.user.id;
    const prepAName = `${prepALogin.data.user.prenom} ${prepALogin.data.user.nom}`;
    console.log(`✅ Préparateur A connecté`);
    console.log(`   ID: ${prepAId}`);
    console.log(`   Nom: ${prepAName}\n`);
    
    // 2. Préparateur A crée un devis
    console.log('2️⃣ Préparateur A crée un devis...');
    const devisRes = await axios.post(
      `${API_URL}/devis`,
      {
        machine_type: 'roland',
        client_nom: 'Client Test Attribution',
        client_contact: '0700000000',
        data_json: {
          type_support: 'Bâche',
          largeur: '200',
          hauteur: '150',
          unite: 'cm',
          nombre_exemplaires: '1'
        },
        notes: 'Test attribution dossier au créateur du devis'
      },
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    const devisId = devisRes.data.devis.id;
    const devisUserId = devisRes.data.devis.user_id;
    const devisNumero = devisRes.data.devis.numero;
    console.log(`✅ Devis créé par Préparateur A`);
    console.log(`   Devis ID: ${devisId}`);
    console.log(`   Numéro: ${devisNumero}`);
    console.log(`   user_id du devis: ${devisUserId}\n`);
    
    // Vérification intermédiaire
    if (devisUserId !== prepAId) {
      console.log('❌ ERREUR : Le devis n\'est pas attribué au bon préparateur !');
      console.log(`   Attendu: ${prepAId}, Reçu: ${devisUserId}`);
      return;
    }
    
    // 3. Valider le devis
    console.log('3️⃣ Validation du devis...');
    await axios.put(
      `${API_URL}/devis/${devisId}`,
      { statut: 'valide', prix_final: 50000 },
      { headers: { Authorization: `Bearer ${tokenA}` } }
    );
    console.log('✅ Devis validé\n');
    
    // 4. Login Admin
    console.log('4️⃣ Connexion Admin...');
    const adminLogin = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@evocom.ci',
      password: 'admin123'
    });
    const tokenAdmin = adminLogin.data.token;
    const adminId = adminLogin.data.user.id;
    const adminName = `${adminLogin.data.user.prenom} ${adminLogin.data.user.nom}`;
    console.log(`✅ Admin connecté`);
    console.log(`   ID: ${adminId}`);
    console.log(`   Nom: ${adminName}\n`);
    
    // 5. Admin convertit le devis
    console.log('5️⃣ Admin convertit le devis du Préparateur A...');
    console.log(`   ⚠️  L'admin (${adminName}) va convertir le devis`);
    console.log(`   🎯 Le dossier DOIT être attribué au Préparateur A (${prepAName})\n`);
    
    const convertRes = await axios.post(
      `${API_URL}/devis/${devisId}/convert`,
      {},
      { headers: { Authorization: `Bearer ${tokenAdmin}` } }
    );
    
    const dossierCreated = convertRes.data.dossier;
    console.log('✅ Conversion réussie !');
    console.log(`   Dossier créé: ${dossierCreated.numero}`);
    console.log(`   folder_id: ${dossierCreated.folder_id}\n`);
    
    // 6. Vérifier le propriétaire du dossier
    console.log('6️⃣ Vérification du propriétaire du dossier...');
    
    // Récupérer le dossier depuis la base
    const dossierRes = await axios.get(
      `${API_URL}/dossiers?filter=tous`,
      { headers: { Authorization: `Bearer ${tokenAdmin}` } }
    );
    
    const dossier = dossierRes.data.dossiers.find(
      d => d.folder_id === dossierCreated.folder_id
    );
    
    if (!dossier) {
      console.log('❌ ERREUR : Dossier non trouvé dans la liste !');
      return;
    }
    
    // Déterminer le propriétaire du dossier
    const dossierId = dossier.user_id || dossier.created_by || dossier.preparateur_id;
    
    console.log(`\n📊 Détails du dossier créé :`);
    console.log(`   Numéro: ${dossier.numero}`);
    console.log(`   folder_id: ${dossier.folder_id}`);
    console.log(`   user_id: ${dossier.user_id || 'N/A'}`);
    console.log(`   created_by: ${dossier.created_by || 'N/A'}`);
    console.log(`   preparateur_id: ${dossier.preparateur_id || 'N/A'}`);
    console.log(`   source: ${dossier.source}`);
    console.log(`   statut: ${dossier.statut}`);
    console.log(`   client: ${dossier.client}`);
    console.log('');
    
    // 7. Vérification finale
    console.log('════════════════════════════════════════════════════════');
    console.log('🔍 VÉRIFICATION FINALE');
    console.log('════════════════════════════════════════════════════════\n');
    
    console.log(`👤 Préparateur qui a créé le devis : ${prepAName} (ID: ${prepAId})`);
    console.log(`👨‍💼 Utilisateur qui a converti : ${adminName} (ID: ${adminId})`);
    console.log(`📁 Propriétaire du dossier créé : ID ${dossierId}\n`);
    
    if (dossierId === prepAId) {
      console.log('✅✅✅ TEST RÉUSSI ! ✅✅✅');
      console.log('');
      console.log(`Le dossier ${dossier.numero} appartient bien au Préparateur A`);
      console.log(`(${prepAName}, ID: ${prepAId})`);
      console.log('');
      console.log('Même si c\'est l\'Admin qui a effectué la conversion,');
      console.log('le dossier est correctement attribué au créateur du devis !');
      console.log('');
      console.log('🎉 L\'attribution fonctionne correctement !');
    } else {
      console.log('❌❌❌ TEST ÉCHOUÉ ! ❌❌❌');
      console.log('');
      console.log(`Le dossier appartient à l'utilisateur ID ${dossierId}`);
      console.log(`Il devrait appartenir au Préparateur A (ID: ${prepAId})`);
      console.log('');
      console.log('🔧 Correction nécessaire :');
      console.log('   Voir le fichier CORRECTION_ATTRIBUTION_DOSSIER.md');
      console.log('   Utiliser le code corrigé pour backend/services/conversionService.js');
    }
    
    console.log('');
    console.log('════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('');
    console.error('════════════════════════════════════════════════════════');
    console.error('❌ ERREUR DURANT LE TEST');
    console.error('════════════════════════════════════════════════════════');
    console.error('');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Erreur:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
    
    console.error('');
    console.error('💡 Vérifications :');
    console.error('   1. Le backend est-il démarré ? (pm2 status backend)');
    console.error('   2. Les comptes existent-ils ?');
    console.error('      - preparateur@evocom.ci / prep123');
    console.error('      - admin@evocom.ci / admin123');
    console.error('   3. Les migrations sont-elles appliquées ?');
    console.error('');
  }
}

// Exécuter le test
testAttribution();
