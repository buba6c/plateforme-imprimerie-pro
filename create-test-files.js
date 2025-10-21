const fs = require('fs');
const path = require('path');
const { query } = require('./backend/config/database');

const createTestFiles = async () => {
  console.log('📁 Création de fichiers de test...\n');
  
  try {
    // Créer un répertoire pour les fichiers de test
    const testDir = path.join(__dirname, 'uploads', 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Créer quelques fichiers de test
    const testFiles = [
      {
        filename: 'test-roland.pdf',
        content: 'PDF test content for Roland machine',
        dossier_id: '0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1' // Dossier Roland
      },
      {
        filename: 'test-xerox.jpg',
        content: 'JPG test content for Xerox machine',
        dossier_id: '9aab908f-ca0b-447e-8c23-9ed57772d123' // Dossier Xerox
      }
    ];
    
    for (const testFile of testFiles) {
      // Créer le fichier physique
      const filePath = path.join(testDir, testFile.filename);
      fs.writeFileSync(filePath, testFile.content);
      
      console.log(`📄 Fichier créé: ${filePath}`);
      
      // Ajouter en base de données
      const fileData = {
        dossier_id: testFile.dossier_id,
        nom: testFile.filename,
        chemin: filePath,
        mime_type: testFile.filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        taille: Buffer.byteLength(testFile.content)
      };
      
      const insertQuery = `
        INSERT INTO fichiers (dossier_id, nom, chemin, mime_type, taille, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;
      
      const result = await query(insertQuery, [
        fileData.dossier_id,
        fileData.nom,
        fileData.chemin,
        fileData.mime_type,
        fileData.taille
      ]);
      
      console.log(`✅ Fichier ajouté en base: ID ${result.rows[0].id}`);
    }
    
    console.log('\n🎉 Fichiers de test créés avec succès !');
    
    // Lister les fichiers pour vérification
    console.log('\n📋 Vérification des fichiers en base:');
    
    const filesQuery = 'SELECT id, dossier_id, nom, chemin FROM fichiers WHERE dossier_id IN ($1, $2)';
    const filesResult = await query(filesQuery, [testFiles[0].dossier_id, testFiles[1].dossier_id]);
    
    filesResult.rows.forEach(file => {
      console.log(`  - ID: ${file.id}, Dossier: ${file.dossier_id}, Nom: ${file.nom}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
};

// Exécuter la création
if (require.main === module) {
  createTestFiles()
    .then(() => {
      console.log('\n✨ Terminé !');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Erreur générale:', error);
      process.exit(1);
    });
}

module.exports = { createTestFiles };