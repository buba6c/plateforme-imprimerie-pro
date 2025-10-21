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

async function corrigerToutesLesIncoherences() {
  try {
    console.log('🔧 === CORRECTION COMPLÈTE DES INCOHÉRENCES ===\n');

    // 1. Identifier toutes les incohérences
    console.log('🔍 1. Recherche de toutes les incohérences...');
    
    const result = await pool.query('SELECT * FROM fichiers ORDER BY uploaded_at DESC');
    const fichiers = result.rows;
    
    let incoherencesDetectees = [];
    
    for (const fichier of fichiers) {
      const cheminEnBase = fichier.chemin;
      const dossierIdEnBase = fichier.dossier_id;
      
      // Extraire le dossier_id du chemin physique
      const match = cheminEnBase.match(/uploads\/([^\/]+)\//);
      if (match) {
        const dossierIdDuChemin = match[1];
        
        if (dossierIdDuChemin !== dossierIdEnBase) {
          incoherencesDetectees.push({
            fichier_id: fichier.id,
            nom: fichier.nom,
            dossier_id_base: dossierIdEnBase,
            dossier_id_chemin: dossierIdDuChemin,
            chemin_actuel: cheminEnBase
          });
        }
      }
    }
    
    console.log(`   🚨 ${incoherencesDetectees.length} incohérences détectées\n`);

    // 2. Correction automatique pour tous les fichiers
    console.log('🛠️ 2. Correction automatique...');
    
    let correctionsReussies = 0;
    let correctionsEchouees = 0;

    for (const inc of incoherencesDetectees) {
      console.log(`\n   📄 Correction: ${inc.nom}`);
      
      try {
        // Vérifier si le dossier cible existe en base
        const dossierResult = await pool.query('SELECT id FROM dossiers WHERE id = $1', [inc.dossier_id_base]);
        
        if (dossierResult.rows.length === 0) {
          console.log(`      ❌ Dossier ${inc.dossier_id_base} n'existe pas en base - SKIP`);
          correctionsEchouees++;
          continue;
        }

        // Créer le dossier physique de destination s'il n'existe pas
        const dossierDestination = path.join(process.cwd(), 'uploads', inc.dossier_id_base);
        try {
          await fs.mkdir(dossierDestination, { recursive: true });
        } catch (mkdirError) {
          // Ignore si le dossier existe déjà
        }

        // Construire les chemins source et destination
        const cheminSource = path.join(process.cwd(), inc.chemin_actuel);
        const nomFichier = path.basename(inc.chemin_actuel);
        const cheminDestination = path.join(dossierDestination, nomFichier);
        const cheminRelatifDestination = `uploads/${inc.dossier_id_base}/${nomFichier}`;

        // Vérifier que le fichier source existe
        try {
          await fs.access(cheminSource);
        } catch (accessError) {
          console.log(`      ❌ Fichier source introuvable: ${cheminSource}`);
          correctionsEchouees++;
          continue;
        }

        // Copier le fichier vers la destination (on garde l'original pour sécurité)
        try {
          await fs.copyFile(cheminSource, cheminDestination);
          console.log(`      ✅ Fichier copié vers: ${cheminRelatifDestination}`);
        } catch (copyError) {
          console.log(`      ❌ Erreur copie: ${copyError.message}`);
          correctionsEchouees++;
          continue;
        }

        // Mettre à jour le chemin en base de données
        const updateResult = await pool.query(
          'UPDATE fichiers SET chemin = $1 WHERE id = $2 RETURNING *',
          [cheminRelatifDestination, inc.fichier_id]
        );

        if (updateResult.rows.length > 0) {
          console.log(`      ✅ Chemin mis à jour en base`);
          correctionsReussies++;
        } else {
          console.log(`      ❌ Échec mise à jour base`);
          correctionsEchouees++;
        }

      } catch (error) {
        console.log(`      ❌ Erreur générale: ${error.message}`);
        correctionsEchouees++;
      }
    }

    // 3. Nettoyage optionnel des anciens fichiers
    console.log('\n🧹 3. Nettoyage des anciens fichiers...');
    console.log('   ⚠️ Les fichiers originaux ont été conservés pour sécurité');
    console.log('   💡 Vous pouvez les supprimer manuellement après vérification');

    // 4. Vérification finale
    console.log('\n✅ 4. Vérification finale...');
    
    // Re-vérifier les incohérences
    const resultFinal = await pool.query('SELECT * FROM fichiers');
    const fichiersFinaux = resultFinal.rows;
    
    let incoherencesRestantes = 0;
    
    for (const fichier of fichiersFinaux) {
      const cheminEnBase = fichier.chemin;
      const dossierIdEnBase = fichier.dossier_id;
      
      const match = cheminEnBase.match(/uploads\/([^\/]+)\//);
      if (match) {
        const dossierIdDuChemin = match[1];
        if (dossierIdDuChemin !== dossierIdEnBase) {
          incoherencesRestantes++;
        }
      }
    }

    console.log('\n📋 === RÉSUMÉ COMPLET ===');
    console.log(`   🚨 Incohérences détectées: ${incoherencesDetectees.length}`);
    console.log(`   ✅ Corrections réussies: ${correctionsReussies}`);
    console.log(`   ❌ Corrections échouées: ${correctionsEchouees}`);
    console.log(`   🔄 Incohérences restantes: ${incoherencesRestantes}`);
    
    if (incoherencesRestantes === 0) {
      console.log('\n🎉 SUCCÈS TOTAL! Tous les fichiers sont maintenant cohérents');
    } else {
      console.log('\n⚠️ Quelques incohérences subsistent - vérification manuelle recommandée');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la correction complète:', error);
  } finally {
    await pool.end();
  }
}

// Exécuter la correction complète
corrigerToutesLesIncoherences();