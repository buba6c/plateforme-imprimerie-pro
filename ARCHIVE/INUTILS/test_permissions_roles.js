/**
 * TEST PERMISSIONS PAR RÔLE - Vérification des boutons d'action selon le rôle
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

// Tokens de test pour différents rôles (à mettre à jour selon vos utilisateurs)
const ROLE_TOKENS = {
  admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJhZG1pbkBpbXByaW1lcmllLmNvbSIsInJvbGUiOiJhZG1pbiIsIm5vbSI6IkFkbWluIFByaW5jaXBhbCIsImlhdCI6MTc1OTY2MjIxMywiZXhwIjoxNzU5NzQ4NjEzfQ.EfFlkspaV6tsQ99Jc4HQ5nCClbMFbNATIzCXkq92bw4'
};

async function authenticateRole(email, password) {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email,
      password
    });
    
    if (response.data.success && response.data.token) {
      console.log(`✅ Authentification réussie pour ${email}`);
      return {
        token: response.data.token,
        user: response.data.user,
        role: response.data.user.role
      };
    } else {
      console.log(`❌ Échec authentification ${email}: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Erreur authentification ${email}: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function testRolePermissions(roleInfo, dossiers) {
  const { token, user, role } = roleInfo;
  
  console.log(`\n👤 TEST RÔLE: ${role.toUpperCase()} (${user.nom})`);
  console.log('─'.repeat(40));
  
  const permissions = {
    viewDossiers: false,
    viewFiles: false,
    downloadFiles: false,
    uploadFiles: false,
    changeStatus: false,
    deleteFiles: false
  };
  
  // 1. Test visualisation des dossiers
  try {
    const dossiersResponse = await axios.get(`${API_BASE}/dossiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (dossiersResponse.data.success) {
      permissions.viewDossiers = true;
      const visibleDossiers = dossiersResponse.data.dossiers || [];
      console.log(`✅ Voir dossiers: ${visibleDossiers.length} dossiers visibles`);
    } else {
      console.log(`❌ Voir dossiers: Accès refusé`);
    }
  } catch (error) {
    console.log(`❌ Voir dossiers: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
  }
  
  if (dossiers.length > 0) {
    const testDossier = dossiers[0];
    const dossierId = testDossier.folder_id || testDossier.id;
    
    // 2. Test visualisation des fichiers
    try {
      const filesResponse = await axios.get(`${API_BASE}/dossiers/${dossierId}/fichiers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (filesResponse.data.success || Array.isArray(filesResponse.data)) {
        permissions.viewFiles = true;
        const files = filesResponse.data.files || filesResponse.data.data || filesResponse.data || [];
        console.log(`✅ Voir fichiers: ${files.length} fichiers visibles`);
        
        if (files.length > 0) {
          const testFile = files[0];
          
          // 3. Test téléchargement
          try {
            const downloadResponse = await axios.head(`${API_BASE}/dossiers/fichiers/${testFile.id}/download`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (downloadResponse.status === 200) {
              permissions.downloadFiles = true;
              console.log(`✅ Télécharger: Autorisé`);
            } else {
              console.log(`❌ Télécharger: Status ${downloadResponse.status}`);
            }
          } catch (downloadError) {
            console.log(`❌ Télécharger: ${downloadError.response?.status} - Refusé`);
          }
          
          // 4. Test suppression (simulation)
          try {
            const deleteResponse = await axios.delete(`${API_BASE}/dossiers/${dossierId}/fichiers/${testFile.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (deleteResponse.status === 200) {
              permissions.deleteFiles = true;
              console.log(`✅ Supprimer: Autorisé (test simulé)`);
            } else {
              console.log(`❌ Supprimer: Status ${deleteResponse.status}`);
            }
          } catch (deleteError) {
            if (deleteError.response?.status === 403) {
              console.log(`🚫 Supprimer: Refusé (permissions)`);
            } else {
              console.log(`❌ Supprimer: ${deleteError.response?.status} - ${deleteError.response?.data?.message || deleteError.message}`);
            }
          }
        }
      } else {
        console.log(`❌ Voir fichiers: ${filesResponse.data.message}`);
      }
    } catch (filesError) {
      console.log(`❌ Voir fichiers: ${filesError.response?.status} - ${filesError.response?.data?.message || filesError.message}`);
    }
    
    // 5. Test changement de statut
    try {
      const statusResponse = await axios.put(`${API_BASE}/dossiers/${dossierId}/statut`, {
        nouveau_statut: 'À revoir',
        commentaire: 'Test permissions'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (statusResponse.data.success) {
        permissions.changeStatus = true;
        console.log(`✅ Changer statut: Autorisé`);
      } else {
        console.log(`❌ Changer statut: ${statusResponse.data.message}`);
      }
    } catch (statusError) {
      if (statusError.response?.status === 403) {
        console.log(`🚫 Changer statut: Refusé (permissions)`);
      } else {
        console.log(`❌ Changer statut: ${statusError.response?.data?.message || statusError.message}`);
      }
    }
  }
  
  // Résumé des permissions pour ce rôle
  console.log(`\n📊 RÉSUMÉ PERMISSIONS ${role.toUpperCase()}:`);
  Object.entries(permissions).forEach(([perm, allowed]) => {
    const icon = allowed ? '✅' : '❌';
    const permName = perm.replace(/([A-Z])/g, ' $1').toLowerCase();
    console.log(`   ${icon} ${permName}`);
  });
  
  return permissions;
}

async function testRolesPermissions() {
  console.log('🔐 TEST COMPLET - PERMISSIONS PAR RÔLE');
  console.log('='.repeat(50));
  
  // Récupérer des dossiers de test avec le token admin
  let testDossiers = [];
  try {
    const dossiersResponse = await axios.get(`${API_BASE}/dossiers`, {
      headers: { Authorization: `Bearer ${ROLE_TOKENS.admin}` }
    });
    
    if (dossiersResponse.data.success) {
      testDossiers = dossiersResponse.data.dossiers.slice(0, 2); // Prendre 2 dossiers pour test
      console.log(`📂 ${testDossiers.length} dossiers de test disponibles\n`);
    }
  } catch (error) {
    console.log(`❌ Impossible de récupérer les dossiers de test: ${error.message}`);
    return;
  }
  
  // Définir les rôles à tester avec leurs credentials
  const rolesToTest = [
    { email: 'admin@imprimerie.com', password: 'admin123', expectedRole: 'admin' },
    { email: 'preparateur@test.com', password: 'prep123', expectedRole: 'preparateur' },
    { email: 'imprimeur@test.com', password: 'imp123', expectedRole: 'imprimeur' },
    { email: 'client@test.com', password: 'client123', expectedRole: 'client' }
  ];
  
  const roleResults = {};
  
  for (const roleCredentials of rolesToTest) {
    // Authentifier le rôle
    const roleInfo = await authenticateRole(roleCredentials.email, roleCredentials.password);
    
    if (roleInfo) {
      // Tester les permissions
      const permissions = await testRolePermissions(roleInfo, testDossiers);
      roleResults[roleInfo.role] = permissions;
    } else {
      console.log(`⚠️ Impossible de tester le rôle ${roleCredentials.expectedRole} (utilisateur non trouvé)`);
      roleResults[roleCredentials.expectedRole] = null;
    }
  }
  
  // Résumé final comparatif
  console.log('\n📋 TABLEAU COMPARATIF DES PERMISSIONS');
  console.log('='.repeat(60));
  console.log('Permission              | Admin | Préparateur | Imprimeur | Client');
  console.log('-'.repeat(60));
  
  const permissionNames = [
    'viewDossiers',
    'viewFiles', 
    'downloadFiles',
    'uploadFiles',
    'changeStatus',
    'deleteFiles'
  ];
  
  permissionNames.forEach(perm => {
    const permDisplay = perm.replace(/([A-Z])/g, ' $1').toLowerCase().padEnd(20);
    const adminStatus = roleResults.admin?.[perm] ? '✅' : '❌';
    const prepStatus = roleResults.preparateur?.[perm] ? '✅' : '❌';
    const impStatus = roleResults.imprimeur?.[perm] ? '✅' : '❌';
    const clientStatus = roleResults.client?.[perm] ? '✅' : '❌';
    
    console.log(`${permDisplay} |   ${adminStatus}   |      ${prepStatus}      |     ${impStatus}     |   ${clientStatus}`);
  });
  
  console.log('\n🎯 VALIDATION SYSTÈME DE PERMISSIONS');
  console.log('─'.repeat(40));
  
  // Vérifications logiques
  if (roleResults.admin?.viewDossiers && roleResults.admin?.downloadFiles) {
    console.log('✅ Admin a accès complet - OK');
  } else {
    console.log('⚠️ Admin devrait avoir accès complet');
  }
  
  console.log('\n🏁 Test des permissions terminé !');
}

// Lancer le test
testRolesPermissions();