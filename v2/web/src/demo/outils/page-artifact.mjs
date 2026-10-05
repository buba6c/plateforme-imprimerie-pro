// Après `npm -w web run build:demo` : écrit dist-demo/artifact.html, la page à publier comme Artifact claude.ai.
// L'hébergeur ajoute lui-même doctype, <head> et <body> : la page n'en contient pas, et pose la classe ev-root
// et la langue sur les éléments qu'il crée.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'dist-demo');
const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const script = index.match(/<script defer src="([^"]+)"><\/script>/)?.[1];
const css = index.match(/<link rel="stylesheet" href="([^"]+)">/)?.[1];
if (!script || !css) throw new Error('index.html inattendu : relancez npm -w web run build:demo');

const page = `<title>Démo Evocom Print</title>
<link rel="stylesheet" href="${css}">
<style>
  /* Fond et texte de la charte dès le premier affichage, dans les deux thèmes (variables de tokens.css). */
  html, body { background: var(--canvas); color: var(--text); }
  body { font-family: var(--font-sans); }
</style>
<script>
  document.documentElement.lang = 'fr';
  document.body.classList.add('ev-root');
</script>
<script defer src="${script}"></script>
<div id="root"></div>
`;
fs.writeFileSync(path.join(dist, 'artifact.html'), page);
console.log(`dist-demo/artifact.html écrit (${script}, ${css})`);
