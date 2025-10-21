#!/usr/bin/env node

/**
 * Script de correction automatique de DossierDetailsFixed.js
 * Problème: <div> invalide dans <tbody> ligne 682
 * Solution: Fermer le tableau avant la section Xerox
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/dossiers/DossierDetailsFixed.js');

console.log('📝 Lecture du fichier...');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`📊 Fichier: ${lines.length} lignes`);

// Trouver la ligne problématique
const problemLineIndex = lines.findIndex((line, idx) => 
  idx === 671 && line.trim() === ') : ('
);

if (problemLineIndex === -1) {
  console.log('❌ Structure attendue non trouvée');
  process.exit(1);
}

console.log(`✅ Problème trouvé ligne ${problemLineIndex + 1}`);

// Nouvelle structure corrigée
const fixedStructure = `                      </>
                    ) : (
                      <>
                        {/* CLIENT */}
                        {formData.client && (
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 w-1/3">Client</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formData.client}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <div className="space-y-4 p-4">`;

// Remplacement
lines[671] = `                      </>`;
lines[672] = `                    )}`;
lines[673] = `                  </tbody>`;
lines[674] = `                </table>`;
lines[675] = `              </div>`;
lines[676] = `            ) : (`;
lines[677] = `              <div className="space-y-4">`;

// Supprimer les lignes 672-680 originales (qui étaient invalides)
lines.splice(678, 3);

const newContent = lines.join('\n');

// Backup avant modification
const backupPath = filePath + '.before-fix-' + Date.now();
fs.writeFileSync(backupPath, content);
console.log(`💾 Backup créé: ${backupPath}`);

// Écriture
fs.writeFileSync(filePath, newContent);
console.log('✅ Fichier corrigé!');
console.log('');
console.log('🔧 Testez maintenant:');
console.log('cd frontend && npm run build');
