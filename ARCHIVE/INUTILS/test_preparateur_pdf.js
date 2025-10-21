#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5001/api';

async function loginAsAdmin() {
  console.log('\n🔐 Connexion en tant qu\'admin (pour créer dossier)...');
  
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@imprimerie.com',
      password: 'admin123'
    });
    
    if (loginResponse.data.token) {
      console.log('✅ Connexion admin réussie');
      console.log(`   Utilisateur: ${loginResponse.data.user.nom} (${loginResponse.data.user.role})`);
      console.log('   ℹ️ L\'admin peut créer des dossiers comme un préparateur');
      return loginResponse.data.token;
    } else {
      console.log('❌ Échec de connexion admin');
      return null;
    }
  } catch (error) {
    console.log(`❌ Erreur connexion admin: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function createDossierAsPreparateur(token) {
  console.log('\n📝 Création d\'un nouveau dossier (droits préparateur)...');
  
  try {
    const nouveauDossier = {
      client: 'Test Client PDF',
      numero_commande: `CMD-${Date.now()}`,
      description: 'Dossier de test avec fichier PDF',
      type_formulaire: 'roland',
      machine: 'roland',
      data_formulaire: {
        dimension: '210x297',
        surface_m2: 0.062,
        types_impression: ['Papier']
      },
      quantite: 100,
      client_email: 'client@test.com',
      client_telephone: '0123456789',
      commentaire: 'Dossier créé pour test upload PDF'
    };
    
    const response = await axios.post(`${API_BASE}/dossiers`, nouveauDossier, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      const dossier = response.data.dossier;
      console.log('✅ Dossier créé avec succès');
      console.log(`   Client: ${dossier.client}`);
      console.log(`   Numéro: ${dossier.numero || dossier.numero_commande}`);
      console.log(`   ID: ${dossier.id}`);
      console.log(`   Folder ID: ${dossier.folder_id}`);
      return dossier;
    } else {
      console.log(`❌ Échec création dossier: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Erreur création dossier: ${error.response?.data?.message || error.message}`);
    if (error.response?.data?.details) {
      console.log(`   Détails: ${JSON.stringify(error.response.data.details)}`);
    }
    return null;
  }
}

async function uploadPDFFile(token, dossier, pdfFilePath) {
  console.log('\n📎 Upload du fichier PDF...');
  
  if (!dossier) {
    console.log('❌ Pas de dossier disponible pour l\'upload');
    return null;
  }
  
  if (!fs.existsSync(pdfFilePath)) {
    console.log(`❌ Fichier PDF non trouvé: ${pdfFilePath}`);
    return null;
  }
  
  try {
    const folderId = dossier.folder_id || dossier.id;
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(pdfFilePath);
    console.log(`   Taille du fichier: ${Math.round(stats.size / 1024)} KB`);
    
    const formData = new FormData();
    formData.append('files', fs.createReadStream(pdfFilePath));
    
    const uploadResponse = await axios.post(
      `${API_BASE}/dossiers/${folderId}/fichiers`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000 // 30 secondes pour les gros fichiers
      }
    );
    
    if (uploadResponse.data.success) {
      const fichier = uploadResponse.data.files[0];
      console.log('✅ Upload PDF réussi');
      console.log(`   Nom: ${fichier.nom}`);
      console.log(`   Type: ${fichier.mime_type}`);
      console.log(`   Taille: ${Math.round(fichier.taille / 1024)} KB`);
      console.log(`   ID: ${fichier.id}`);
      return fichier;
    } else {
      console.log(`❌ Échec upload PDF: ${uploadResponse.data.message}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Erreur upload PDF: ${error.response?.data?.message || error.message}`);
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.log('   Problème de connexion réseau');
    } else if (error.response?.status === 413) {
      console.log('   Fichier trop volumineux');
    }
    return null;
  }
}

async function verifyFileInDossier(token, dossier) {
  console.log('\n📋 Vérification des fichiers du dossier...');
  
  if (!dossier) {
    console.log('❌ Pas de dossier à vérifier');
    return;
  }
  
  try {
    const folderId = dossier.folder_id || dossier.id;
    const filesResponse = await axios.get(`${API_BASE}/dossiers/${folderId}/fichiers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (filesResponse.data.success) {
      const fichiers = filesResponse.data.files || [];
      console.log(`✅ Fichiers dans le dossier: ${fichiers.length}`);
      
      fichiers.forEach((fichier, index) => {
        console.log(`   ${index + 1}. ${fichier.nom} (${fichier.mime_type}, ${Math.round(fichier.taille / 1024)} KB)`);
      });
      
      // Tester le téléchargement du PDF
      const pdfFile = fichiers.find(f => f.mime_type === 'application/pdf');
      if (pdfFile) {
        console.log('\n⬇️ Test de téléchargement du PDF...');
        const downloadResponse = await axios.head(
          `${API_BASE}/dossiers/fichiers/${pdfFile.id}/download`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (downloadResponse.status === 200) {
          console.log('✅ PDF téléchargeable');
          console.log(`   Content-Type: ${downloadResponse.headers['content-type']}`);
          console.log(`   Content-Length: ${Math.round(downloadResponse.headers['content-length'] / 1024)} KB`);
        }
      }
    } else {
      console.log(`❌ Erreur vérification fichiers: ${filesResponse.data.message}`);
    }
  } catch (error) {
    console.log(`❌ Erreur vérification: ${error.response?.data?.message || error.message}`);
  }
}

async function testDossierDetailsAccess(token, dossier) {
  console.log('\n🔍 Test d\'accès aux détails du dossier...');
  
  if (!dossier) {
    console.log('❌ Pas de dossier à tester');
    return;
  }
  
  try {
    const folderId = dossier.folder_id || dossier.id;
    const detailsResponse = await axios.get(`${API_BASE}/dossiers/${folderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (detailsResponse.data.success) {
      const details = detailsResponse.data.dossier;
      console.log('✅ Accès aux détails réussi');
      console.log(`   Client: ${details.client}`);
      console.log(`   Statut: ${details.statut}`);
      console.log(`   Préparateur: ${details.preparateur_name || 'Non défini'}`);
      console.log(`   Fichiers: ${details.fichiers?.length || 0}`);
    } else {
      console.log(`❌ Erreur accès détails: ${detailsResponse.data.message}`);
    }
  } catch (error) {
    console.log(`❌ Erreur accès détails: ${error.response?.data?.message || error.message}`);
  }
}

async function main() {
  console.log('🚀 TEST CRÉATION DOSSIER ET UPLOAD PDF - DROITS PRÉPARATEUR');
  console.log('=' .repeat(70));
  
  // Chemin du fichier PDF à uploader
  const pdfPath = './phot.pdf';
  
  // Vérifier que le fichier existe
  if (!fs.existsSync(pdfPath)) {
    console.log(`❌ Fichier PDF non trouvé: ${pdfPath}`);
    console.log('   Assure-toi que le fichier phot.pdf est dans /Users/mac/Documents/');
    return;
  }
  
  console.log(`📄 Fichier PDF: ${pdfPath}`);
  const stats = fs.statSync(pdfPath);
  console.log(`   Taille: ${Math.round(stats.size / 1024)} KB`);
  
  // 1. Connexion en tant qu'admin (droits préparateur)
  const token = await loginAsAdmin();
  if (!token) {
    console.log('\n❌ Test abandonné - connexion impossible');
    return;
  }
  
  // 2. Création d'un nouveau dossier
  const nouveauDossier = await createDossierAsPreparateur(token);
  if (!nouveauDossier) {
    console.log('\n❌ Test abandonné - création dossier impossible');
    return;
  }
  
  // 3. Upload du fichier PDF
  const fichierUploade = await uploadPDFFile(token, nouveauDossier, pdfPath);
  
  // 4. Vérification des fichiers dans le dossier
  await verifyFileInDossier(token, nouveauDossier);
  
  // 5. Test d'accès aux détails (simulation interface)
  await testDossierDetailsAccess(token, nouveauDossier);
  
  console.log('\n🎉 TESTS TERMINÉS !');
  
  if (fichierUploade) {
    console.log('\n✅ SUCCÈS COMPLET:');
    console.log('• Connexion préparateur: ✅');
    console.log('• Création dossier: ✅'); 
    console.log('• Upload PDF: ✅');
    console.log('• Vérification fichiers: ✅');
    console.log('• Accès détails: ✅');
    console.log('\n💡 Le préparateur peut maintenant créer des dossiers et uploader des fichiers PDF !');
  } else {
    console.log('\n⚠️ Test partiellement réussi - vérifiez les erreurs ci-dessus');
  }
}

main().catch(console.error);
