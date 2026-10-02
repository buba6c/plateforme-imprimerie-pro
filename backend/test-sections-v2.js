const sectionsEstimationService = require('./services/sectionsEstimationService');
const dbHelper = require('./utils/dbHelper');

async function test() {
  console.log('=== Test Estimation Sections v2 (avec mapping correct) ===\n');

  try {
    const [tarifs] = await dbHelper.query(
      'SELECT * FROM tarifs_config WHERE (type_machine = $1 OR type_machine = $2) AND actif = TRUE',
      ['xerox', 'global']
    );
    console.log(`✅ ${tarifs.length} tarifs chargés\n`);

    // Test avec format et couleur explicites
    const sections = [
      {
        type: 'Couverture',
        mode_impression: 'recto_verso',
        copies: 100,
        paper_types: [
          { grammage: '250', type: 'couché', format: 'A4', couleur: 'couleur', pages: 2 }
        ],
        finitions: ['plastification'],
        faconnage: []
      },
      {
        type: 'Intérieur',
        mode_impression: 'recto_verso',
        copies: 100,
        paper_types: [
          { grammage: '80', type: 'standard', format: 'A4', couleur: 'nb', pages: 20 }
        ],
        finitions: [],
        faconnage: ['reliure_spirale']
      }
    ];

    console.log('📑 Test: Brochure A4 couleur + noir/blanc');
    const estimation = await sectionsEstimationService.estimateWithSections(sections, tarifs);

    console.log(`\n💰 Prix estimé: ${estimation.prix_estime} FCFA`);
    console.log(`   Prix brut: ${estimation.prix_brut} FCFA\n`);

    estimation.sections_details.forEach((section, i) => {
      console.log(`Section ${i + 1} (${section.type}):`);
      console.log(`  Prix: ${section.prix_section} FCFA`);
      console.log(`  - Base: ${section.details.base} FCFA`);
      console.log(`  - Finitions: ${section.details.finitions} FCFA`);
      console.log(`  - Façonnage: ${section.details.faconnage} FCFA`);
      if (section.details.breakdown.paper_types_details.length > 0) {
        section.details.breakdown.paper_types_details.forEach(pt => {
          console.log(`    → ${pt.format} ${pt.couleur}: ${pt.total_pages} pages × ${pt.prix_unitaire} = ${pt.prix_total} FCFA`);
        });
      }
    });

    console.log('\n✅ Test réussi!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

test();
