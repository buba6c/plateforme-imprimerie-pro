// Compile l'API en un seul fichier dist/server.js (le module partagé est inclus),
// et copie les migrations SQL à côté.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((d) => d !== '@evocom/shared');

fs.rmSync('dist', { recursive: true, force: true });
const common = { bundle: true, platform: 'node', target: 'node22', format: 'esm', sourcemap: true, external, logLevel: 'info',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } };
await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/server.js' });
await build({ ...common, entryPoints: ['src/db/migrate-cli.ts'], outfile: 'dist/migrate.js' });
await build({ ...common, entryPoints: ['src/db/seed-cli.ts'], outfile: 'dist/seed.js' });
if (fs.existsSync('src/import/cli.ts')) await build({ ...common, entryPoints: ['src/import/cli.ts'], outfile: 'dist/import-legacy.js' });
fs.cpSync('src/db/migrations', 'dist/migrations', { recursive: true });
console.log('API compilée dans dist/');
