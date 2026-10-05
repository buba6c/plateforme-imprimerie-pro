// Vérifie que chaque couple texte/fond de la charte (tokens.json) atteint le contraste WCAG requis.
// Usage : npm -w web run contrastes
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fichier = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'tokens.json');
const tokens = JSON.parse(fs.readFileSync(fichier, 'utf8')).color.tokens;

const lum = (h) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [texte, fond, minimum] : 4,5 pour du texte, 3 pour un élément d'interface.
const COUPLES = [
  ['text', 'surface', 4.5], ['text', 'canvas', 4.5], ['text', 'surface-sunken', 4.5], ['text', 'accent-soft', 4.5],
  ['text-muted', 'surface', 4.5], ['text-muted', 'canvas', 4.5], ['text-muted', 'surface-sunken', 4.5],
  ['ink', 'surface', 4.5], ['ink', 'canvas', 4.5], ['ink', 'st-closed-bg', 4.5],
  ['on-accent', 'accent', 4.5], ['on-accent', 'accent-end', 4.5],
  ['accent-ink', 'surface', 4.5], ['accent-ink', 'canvas', 4.5], ['accent-ink', 'accent-soft', 4.5],
  ['on-brand', 'brand-start', 4.5], ['on-brand', 'brand-end', 4.5],
  ['nav-text', 'nav-start', 4.5], ['nav-text', 'nav-end', 4.5], ['nav-muted', 'nav-start', 4.5], ['nav-muted', 'nav-end', 4.5],
  ['nav-active-text', 'nav-active-bg', 4.5], ['nav-active-text', 'nav-active-bg-end', 4.5],
  ['on-coral', 'coral', 4.5],
  ['on-danger', 'danger', 4.5], ['danger-ink', 'danger-soft', 4.5], ['danger-ink', 'surface', 4.5],
  ['warning-ink', 'warning-soft', 4.5], ['warning-ink', 'surface', 4.5],
  ['success-ink', 'success-soft', 4.5], ['success-ink', 'surface', 4.5],
  ['info-ink', 'info-soft', 4.5],
  ['st-prep-ink', 'st-prep-bg', 4.5], ['st-ship-ink', 'st-ship-bg', 4.5], ['on-st-ship-solid', 'st-ship-solid', 4.5],
  ['line-strong', 'surface', 3], ['line-strong', 'canvas', 3], ['accent', 'surface', 3], ['accent', 'canvas', 3],
];

const val = (nom, mode) => {
  const t = tokens.find((k) => k.name === nom);
  if (!t) throw new Error(`Jeton inconnu : ${nom}`);
  const v = typeof t.value === 'object' ? t.value[mode] : t.value;
  return /^\{.+\}$/.test(v) ? val(v.slice(1, -1), mode) : v;
};

let echecs = 0;
for (const mode of ['light', 'dark']) {
  for (const [a, b, min] of COUPLES) {
    const r = ratio(val(a, mode), val(b, mode));
    if (r < min) {
      echecs++;
      console.log(`ÉCHEC ${mode} : ${a} sur ${b} = ${r.toFixed(2)} (minimum ${min})`);
    }
  }
}
console.log(echecs ? `${echecs} couple(s) insuffisant(s).` : `${COUPLES.length * 2} couples vérifiés : tous lisibles.`);
process.exit(echecs ? 1 : 0);
