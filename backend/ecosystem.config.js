module.exports = {
  apps: [
    {
      name: 'imprimerie-backend',
      script: 'server.js',
      cwd: '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      time: true,
      exec_mode: 'fork',
      merge_logs: false,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
