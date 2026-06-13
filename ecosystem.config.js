module.exports = {
  apps: [
    {
      name: 'sona-server',
      script: 'npx',
      args: 'next start -p 3000',
      cwd: '/home/z/my-project',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Prevent crash loops - max 10 restarts per hour
      max_restarts: 10,
      restart_time: 3600000, // 1 hour window
      // Wait before restarting to avoid EADDRINUSE
      restart_delay: 5000,
      // Kill timeout - give process time to shut down
      kill_timeout: 10000,
      // Cluster mode - use all CPU cores
      instances: 'max',
      exec_mode: 'cluster',
      // Listen timeout
      listen_timeout: 60000,
      // Auto restart on crash
      autorestart: true,
      // Max memory before restart
      max_memory_restart: '1G',
      // Node.js memory limit
      node_args: ['--max-old-space-size=1024'],
      // Merge logs
      merge_logs: true,
      // Log paths
      error_file: '/home/z/my-project/logs/server-error.log',
      out_file: '/home/z/my-project/logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Time to wait before considering app as started
      wait_ready: false,
      // Minimum uptime to consider app as "started" (10 seconds)
      min_uptime: '10s'
    },
    {
      name: 'sona-tunnel',
      script: 'cloudflared',
      args: 'tunnel --url http://localhost:3000',
      cwd: '/home/z/my-project',
      // Prevent crash loops
      max_restarts: 10,
      restart_time: 3600000,
      restart_delay: 5000,
      kill_timeout: 10000,
      autorestart: true,
      max_memory_restart: '256M',
      merge_logs: true,
      error_file: '/home/z/my-project/logs/tunnel-error.log',
      out_file: '/home/z/my-project/logs/tunnel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      min_uptime: '10s'
    }
  ]
};
