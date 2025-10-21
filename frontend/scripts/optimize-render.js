#!/usr/bin/env node
/**
 * Script de build optimisé pour Render
 * Optimise la construction pour la production cloud
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Build optimisé pour Render...');

// Configuration optimisée pour la production
const productionEnv = {
  'GENERATE_SOURCEMAP': 'false',
  'CI': 'false',
  'BUILD_PATH': './build',
  'INLINE_RUNTIME_CHUNK': 'false',
  'IMAGE_INLINE_SIZE_LIMIT': '8192'
};

// Écrire les variables d'environnement dans .env.production
const envContent = Object.entries(productionEnv)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync('.env.production', envContent);
console.log('✅ Configuration production créée');

// Optimiser package.json pour le build
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Optimiser les scripts de build
packageJson.scripts.build = 'react-scripts build';
packageJson.scripts['build:analyze'] = 'npm run build && npx serve -s build';

// Optimiser les overrides pour éviter les warnings
packageJson.overrides = {
  ...packageJson.overrides,
  "html-webpack-plugin": "5.5.0",
  "@svgr/webpack": "8.1.0"
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Package.json optimisé');

// Créer un fichier de configuration pour Nginx (si utilisé)
const nginxConfig = `
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    # Configuration pour React Router
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache pour les assets statiques
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
`;

fs.writeFileSync('nginx.conf', nginxConfig);
console.log('✅ Configuration Nginx créée');

console.log('✅ Optimisation Render terminée');