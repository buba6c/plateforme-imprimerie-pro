// PM2 : processus de l'API Evocom Print v2.
// Démarrage : pm2 start v2/deploy/ecosystem.config.cjs ; pm2 save
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// Node dédié à v2 si présent (/opt/node22) : l'ancienne application garde le Node du système.
const nodeV2 = process.env.EVOCOM_NODE || '/opt/node22/bin/node';

module.exports = {
  apps: [
    {
      name: 'evocom-v2',
      cwd: path.join(root, 'api'),
      script: 'dist/server.js',
      ...(fs.existsSync(nodeV2) ? { interpreter: nodeV2 } : {}),
      node_args: '--enable-source-maps --env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      kill_timeout: 10000,
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
