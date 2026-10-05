// Version de démonstration hors ligne : `npm -w web run build:demo` → dist-demo/
// (index.html, un script, une feuille de style, les polices). Aucun appel réseau : l'API est
// simulée dans le navigateur (src/demo), Socket.IO et l'envoi tus sont remplacés par des
// équivalents locaux. Les chemins sont relatifs pour une page servie à n'importe quelle adresse.

import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const ici = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Page autonome : polices en chemins relatifs (elles sont référencées en /fonts/…, dossier public)
 * et script classique (format iife, sans requête CORS : la page peut être servie dans un cadre isolé).
 */
function pageAutonome(): Plugin {
  return {
    name: 'evocom-demo-page-autonome',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const f of Object.values(bundle)) {
        if (f.type === 'asset' && f.fileName.endsWith('.css') && typeof f.source === 'string') {
          f.source = f.source.replace(/url\((["']?)\/fonts\//g, 'url($1../fonts/');
        }
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/href="\/fonts\//g, 'href="./fonts/')
          .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
          .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=')
          .replace(/<title>[^<]*<\/title>/, '<title>Evocom Print · Démonstration</title>'),
    },
  };
}

export default defineConfig({
  mode: 'demo',
  base: './',
  plugins: [react(), pageAutonome()],
  resolve: {
    alias: {
      'socket.io-client': ici('./src/demo/socket-simule.ts'),
      'tus-js-client': ici('./src/demo/tus-simule.ts'),
    },
  },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 3000,
    rolldownOptions: {
      // import.meta n'est utilisé que par l'aide au préchargement de vite, inutile ici (un seul fichier).
      onLog(niveau, log, suite) {
        if (log.code === 'EMPTY_IMPORT_META') return;
        suite(niveau, log);
      },
      output: {
        format: 'iife',
        codeSplitting: false,
        entryFileNames: 'assets/evocom-demo.js',
        assetFileNames: 'assets/evocom-demo[extname]',
      },
    },
  },
});
