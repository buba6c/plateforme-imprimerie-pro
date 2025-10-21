const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Configuration de la base de données
const pool = new Pool({
  user: 'imprimerie_user',
  host: 'localhost',
  database: 'imprimerie_db',
  password: 'imprimerie_password',
  port: 5432,
});

async function diagnosticFichiers() {
  try {
    console.log('🔍 === DIAGNOSTIC FICHIERS 404 ===\n');

    // 1. Récupérer tous les fichiers de la base de données
    console.log('📊 1. Récupération des fichiers en base de données...');
    const result = await pool.query('SELECT * FROM fichiers ORDER BY uploaded_at DESC');
    const fichiersEnBase = result.rows;
    
    console.log(`   ✅ ${fichiersEnBase.length} fichiers trouvés en base\n`);

    // 2. Analyser chaque fichier pour voir les différents formats de chemins
    console.log('📂 2. Analyse des chemins de fichiers...');
    const cheminsDifferents = new Set();
    const fichierProblematique = fichiersEnBase.find(f => 
      (f.nom || '').includes('rav4_12m2.pdf')
    );

    if (fichierProblematique) {
      console.log('🎯 FICHIER PROBLÉMATIQUE TROUVÉ:');
      console.log('   ID:', fichierProblematique.id);
      console.log('   Dossier ID:', fichierProblematique.dossier_id);
      console.log('   Nom:', fichierProblematique.nom || 'N/A');
      console.log('   Chemin BDD:', fichierProblematique.chemin || 'N/A');
      console.log('   Type:', fichierProblematique.type || 'N/A');
      console.log('   Taille:', fichierProblematique.taille || 'N/A');
      console.log('   Uploadé par:', fichierProblematique.uploaded_by || 'N/A');
      console.log('');
    }

    fichiersEnBase.forEach(fichier => {
      if (fichier.chemin) {
        cheminsDifferents.add(fichier.chemin);
      }
    });

    console.log('   🗂️ Formats de chemins trouvés:');
    Array.from(cheminsDifferents).slice(0, 10).forEach(chemin => {
      console.log(`      ${chemin}`);
    });
    console.log(`   ... et ${Math.max(0, cheminsDifferents.size - 10)} autres\n`);

    // 3. Vérifier l'existence physique des fichiers
    console.log('🔍 3. Vérification existence physique...');
    let fichiersExistants = 0;
    let fichiersManquants = 0;
    const fichiersManquantsList = [];

    for (const fichier of fichiersEnBase) {
      // Déterminer le chemin à vérifier
      let cheminAVerifier = fichier.chemin;
      
      if (!cheminAVerifier) {
        console.log(`   ❌ Aucun chemin défini pour ID ${fichier.id}`);
        fichiersManquants++;
        continue;
      }

      // Convertir en chemin absolu si nécessaire
      if (!path.isAbsolute(cheminAVerifier)) {
        cheminAVerifier = path.join(process.cwd(), cheminAVerifier);
      }

      try {
        await fs.access(cheminAVerifier);
        fichiersExistants++;
      } catch (error) {
        fichiersManquants++;
        fichiersManquantsList.push({
          id: fichier.id,
          nom: fichier.nom || 'N/A',
          cheminBDD: fichier.chemin,
          cheminAbsolu: cheminAVerifier
        });
      }
    }

    console.log(`   ✅ Fichiers existants: ${fichiersExistants}`);
    console.log(`   ❌ Fichiers manquants: ${fichiersManquants}\n`);

    // 4. Analyser la structure physique du dossier uploads
    console.log('📁 4. Analyse structure physique dossier uploads...');
    
    try {
      const dossiersPhy = await fs.readdir('uploads');
      console.log(`   🗂️ ${dossiersPhy.length} dossiers trouvés physiquement`);
      
      // Analyser quelques dossiers pour voir leur contenu
      const dossiersAAnalyser = dossiersPhy.slice(0, 5);
      
      for (const dossier of dossiersAAnalyser) {
        try {
          const fichiersDansDossier = await fs.readdir(path.join('uploads', dossier));
          console.log(`   📂 ${dossier}: ${fichiersDansDossier.length} fichiers`);
          if (fichiersDansDossier.length > 0) {
            console.log(`      Exemple: ${fichiersDansDossier[0]}`);
          }
        } catch (e) {
          console.log(`   ❌ Erreur lecture dossier ${dossier}: ${e.message}`);
        }
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ Erreur lecture uploads: ${error.message}\n`);
    }

    // 5. Proposer des corrections
    console.log('🔧 5. Suggestions de correction...');
    
    if (fichiersManquantsList.length > 0) {
      console.log(`   🚨 ${fichiersManquantsList.length} fichiers manquants détectés:`);
      
      fichiersManquantsList.slice(0, 10).forEach(fichier => {
        console.log(`      ID ${fichier.id}: ${fichier.nom}`);
        console.log(`         BDD: ${fichier.cheminBDD}`);
        console.log(`         Absolu: ${fichier.cheminAbsolu}`);
        
        // Essayer de trouver le fichier avec un autre pattern
        const nomFichier = path.basename(fichier.cheminBDD || '');
        if (nomFichier) {
          console.log(`         Recherche: ${nomFichier}`);
        }
        console.log('');
      });
    }

    // 6. Cas spécial: Le fichier rav4_12m2.pdf
    console.log('🎯 6. Cas spécial fichier rav4_12m2.pdf...');
    
    if (fichierProblematique) {
      const dossierId = fichierProblematique.dossier_id;
      const cheminAttendu = `uploads/${dossierId}/1759679087957_rav4_12m2.pdf`;
      const cheminAbsoluAttendu = path.join(process.cwd(), cheminAttendu);
      
      console.log(`   🔍 Chemin attendu: ${cheminAttendu}`);
      console.log(`   🔍 Chemin absolu: ${cheminAbsoluAttendu}`);
      
      try {
        await fs.access(cheminAbsoluAttendu);
        console.log(`   ✅ FICHIER EXISTE PHYSIQUEMENT!`);
        
        // Vérifier le chemin en base
        const cheminEnBase = fichierProblematique.chemin;
        console.log(`   🗃️ Chemin en base: ${cheminEnBase}`);
        
        if (cheminEnBase !== cheminAttendu) {
          console.log(`   🔧 CORRECTION NÉCESSAIRE: Mettre à jour le chemin en base`);
          console.log(`      De: ${cheminEnBase}`);
          console.log(`      Vers: ${cheminAttendu}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Fichier non trouvé: ${error.message}`);
      }
    }

    console.log('\n📋 === RÉSUMÉ DU DIAGNOSTIC ===');
    console.log(`   📊 Fichiers en base: ${fichiersEnBase.length}`);
    console.log(`   ✅ Fichiers existants: ${fichiersExistants}`);
    console.log(`   ❌ Fichiers manquants: ${fichiersManquants}`);
    console.log(`   🔧 Correction recommandée: ${fichiersManquants > 0 ? 'OUI' : 'NON'}`);

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await pool.end();
  }
}

// Exécuter le diagnostic
diagnosticFichiers();