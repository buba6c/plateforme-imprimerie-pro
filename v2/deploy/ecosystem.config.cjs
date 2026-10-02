// PM2 : processus de l'API Evocom Print v2.
// Démarrage : pm2 start v2/deploy/ecosystem.config.cjs ; pm2 save
const path = require('node:path');
const root = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'evocom-v2',
      cwd: path.join(root, 'api'),
      script: 'dist/server.js',
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
