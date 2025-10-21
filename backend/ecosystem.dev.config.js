module.exports = {
  apps: [
    {
      name: 'imprimerie-backend-dev',
      script: 'server.js',
      cwd: '/Users/mac/plateforme-imprimerie-v3/backups/code_backup_20251003_131151/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
        FRONTEND_URL: 'http://localhost:3001',
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
