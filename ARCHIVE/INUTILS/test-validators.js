/**
 * Script de test pour valider les fonctions de validation
 * Usage: node backend/tests/test-validators.js
 */

const { 
  isValidUUID, 
  isValidPositiveInteger, 
  isValidId,
  isValidEmail,
  isValidSenegalPhone,
  validatePagination
} = require('../utils/validators');

// Couleurs pour la console
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`${GREEN}✓${RESET} ${description}`);
  } catch (error) {
    failedTests++;
    console.log(`${RED}✗${RESET} ${description}`);
    console.log(`  ${RED}Erreur: ${error.message}${RESET}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

console.log('\n=== Tests de validation UUID ===\n');

test('UUID valide (v4)', () => {
  assert(isValidUUID('550e8400-e29b-41d4-a716-446655440000'), 'UUID v4 valide devrait passer');
});

test('UUID valide (v1)', () => {
  assert(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'), 'UUID v1 valide devrait passer');
});

test('UUID invalide - format incorrect', () => {
  assert(!isValidUUID('invalid-uuid'), 'UUID invalide devrait échouer');
});

test('UUID invalide - chaîne vide', () => {
  assert(!isValidUUID(''), 'Chaîne vide devrait échouer');
});

test('UUID invalide - null', () => {
  assert(!isValidUUID(null), 'null devrait échouer');
});

test('UUID invalide - nombre', () => {
  assert(!isValidUUID(123), 'Nombre devrait échouer');
});

test('UUID invalide - trop court', () => {
  assert(!isValidUUID('550e8400-e29b-41d4-a716'), 'UUID trop court devrait échouer');
});

console.log('\n=== Tests de validation ID (entier positif) ===\n');

test('Entier positif valide', () => {
  assert(isValidPositiveInteger(123), 'Entier positif devrait passer');
});

test('Entier positif valide (string)', () => {
  assert(isValidPositiveInteger('456'), 'String entier positif devrait passer');
});

test('Entier négatif', () => {
  assert(!isValidPositiveInteger(-1), 'Entier négatif devrait échouer');
});

test('Zéro', () => {
  assert(!isValidPositiveInteger(0), 'Zéro devrait échouer');
});

test('Décimal', () => {
  assert(!isValidPositiveInteger(3.14), 'Décimal devrait échouer');
});

test('String avec caractères', () => {
  assert(!isValidPositiveInteger('abc'), 'String non numérique devrait échouer');
});

console.log('\n=== Tests de validation ID (UUID ou entier) ===\n');

test('ID valide - UUID', () => {
  assert(isValidId('550e8400-e29b-41d4-a716-446655440000'), 'UUID devrait être un ID valide');
});

test('ID valide - entier', () => {
  assert(isValidId(123), 'Entier devrait être un ID valide');
});

test('ID valide - entier string', () => {
  assert(isValidId('456'), 'String entier devrait être un ID valide');
});

test('ID invalide - format incorrect', () => {
  assert(!isValidId('invalid-id'), 'Format invalide devrait échouer');
});

console.log('\n=== Tests de validation email ===\n');

test('Email valide', () => {
  assert(isValidEmail('test@example.com'), 'Email valide devrait passer');
});

test('Email valide avec sous-domaine', () => {
  assert(isValidEmail('user@mail.company.sn'), 'Email avec sous-domaine devrait passer');
});

test('Email invalide - sans @', () => {
  assert(!isValidEmail('testexample.com'), 'Email sans @ devrait échouer');
});

test('Email invalide - sans domaine', () => {
  assert(!isValidEmail('test@'), 'Email sans domaine devrait échouer');
});

test('Email invalide - null', () => {
  assert(!isValidEmail(null), 'null devrait échouer');
});

console.log('\n=== Tests de validation téléphone sénégalais ===\n');

test('Téléphone valide - 77', () => {
  assert(isValidSenegalPhone('771234567'), 'Numéro 77 devrait passer');
});

test('Téléphone valide - 78', () => {
  assert(isValidSenegalPhone('781234567'), 'Numéro 78 devrait passer');
});

test('Téléphone valide - avec +221', () => {
  assert(isValidSenegalPhone('+221771234567'), 'Numéro avec +221 devrait passer');
});

test('Téléphone valide - avec espaces', () => {
  assert(isValidSenegalPhone('77 123 45 67'), 'Numéro avec espaces devrait passer');
});

test('Téléphone invalide - trop court', () => {
  assert(!isValidSenegalPhone('77123'), 'Numéro trop court devrait échouer');
});

test('Téléphone invalide - commence par 6', () => {
  assert(!isValidSenegalPhone('661234567'), 'Numéro commençant par 6 devrait échouer');
});

console.log('\n=== Tests de validation pagination ===\n');

test('Pagination par défaut', () => {
  const result = validatePagination({});
  assertEqual(result.page, 1, 'Page par défaut devrait être 1');
  assertEqual(result.limit, 20, 'Limit par défaut devrait être 20');
  assertEqual(result.offset, 0, 'Offset par défaut devrait être 0');
});

test('Pagination avec valeurs valides', () => {
  const result = validatePagination({ page: '2', limit: '50' });
  assertEqual(result.page, 2, 'Page devrait être 2');
  assertEqual(result.limit, 50, 'Limit devrait être 50');
  assertEqual(result.offset, 50, 'Offset devrait être 50');
});

test('Pagination avec page négative', () => {
  const result = validatePagination({ page: '-1' });
  assertEqual(result.page, 1, 'Page négative devrait être corrigée à 1');
});

test('Pagination avec limit trop grand', () => {
  const result = validatePagination({ limit: '200' });
  assertEqual(result.limit, 100, 'Limit trop grand devrait être limité à 100');
});

test('Pagination avec valeurs invalides', () => {
  const result = validatePagination({ page: 'abc', limit: 'xyz' });
  assertEqual(result.page, 1, 'Page invalide devrait être corrigée à 1');
  assertEqual(result.limit, 20, 'Limit invalide devrait être corrigée à 20');
});

// Résumé
console.log('\n' + '='.repeat(50));
console.log(`${YELLOW}Résumé des tests${RESET}`);
console.log('='.repeat(50));
console.log(`Total:   ${totalTests}`);
console.log(`${GREEN}Réussis: ${passedTests}${RESET}`);
console.log(`${RED}Échoués: ${failedTests}${RESET}`);

if (failedTests === 0) {
  console.log(`\n${GREEN}✓ Tous les tests sont passés !${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${RED}✗ ${failedTests} test(s) ont échoué${RESET}\n`);
  process.exit(1);
}
