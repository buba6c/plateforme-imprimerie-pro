#!/usr/bin/env node
/**
 * Script de vérification des URLs dossiers utilisant potentiellement un id numérique
 * Objectif: détecter toute URL de type /dossiers/123 au lieu d'un UUID.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'frontend', 'src');

const FILE_EXT = ['.js', '.jsx', '.ts', '.tsx'];

const numericPattern = /\/dossiers\/(\${[^}]+}|[0-9]{1,8})(?=\b|\/)/g; // capture simple nombre
const safeUUIDHint = /folder_id|getDossierId/;

let issues = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = numericPattern.exec(content)) !== null) {
    const snippet = content.substring(Math.max(0, match.index - 40), match.index + 40).replace(/\s+/g, ' ');
    // Filtrer si la variable semble déjà traitée
    if (safeUUIDHint.test(snippet)) continue;

    issues.push({ file: filePath, match: match[0], snippet });
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (FILE_EXT.includes(path.extname(entry.name))) scanFile(fullPath);
  }
}

console.log('🔍 Scan des usages potentiellement dangereux d\'identifiants dossiers...');
walk(ROOT);

if (issues.length === 0) {
  console.log('✅ Aucun usage suspect détecté (URLs numériques /dossiers/<nombre>)');
  process.exit(0);
} else {
  console.log(`⚠️  ${issues.length} occurrence(s) potentiellement problématique(s):`);
  issues.forEach((iss, i) => {
    console.log(`\n${i + 1}. Fichier: ${path.relative(process.cwd(), iss.file)}`);
    console.log(`   Expression: ${iss.match}`);
    console.log(`   Contexte: ...${iss.snippet}...`);
  });
  console.log('\n💡 Solution recommandée: utiliser getDossierId(dossier) ou dossier.folder_id');
  process.exit(1);
}
