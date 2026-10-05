// Produit src/styles/tokens.css à partir de src/styles/tokens.json (jetons de la charte Evocom Print).
// Usage : npm -w web run tokens
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const styles = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles');
const t = JSON.parse(fs.readFileSync(path.join(styles, 'tokens.json'), 'utf8'));

const val = (v) => (typeof v === 'string' && /^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
const mode = (tokens, m) => tokens.map((k) => `--${k.name}: ${val(typeof k.value === 'object' ? k.value[m] : k.value)};`);
const themed = (m) => [...mode(t.color.tokens, m), ...mode(t.shadow.tokens, m)];

const light = [
  ...themed('light'),
  ...mode(t.spacing.tokens, 'light'),
  ...mode(t.radius.tokens, 'light'),
  ...mode(t.size.tokens, 'light'),
  `--font-sans: ${t.type.families.sans};`,
  `--font-mono: ${t.type.families.mono};`,
  'color-scheme: light;',
];
const dark = [...themed('dark'), 'color-scheme: dark;'];
const bloc = (sel, lignes, pad = '') => `${pad}${sel} {\n${lignes.map((l) => `${pad}  ${l}`).join('\n')}\n${pad}}`;

const out = [
  '/* Généré à partir de la charte Evocom Print (tokens.json). Ne pas modifier à la main : npm -w web run tokens. */',
  bloc(':root', light),
  `@media (prefers-color-scheme: dark) {\n${bloc(':root:not([data-theme="light"])', dark, '  ')}\n}`,
  bloc(':root[data-theme="dark"]', dark),
  ...t.type.fonts.map(
    (f) => `@font-face { font-family: "${f.family}"; src: url("/${f.file}") format("woff2"); font-weight: ${f.weight}; font-style: ${f.style}; font-display: swap; }`,
  ),
  '',
].join('\n');

fs.writeFileSync(path.join(styles, 'tokens.css'), out);
console.log(`tokens.css : ${t.color.tokens.length} couleurs`);
