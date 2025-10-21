const db = require('./backend/config/database');

const createMoreTestFiles = async () => {
  console.log('📁 Création de fichiers de test supplémentaires...\n');
  
  try {
    // Créer des fichiers physiques de test
    const fs = require('fs');
    const path = require('path');
    
    const testDir = path.join(__dirname, 'uploads', 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Créer fichiers pour différentes machines
    const testFiles = [
      {
        name: 'test-xerox.pdf',
        content: 'PDF test content for Xerox machine - DIFFERENT CONTENT',
        machine: 'xerox'
      },
      {
        name: 'test-roland-2.pdf',
        content: 'PDF test content for Roland machine - FILE 2',
        machine: 'roland'
      },
      {
        name: 'test-general.pdf',
        content: 'PDF test content for general use - GENERIC',
        machine: 'general'
      }
    ];
    
    // Créer les fichiers physiques
    testFiles.forEach(file => {
      const filepath = path.join(testDir, file.name);
      fs.writeFileSync(filepath, file.content, 'utf8');
      console.log(`✅ Fichier créé: ${filepath}`);
    });
    
    // Insérer dans la base de données
    for (let file of testFiles) {
      const filepath = path.join(testDir, file.name);
      
      await db.query(`
        INSERT INTO fichiers (id, dossier_id, nom, chemin, mime_type, taille, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        require('crypto').randomUUID(),
        '0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', // Dossier Roland
        file.name,
        filepath,
        'application/pdf',
        file.content.length
      ]);
      
      console.log(`✅ Fichier ${file.name} ajouté en base`);
    }
    
    // Créer aussi un dossier Xerox pour test
    const xeroxDossierId = require('crypto').randomUUID();
    
    // Ajouter des fichiers au dossier Xerox
    await db.query(`
      INSERT INTO fichiers (id, dossier_id, nom, chemin, mime_type, taille, uploaded_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      require('crypto').randomUUID(),
      xeroxDossierId,
      'exclusive-xerox.pdf',
      path.join(testDir, 'exclusive-xerox.pdf'),
      'application/pdf',
      25
    ]);
    
    // Créer le fichier physique pour Xerox
    fs.writeFileSync(path.join(testDir, 'exclusive-xerox.pdf'), 'EXCLUSIVE XEROX CONTENT', 'utf8');
    
    console.log(`✅ Dossier Xerox créé avec ID: ${xeroxDossierId}`);
    
    // Lister tous les fichiers en base
    const allFiles = await db.query('SELECT id, dossier_id, nom, chemin FROM fichiers ORDER BY uploaded_at DESC LIMIT 10');
    console.log('\n📋 Fichiers en base:');
    allFiles.rows.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.nom} (${file.id.substring(0, 8)}...) -> ${file.dossier_id.substring(0, 8)}...`);
    });
    
    console.log('\n🎯 Tests à effectuer:');
    console.log('1. Imprimeur Roland accède aux fichiers du dossier Roland');
    console.log('2. Imprimeur Xerox tente d\'accéder aux fichiers Roland (devrait être bloqué)'); 
    console.log('3. Vérifier que les contenus téléchargés correspondent aux fichiers demandés');
    
    return { rolandDossier: '0b7ea3d0-2f1f-44e5-8e4f-4803ccee95b1', xeroxDossier: xeroxDossierId };
    
  } catch (error) {
    console.error('❌ Erreur création fichiers test:', error);
  }
};

createMoreTestFiles()
  .then((result) => {
    console.log('\n✅ Fichiers de test créés:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });