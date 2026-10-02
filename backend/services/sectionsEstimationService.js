/**
 * Service d'Estimation avec Support des Sections Multiples
 * Version corrigée avec mapping des tarifs DB
 */

const dbHelper = require('../utils/dbHelper');

function mapPaperTypeToTarifKey(paperType) {
  const { format = 'A4', couleur = 'couleur' } = paperType;
  const formatLower = format.toLowerCase();
  const couleurKey = couleur === 'couleur' ? 'couleur' : 'nb';
  
  if (formatLower.includes('a4')) {
    return `papier_a4_${couleurKey}`;
  } else if (formatLower.includes('a3')) {
    return `papier_a3_${couleurKey}`;
  }
  return null;
}

async function estimateWithSections(sections, tarifs) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { prix_estime: 0, prix_brut: 0, sections_details: [], message: 'Aucune section' };
  }

  const sectionsDetails = [];
  let prixTotal = 0;

  for (let i = 0; i < sections.length; i++) {
    const sectionEstimation = await estimateSingleSection(sections[i], tarifs, i + 1);
    sectionsDetails.push(sectionEstimation);
    prixTotal += sectionEstimation.prix_section;
  }

  const prixEstime = Math.ceil(prixTotal / 100) * 100;

  return {
    prix_estime: prixEstime,
    prix_brut: Math.round(prixTotal),
    sections_count: sections.length,
    sections_details: sectionsDetails,
    message: `Estimation pour ${sections.length} section(s)`
  };
}

async function estimateSingleSection(section, tarifs, sectionNumber) {
  const { type, mode_impression, copies, paper_types, finitions = [], faconnage = [] } = section;

  let prixBase = 0;
  let prixFinitions = 0;
  let prixFaconnage = 0;
  const details = { paper_types_details: [], finitions_details: [], faconnage_details: [] };

  // Calcul papier
  if (Array.isArray(paper_types)) {
    for (const pt of paper_types) {
      const { grammage, type: paperType, pages = 1, format = 'A4', couleur = 'couleur' } = pt;
      const tarifKey = mapPaperTypeToTarifKey(pt);
      const tarifPapier = tarifs.find(t => t.cle === tarifKey);

      if (tarifPapier) {
        const totalPages = pages * copies;
        let prixPapier = totalPages * tarifPapier.valeur;

        if (mode_impression === 'recto_verso') {
          const tarifRectoVerso = tarifs.find(t => t.cle === 'impression_recto_verso');
          if (tarifRectoVerso) {
            prixPapier += (totalPages / 2) * tarifRectoVerso.valeur;
          }
        }

        if (grammage && parseInt(grammage) >= 200) {
          const tarifPremium = tarifs.find(t => t.cle === 'papier_premium');
          if (tarifPremium) {
            prixPapier += totalPages * tarifPremium.valeur;
          }
        }

        prixBase += prixPapier;

        details.paper_types_details.push({
          grammage, type: paperType || format, format, couleur, pages, copies,
          total_pages: totalPages, mode_impression, tarif_key: tarifKey,
          prix_unitaire: tarifPapier.valeur, prix_total: Math.round(prixPapier)
        });
      } else {
        console.warn(`⚠️  Tarif non trouvé: ${tarifKey}`);
        details.paper_types_details.push({ grammage, type: paperType, format, couleur, tarif_key: tarifKey, error: 'Tarif non trouvé', prix_total: 0 });
      }
    }
  }

  // Finitions
  if (Array.isArray(finitions) && finitions.length > 0) {
    for (const finition of finitions) {
      const finitionKey = finition.toLowerCase().replace(/\s+/g, '_');
      const tarifFinition = tarifs.find(t => t.cle === finitionKey || t.cle.includes(finitionKey) || finitionKey.includes(t.cle));

      if (tarifFinition) {
        let montant = 0;
        if (tarifFinition.unite === 'page') {
          const totalPages = paper_types.reduce((sum, pt) => sum + (pt.pages || 1) * copies, 0);
          montant = tarifFinition.valeur * totalPages;
        } else {
          montant = tarifFinition.valeur * copies;
        }
        prixFinitions += montant;
        details.finitions_details.push({ nom: finition, prix_unitaire: tarifFinition.valeur, unite: tarifFinition.unite, copies, prix_total: Math.round(montant) });
      }
    }
  }

  // Façonnage
  if (Array.isArray(faconnage) && faconnage.length > 0) {
    for (const operation of faconnage) {
      const operationKey = operation.toLowerCase().replace(/\s+/g, '_');
      const tarifFaconnage = tarifs.find(t => t.cle === operationKey || t.cle.includes(operationKey) || operationKey.includes(t.cle));

      if (tarifFaconnage) {
        const montant = tarifFaconnage.valeur * copies;
        prixFaconnage += montant;
        details.faconnage_details.push({ nom: operation, prix_unitaire: tarifFaconnage.valeur, copies, prix_total: Math.round(montant) });
      }
    }
  }

  const prixSection = prixBase + prixFinitions + prixFaconnage;

  return {
    section_number: sectionNumber, type, mode_impression, copies,
    prix_section: Math.round(prixSection),
    details: { base: Math.round(prixBase), finitions: Math.round(prixFinitions), faconnage: Math.round(prixFaconnage), breakdown: details }
  };
}

