module.exports = {
  apps: [
    {
      name: 'imprimerie-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/Users/mac/Documents/PLATEFOME/BACKUP/IMP PLATEFORM V3/frontend',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        BROWSER: 'none',
        SKIP_PREFLIGHT_CHECK: 'true'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};