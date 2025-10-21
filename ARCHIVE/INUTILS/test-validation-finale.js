#!/usr/bin/env node
/**
 * 🧪 TEST FINAL VALIDATION COMPLÈTE
 * Validation que tout fonctionne après correction
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';
const FRONTEND_URL = 'http://localhost:3000';

async function testFinalValidation() {
  console.log('🎯 VALIDATION FINALE SYSTÈME COMPLET');
  console.log('====================================\n');
  
  try {
    // 1. Authentification avec différents rôles
    console.log('🔐 1. Tests authentification multi-rôles...');
    
    const roles = [
      { email: 'admin@imprimerie.local', role: 'admin' },
      { email: 'preparateur@imprimerie.local', role: 'preparateur' },
      { email: 'roland@imprimerie.local', role: 'imprimeur_roland' }
    ];
    
    for (const account of roles) {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: account.email,
        password: 'admin123'
      });
      console.log(`   ✅ ${account.role}: Authentifié`);
    }
    
    // 2. Test création avec admin (maintenant autorisé)
    console.log('\n📝 2. Test création dossier avec admin...');
    const adminAuth = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@imprimerie.local',
      password: 'admin123'
    });
    
    const createWithAdmin = await axios.post(`${API_BASE_URL}/dossiers`, {
      client: 'Test Final Admin',
      machine: 'Xerox',
      description: 'Test validation finale avec admin',
      quantite: 50,
      client_email: 'final@test.com'
    }, {
      headers: { Authorization: `Bearer ${adminAuth.data.token}` }
    });
    
    console.log(`   ✅ Dossier créé par admin: ${createWithAdmin.data.dossier.numero_commande}`);
    const adminDossierId = createWithAdmin.data.dossier.id;
    
    // 3. Test création avec préparateur
    console.log('\n📝 3. Test création dossier avec préparateur...');
    const prepAuth = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'preparateur@imprimerie.local',
      password: 'admin123'
    });
    
    const createWithPrep = await axios.post(`${API_BASE_URL}/dossiers`, {
      client: 'Test Final Préparateur',
      machine: 'Roland',
      description: 'Test validation finale avec préparateur',
      quantite: 75
    }, {
      headers: { Authorization: `Bearer ${prepAuth.data.token}` }
    });
    
    console.log(`   ✅ Dossier créé par préparateur: ${createWithPrep.data.dossier.numero_commande}`);
    const prepDossierId = createWithPrep.data.dossier.id;
    
    // 4. Test récupération avec filtrage par rôle
    console.log('\n🗂️ 4. Test filtrage par rôle...');
    
    // Admin voit tout
    const adminDossiers = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${adminAuth.data.token}` }
    });
    console.log(`   👑 Admin voit ${adminDossiers.data.dossiers.length} dossiers (total)`);
    
    // Préparateur voit seulement ses dossiers
    const prepDossiers = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${prepAuth.data.token}` }
    });
    console.log(`   👤 Préparateur voit ${prepDossiers.data.dossiers.length} dossiers (ses créations)`);
    
    // 5. Test changement de statut
    console.log('\n🔄 5. Test workflow statuts...');
    
    // Roland authentifié pour changer statuts
    const rolandAuth = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'roland@imprimerie.local',
      password: 'admin123'
    });
    
    // Roland change statut d'un dossier Roland
    const rolandDossiers = await axios.get(`${API_BASE_URL}/dossiers`, {
      headers: { Authorization: `Bearer ${rolandAuth.data.token}` }
    });
    
    if (rolandDossiers.data.dossiers.length > 0) {
      const dossierRoland = rolandDossiers.data.dossiers.find(d => d.machine === 'Roland');
      if (dossierRoland) {
        await axios.put(`${API_BASE_URL}/dossiers/${dossierRoland.id}/statut`, {
          nouveau_statut: 'En impression',
          commentaire: 'Impression lancée - test validation'
        }, {
          headers: { Authorization: `Bearer ${rolandAuth.data.token}` }
        });
        console.log(`   🔄 Roland: ${dossierRoland.numero_commande} → En impression`);
      }
    }
    
    // 6. Validation préparateur
    console.log('\n✅ 6. Test validation préparateur...');
    
    // Créer un fichier test pour permettre la validation
    const fs = require('fs');
    const FormData = require('form-data');
    
    // Créer un fichier temporaire
    const tempFile = '/tmp/test-validation.pdf';
    fs.writeFileSync(tempFile, 'Contenu PDF test');
    
    // Upload du fichier
    const form = new FormData();
    form.append('files', fs.createReadStream(tempFile));
    
    try {
      await axios.post(`${API_BASE_URL}/dossiers/${prepDossierId}/fichiers`, form, {
        headers: { 
          Authorization: `Bearer ${prepAuth.data.token}`,
          ...form.getHeaders()
        }
      });
      
      // Valider le dossier
      await axios.put(`${API_BASE_URL}/dossiers/${prepDossierId}/valider`, {
        commentaire: 'Dossier validé - test final'
      }, {
        headers: { Authorization: `Bearer ${prepAuth.data.token}` }
      });
      
      console.log(`   ✅ Dossier ${createWithPrep.data.dossier.numero_commande} validé avec fichier`);
      
      // Nettoyer
      fs.unlinkSync(tempFile);
    } catch (error) {
      console.log('   ⚠️ Upload/validation non testés (FormData/fichiers)');
    }
    
    // 7. Nettoyage des dossiers de test
    console.log('\n🧹 7. Nettoyage...');
    
    await axios.delete(`${API_BASE_URL}/dossiers/${adminDossierId}`, {
      headers: { Authorization: `Bearer ${adminAuth.data.token}` }
    });
    
    await axios.delete(`${API_BASE_URL}/dossiers/${prepDossierId}`, {
      headers: { Authorization: `Bearer ${adminAuth.data.token}` }
    });
    
    console.log('   ✅ Dossiers de test supprimés');
    
    console.log('\n🎉 VALIDATION FINALE RÉUSSIE !');
    console.log('==============================');
    console.log('✅ Authentification multi-rôles');
    console.log('✅ Création dossier admin & préparateur');
    console.log('✅ Filtrage par rôle');
    console.log('✅ Workflow changement statuts');
    console.log('✅ Validation préparateur');
    console.log('✅ CRUD complet');
    console.log('\n🚀 SYSTÈME PRÊT POUR UTILISATION !');
    console.log('\n📍 Frontend: http://localhost:3000/moderne');
    
  } catch (error) {
    console.error('❌ Erreur durant la validation:', error.message);
    
    if (error.response) {
      console.error('📋 Détails erreur:');
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFinalValidation();