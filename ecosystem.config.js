// PM2 Ecosystem Configuration — TaskFlow API
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: 'taskflow-api',
      script: './dist/server.js',

      // ── Cluster Mode ───────────────────────────────────────────────────────
      instances: 'max',          // one per CPU core
      exec_mode: 'cluster',

      // ── Environment ────────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // ── Logging ────────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // ── Restart Policy ─────────────────────────────────────────────────────
      watch: false,                    // never watch in production
      max_memory_restart: '512M',      // restart if memory exceeds 512 MB
      restart_delay: 3000,             // wait 3 s between restarts
      max_restarts: 10,                // give up after 10 consecutive crashes
      min_uptime: '10s',               // must stay alive 10 s to be "healthy"

      // ── Zero-downtime Reload ───────────────────────────────────────────────
      kill_timeout: 10000,             // give 10 s for graceful shutdown
      listen_timeout: 5000,            // wait 5 s for app to send 'ready'
      wait_ready: true,                // app must call process.send('ready')

      // ── Source-map Support ─────────────────────────────────────────────────
      source_map_support: true,

      // ── Node.js Flags ──────────────────────────────────────────────────────
      node_args: '--max-old-space-size=512',
    },
  ],

  // ── Deployment Targets (used with: pm2 deploy ecosystem.config.js production) ──
  deploy: {
    staging: {
      user: 'deploy',
      host: ['your-staging-server.example.com'],
      ref: 'origin/develop',
      repo: 'https://gitlab.grootan.com/interns-2026/grootan-nodejs-testing-exercise-tejash.git',
      path: '/var/www/taskflow-staging',
      'pre-deploy-local': '',
      'post-deploy':
        'npm ci --omit=dev && npm run build && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': 'apt-get install -y git',
    },
    production: {
      user: 'deploy',
      host: ['your-production-server.example.com'],
      ref: 'origin/main',
      repo: 'https://gitlab.grootan.com/interns-2026/grootan-nodejs-testing-exercise-tejash.git',
      path: '/var/www/taskflow',
      'pre-deploy-local': '',
      'post-deploy':
        'npm ci --omit=dev && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'apt-get install -y git',
    },
  },
};
