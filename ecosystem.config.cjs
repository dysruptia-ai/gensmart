module.exports = {
  apps: [
    {
      name: 'next-app',
      cwd: '/home/ubuntu/gensmart/apps/web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      instances: 1,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'express-api',
      cwd: '/home/ubuntu/gensmart/apps/api',
      script: 'src/index.ts',
      interpreter: '/home/ubuntu/gensmart/node_modules/.bin/tsx',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      instances: 1,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
