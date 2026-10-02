/**
 * Test du service d'estimation avec sections
 */

const sectionsEstimationService = require('./services/sectionsEstimationService');
const dbHelper = require('./utils/dbHelper');

async function testSectionsEstimation() {
  console.log('=== Test Estimation avec Sections ===\n');

  try {
    // 1. Charger les tarifs Xerox depuis la DB
    console.log('📥 Chargement des tarifs...');
    const [tarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE (type_machine = $1 OR type_machine = $2) AND actif = TRUE',
      ['xerox', 'global']
    );
    console.log(`✅ ${tarifs.length} tarifs chargés\n`);

    // 2. Test avec une brochure (2 sections : couverture + intérieur)
    const sections = [
      {
        type: 'Couverture',
        mode_impression: 'recto_verso',
        copies: 100,
        paper_types: [
          { grammage: '250', type: 'couché', pages: 2 }
        ],
        finitions: ['pelliculage'],
        faconnage: []
      },
      {
        type: 'Intérieur',
        mode_impression: 'recto_verso',
        copies: 100,
        paper_types: [
          { grammage: '80', type: 'standard', pages: 20 }
        ],
        finitions: [],
        faconnage: ['agrafage']
      }
    ];

    console.log('📑 Test: Brochure avec 2 sections (couverture + intérieur)');
    console.log(`   - Section 1: Couverture 250g, ${sections[0].copies} ex, ${sections[0].paper_types[0].pages} pages`);
    console.log(`   - Section 2: Intérieur 80g, ${sections[1].copies} ex, ${sections[1].paper_types[0].pages} pages\n`);

    const estimation = await sectionsEstimationService.estimateWithSections(sections, tarifs);

    console.log('💰 Résultat de l\'estimation:');
    console.log(`   Prix estimé: ${estimation.prix_estime} FCFA`);
    console.log(`   Prix brut: ${estimation.prix_brut} FCFA`);
    console.log(`   Nombre de sections: ${estimation.sections_count}`);
    console.log(`   Message: ${estimation.message}\n`);

    console.log('📊 Détails par section:');
    estimation.sections_details.forEach((section, i) => {
      console.log(`   Section ${i + 1} (${section.type}):`);
      console.log(`     - Prix section: ${section.prix_section} FCFA`);
      console.log(`     - Base: ${section.details.base} FCFA`);
      console.log(`     - Finitions: ${section.details.finitions} FCFA`);
      console.log(`     - Façonnage: ${section.details.faconnage} FCFA`);
    });

    console.log('\n✅ Test terminé avec succès!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur pendant le test:', error);
    process.exit(1);
  }
}

testSectionsEstimation();
