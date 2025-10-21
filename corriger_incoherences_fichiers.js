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

async function corrigerIncoherecesFichiers() {
  try {
    console.log('🔧 === CORRECTION INCOHÉRENCES FICHIERS ===\n');

    // 1. Identifier tous les fichiers avec des incohérences
    console.log('🔍 1. Recherche des incohérences...');
    
    const result = await pool.query('SELECT * FROM fichiers');
    const fichiers = result.rows;
    
    console.log(`   📊 ${fichiers.length} fichiers à vérifier\n`);
    
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
            chemin: cheminEnBase
          });
        }
      }
    }
    
    console.log(`🚨 ${incoherencesDetectees.length} incohérences détectées:`);
    
    if (incoherencesDetectees.length === 0) {
      console.log('   ✅ Aucune incohérence trouvée');
      return;
    }
    
    // 2. Afficher les incohérences
    for (const inc of incoherencesDetectees) {
      console.log(`\n   📄 Fichier: ${inc.nom}`);
      console.log(`      ID: ${inc.fichier_id}`);
      console.log(`      Dossier en base: ${inc.dossier_id_base}`);
      console.log(`      Dossier du chemin: ${inc.dossier_id_chemin}`);
      console.log(`      Chemin: ${inc.chemin}`);
      
      // Vérifier si le fichier existe physiquement
      const cheminAbsolu = path.join(process.cwd(), inc.chemin);
      try {
        await fs.access(cheminAbsolu);
        console.log(`      ✅ Fichier existe physiquement`);
      } catch (error) {
        console.log(`      ❌ Fichier n'existe PAS physiquement`);
      }
    }
    
    // 3. Proposer des corrections
    console.log('\n🔧 3. Corrections proposées...');
    
    for (const inc of incoherencesDetectees) {
      console.log(`\n   📄 ${inc.nom}:`);
      
      // Vérifier si les deux dossiers existent en base
      const dossierBaseResult = await pool.query('SELECT id, numero_commande, client FROM dossiers WHERE id = $1', [inc.dossier_id_base]);
      const dossierCheminResult = await pool.query('SELECT id, numero_commande, client FROM dossiers WHERE id = $1', [inc.dossier_id_chemin]);
      
      console.log(`      Dossier en base (${inc.dossier_id_base}): ${dossierBaseResult.rows.length > 0 ? '✅ Existe' : '❌ Nexiste pas'}`);
      if (dossierBaseResult.rows.length > 0) {
        const d = dossierBaseResult.rows[0];
        console.log(`         ${d.numero_commande} - ${d.client}`);
      }
      
      console.log(`      Dossier du chemin (${inc.dossier_id_chemin}): ${dossierCheminResult.rows.length > 0 ? '✅ Existe' : '❌ Nexiste pas'}`);
      if (dossierCheminResult.rows.length > 0) {
        const d = dossierCheminResult.rows[0];
        console.log(`         ${d.numero_commande} - ${d.client}`);
      }
      
      // Recommandation
      if (dossierCheminResult.rows.length > 0) {
        console.log(`      🎯 RECOMMANDATION: Mettre à jour le dossier_id vers ${inc.dossier_id_chemin}`);
      } else if (dossierBaseResult.rows.length > 0) {
        console.log(`      🎯 RECOMMANDATION: Déplacer le fichier vers uploads/${inc.dossier_id_base}/`);
      } else {
        console.log(`      ⚠️ ATTENTION: Aucun des deux dossiers n'existe en base !`);
      }
    }
    
    // 4. Correction automatique (seulement pour le fichier rav4)
    console.log('\n🛠️ 4. Correction automatique du fichier rav4...');
    
    const rav4Incoherence = incoherencesDetectees.find(inc => inc.nom.includes('rav4'));
    
    if (rav4Incoherence) {
      console.log(`\n   🎯 Correction du fichier: ${rav4Incoherence.nom}`);
      
      // Vérifier que le dossier du chemin existe en base
      const dossierCheminResult = await pool.query('SELECT id FROM dossiers WHERE id = $1', [rav4Incoherence.dossier_id_chemin]);
      
      if (dossierCheminResult.rows.length > 0) {
        console.log(`   ✅ Le dossier ${rav4Incoherence.dossier_id_chemin} existe en base`);
        
        // Mettre à jour le dossier_id dans la table fichiers
        const updateResult = await pool.query(
          'UPDATE fichiers SET dossier_id = $1 WHERE id = $2 RETURNING *',
          [rav4Incoherence.dossier_id_chemin, rav4Incoherence.fichier_id]
        );
        
        if (updateResult.rows.length > 0) {
          console.log(`   ✅ Dossier_id mis à jour avec succès !`);
          console.log(`      De: ${rav4Incoherence.dossier_id_base}`);
          console.log(`      Vers: ${rav4Incoherence.dossier_id_chemin}`);
        }
      } else {
        console.log(`   ❌ Le dossier ${rav4Incoherence.dossier_id_chemin} n'existe pas en base`);
        console.log(`   💡 Alternative: créer le dossier manquant ou déplacer le fichier`);
      }
    } else {
      console.log(`   ❌ Fichier rav4 non trouvé dans les incohérences`);
    }
    
    console.log('\n📋 === RÉSUMÉ ===');
    console.log(`   🚨 Incohérences détectées: ${incoherencesDetectees.length}`);
    console.log(`   🔧 Corrections appliquées: ${rav4Incoherence ? 1 : 0}`);
    console.log(`   ✅ Fichier rav4 devrait maintenant fonctionner`);

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await pool.end();
  }
}

// Exécuter la correction
corrigerIncoherecesFichiers();