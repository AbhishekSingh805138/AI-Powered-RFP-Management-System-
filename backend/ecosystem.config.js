module.exports = {
  apps: [
    {
      name: 'rfp-backend',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      kill_timeout: 10000,
      listen_timeout: 8000,
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