async function estimateWithSupports(supports, tarifs) {
  if (!Array.isArray(supports) || supports.length === 0) {
    return { prix_estime: 0, prix_brut: 0, supports_details: [], message: 'Aucun support' };
  }

  const supportsDetails = [];
  let prixTotal = 0;

  for (let i = 0; i < supports.length; i++) {
    const supportEstimation = await estimateSingleSupport(supports[i], tarifs, i + 1);
    supportsDetails.push(supportEstimation);
    prixTotal += supportEstimation.prix_support;
  }

  const prixEstime = Math.ceil(prixTotal / 100) * 100;

  return {
    prix_estime: prixEstime,
    prix_brut: Math.round(prixTotal),
    supports_count: supports.length,
    supports_details: supportsDetails,
    message: `Estimation pour ${supports.length} support(s)`
  };
}

async function estimateSingleSupport(support, tarifs, supportNumber) {
  const { type_support, largeur, hauteur, unite, exemplaires, finitions = [] } = support;

  let prixBase = 0;
  let prixFinitions = 0;
  const details = { dimensions: {}, finitions_details: [] };

  // Calcul surface
  let surface = 0;
  if (unite === 'cm') {
    surface = (largeur * hauteur) / 10000;
  } else if (unite === 'm') {
    surface = largeur * hauteur;
  } else {
    surface = (largeur * hauteur) / 1000000;
  }

  details.dimensions = { largeur, hauteur, unite, surface_m2: surface.toFixed(4), exemplaires };

  const supportKey = type_support.toLowerCase().replace(/\s+/g, '_') + '_m2';
  const tarifSupport = tarifs.find(t => t.cle === supportKey || t.cle.includes(type_support.toLowerCase().replace(/\s+/g, '_')));

  if (tarifSupport) {
    prixBase = surface * tarifSupport.valeur * exemplaires;
    details.support = { type: type_support, tarif_key: supportKey, prix_par_m2: tarifSupport.valeur, prix_total: Math.round(prixBase) };
  } else {
    console.warn(`⚠️  Tarif non trouvé: ${type_support} (${supportKey})`);
    details.support = { type: type_support, tarif_key: supportKey, error: 'Tarif non trouvé', prix_total: 0 };
  }

  // Finitions
  if (Array.isArray(finitions) && finitions.length > 0) {
    for (const finition of finitions) {
      const finitionKey = finition.toLowerCase().replace(/\s+/g, '_');
      const tarifFinition = tarifs.find(t => t.cle === finitionKey || t.cle.includes(finitionKey));

      if (tarifFinition) {
        let montant = 0;
        if (tarifFinition.unite === 'm²') {
          montant = tarifFinition.valeur * surface * exemplaires;
        } else {
          montant = tarifFinition.valeur * exemplaires;
        }
        prixFinitions += montant;
        details.finitions_details.push({ nom: finition, prix_unitaire: tarifFinition.valeur, unite: tarifFinition.unite, exemplaires, prix_total: Math.round(montant) });
      }
    }
  }

  const prixSupport = prixBase + prixFinitions;

  return {
    support_number: supportNumber, type_support, exemplaires,
    surface_m2: parseFloat(surface.toFixed(4)),
    prix_support: Math.round(prixSupport),
    details: { base: Math.round(prixBase), finitions: Math.round(prixFinitions), breakdown: details }
  };
}

async function getTarifsByMachine(machineType) {
  const [rows] = await dbHelper.query(
    'SELECT * FROM tarifs_config WHERE (type_machine = $1 OR type_machine = $2) AND actif = TRUE',
    [machineType, 'global']
  );
  return rows;
}

module.exports = {
  estimateWithSections,
  estimateWithSupports,
  estimateSingleSection,
  estimateSingleSupport,
  getTarifsByMachine,
  mapPaperTypeToTarifKey
};
