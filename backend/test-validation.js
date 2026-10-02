/**
 * Script de test pour validateSections.js
 */

const {
  validateXeroxSection,
  validateRolandSupport,
  validateSections,
  validateSupports,
  validateAmount,
} = require('./middleware/validateSections');

console.log('=== Tests de validation ===\n');

// Test 1: Section Xerox invalide (manque copies)
console.log('Test 1: Section Xerox invalide (manque copies)');
const invalidXerox = {
  type: 'Affiche',
  mode_impression: 'recto_simple',
  paper_types: [{ grammage: '80', type: 'standard' }],
};
const result1 = validateXeroxSection(invalidXerox);
console.log('Résultat:', JSON.stringify(result1, null, 2));
console.log();

// Test 2: Section Xerox valide
console.log('Test 2: Section Xerox valide');
const validXerox = {
  type: 'Affiche',
  mode_impression: 'recto_simple',
  copies: 100,
  paper_types: [{ grammage: '80', type: 'standard' }],
  finitions: ['pelliculage'],
  faconnage: [],
};
const result2 = validateXeroxSection(validXerox);
console.log('Résultat:', JSON.stringify(result2, null, 2));
console.log();

// Test 3: Brochure sans 2 types papier
console.log('Test 3: Brochure invalide (1 seul papier au lieu de 2)');
const invalidBrochure = {
  type: 'Brochure',
  mode_impression: 'recto_verso',
  copies: 50,
  paper_types: [{ grammage: '80', type: 'standard' }],
};
const result3 = validateXeroxSection(invalidBrochure);
console.log('Résultat:', JSON.stringify(result3, null, 2));
console.log();

// Test 4: Brochure valide
console.log('Test 4: Brochure valide (couverture + intérieur)');
const validBrochure = {
  type: 'Brochure',
  mode_impression: 'recto_verso',
  copies: 50,
  paper_types: [
    { grammage: '250', type: 'couché' },
    { grammage: '80', type: 'standard' },
  ],
  faconnage: ['pliage', 'agrafage'],
};
const result4 = validateXeroxSection(validBrochure);
console.log('Résultat:', JSON.stringify(result4, null, 2));
console.log();

// Test 5: Support Roland invalide (largeur négative)
console.log('Test 5: Support Roland invalide (largeur négative)');
const invalidRoland = {
  type_support: 'Bâche',
  largeur: -2,
  hauteur: 1.5,
  unite: 'm',
  exemplaires: 1,
};
const result5 = validateRolandSupport(invalidRoland);
console.log('Résultat:', JSON.stringify(result5, null, 2));
console.log();

// Test 6: Support Roland valide
console.log('Test 6: Support Roland valide');
const validRoland = {
  type_support: 'Vinyle',
  largeur: 3,
  hauteur: 2,
  unite: 'm',
  exemplaires: 2,
  finitions: ['oeillets'],
};
const result6 = validateRolandSupport(validRoland);
console.log('Résultat:', JSON.stringify(result6, null, 2));
console.log();

// Test 7: Amount invalide (négatif)
console.log('Test 7: Amount invalide (négatif)');
const result7 = validateAmount(-100);
console.log('Résultat:', JSON.stringify(result7, null, 2));
console.log();

// Test 8: Amount valide
console.log('Test 8: Amount valide');
const result8 = validateAmount(15000.50);
console.log('Résultat:', JSON.stringify(result8, null, 2));
console.log();

// Test 9: Amount facultatif (null)
console.log('Test 9: Amount facultatif (null)');
const result9 = validateAmount(null);
console.log('Résultat:', JSON.stringify(result9, null, 2));
console.log();

// Test 10: Tableau de sections mixtes
console.log('Test 10: Tableau avec 1 section valide et 1 invalide');
const sections = [validXerox, invalidXerox];
const result10 = validateSections(sections);
console.log('Résultat:', JSON.stringify(result10, null, 2));
console.log();

console.log('=== Tous les tests terminés ===');
