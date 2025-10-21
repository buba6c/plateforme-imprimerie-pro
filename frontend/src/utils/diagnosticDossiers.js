/**
 * 🔍 Script de diagnostic pour analyser les IDs des dossiers
 * À utiliser dans la console du navigateur pour détecter les problèmes d'ID
 */

// Fonction principale de diagnostic
window.diagnoseDossiers = (dossiers) => {
  console.log('🔍 === DIAGNOSTIC DES DOSSIERS ===');
  console.log(`Total de dossiers à analyser: ${dossiers?.length || 0}`);
  
  if (!dossiers || !Array.isArray(dossiers) || dossiers.length === 0) {
    console.error('❌ Aucun dossier à analyser');
    return;
  }

  const results = {
    total: dossiers.length,
    valides: [],
    invalides: [],
    problemes: []
  };

  dossiers.forEach((dossier, index) => {
    const analysis = {
      index,
      numero: dossier.numero_commande || dossier.numero || 'N/A',
      client: dossier.client_nom || dossier.client || 'N/A',
      allIds: {
        id: dossier.id,
        folder_id: dossier.folder_id,
        dossier_id: dossier.dossier_id,
        numero_dossier: dossier.numero_dossier,
        numero: dossier.numero,
      },
      extractedId: dossier.id || dossier.folder_id || dossier.dossier_id || dossier.numero_dossier || dossier.numero,
      status: '✅ OK'
    };

    // Vérifications
    const extractedId = analysis.extractedId;
    
    if (!extractedId) {
      analysis.status = '❌ AUCUN ID';
      analysis.probleme = 'Aucun ID trouvé dans aucun champ';
      results.invalides.push(analysis);
      results.problemes.push(analysis);
    } else if (extractedId === null || extractedId === undefined) {
      analysis.status = '❌ ID NULL/UNDEFINED';
      analysis.probleme = 'ID est null ou undefined';
      results.invalides.push(analysis);
      results.problemes.push(analysis);
    } else {
      const strId = String(extractedId).trim();
      if (strId === '' || strId === 'null' || strId === 'undefined') {
        analysis.status = '❌ ID INVALIDE (STRING)';
        analysis.probleme = `ID est une string invalide: "${strId}"`;
        results.invalides.push(analysis);
        results.problemes.push(analysis);
      } else {
        results.valides.push(analysis);
      }
    }
  });

  console.log('\n📊 === RÉSULTATS ===');
  console.log(`✅ Dossiers valides: ${results.valides.length}/${results.total}`);
  console.log(`❌ Dossiers invalides: ${results.invalides.length}/${results.total}`);
  
  if (results.problemes.length > 0) {
    console.log('\n⚠️ === DOSSIERS AVEC PROBLÈMES ===');
    results.problemes.forEach(p => {
      console.log(`\n🔴 Dossier #${p.index + 1}:`);
      console.log(`   Numéro: ${p.numero}`);
      console.log(`   Client: ${p.client}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Problème: ${p.probleme}`);
      console.log(`   IDs disponibles:`, p.allIds);
    });
  }

  if (results.valides.length > 0) {
    console.log('\n✅ === DOSSIERS VALIDES (premiers 3) ===');
    results.valides.slice(0, 3).forEach(v => {
      console.log(`\n🟢 Dossier #${v.index + 1}:`);
      console.log(`   Numéro: ${v.numero}`);
      console.log(`   Client: ${v.client}`);
      console.log(`   ID extrait: ${v.extractedId}`);
      console.log(`   IDs disponibles:`, v.allIds);
    });
  }

  console.log('\n💾 Résultats complets stockés dans window.lastDiagnostic');
  window.lastDiagnostic = results;
  
  return results;
};

// Fonction pour tester un dossier spécifique
window.testDossier = (dossier) => {
  console.log('🧪 === TEST DOSSIER UNIQUE ===');
  console.log('Dossier reçu:', dossier);
  
  const extractValidId = (value) => {
    if (!value || value === null || value === undefined) {
      console.log(`  ❌ Valeur rejetée (null/undefined):`, value);
      return null;
    }
    const strValue = String(value).trim();
    if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
      console.log(`  ❌ Valeur rejetée (string invalide): "${strValue}"`);
      return null;
    }
    console.log(`  ✅ Valeur acceptée:`, value);
    return value;
  };

  console.log('\n🔍 Test de chaque champ ID:');
  console.log('1. dossierId (prop):', extractValidId(dossier.dossierId));
  console.log('2. folder_id:', extractValidId(dossier.folder_id));
  console.log('3. id:', extractValidId(dossier.id));
  console.log('4. dossier_id:', extractValidId(dossier.dossier_id));
  console.log('5. numero_dossier:', extractValidId(dossier.numero_dossier));
  console.log('6. numero:', extractValidId(dossier.numero));

  const effectiveId = extractValidId(dossier.dossierId) || 
                      extractValidId(dossier.folder_id) || 
                      extractValidId(dossier.id) || 
                      extractValidId(dossier.dossier_id) ||
                      extractValidId(dossier.numero_dossier) ||
                      extractValidId(dossier.numero);

  console.log('\n🎯 ID final extrait:', effectiveId);
  
  if (effectiveId) {
    console.log('✅ Dossier VALIDE - peut être ouvert');
    console.log(`URL qui sera appelée: GET /api/dossiers/${effectiveId}`);
  } else {
    console.log('❌ Dossier INVALIDE - va causer une erreur');
    console.log('⚠️ Aucun ID valide trouvé dans les champs disponibles');
  }
  
  return effectiveId;
};

console.log('✅ Scripts de diagnostic chargés!');
console.log('');
console.log('📝 Utilisation:');
console.log('');
console.log('1. Pour diagnostiquer tous les dossiers:');
console.log('   diagnoseDossiers(dossiers)');
console.log('');
console.log('2. Pour tester un dossier spécifique:');
console.log('   testDossier(dossier)');
console.log('');
console.log('💡 Tip: Copiez la liste des dossiers depuis votre composant');
console.log('   et passez-la à diagnoseDossiers()');
