module.exports = {
  apps: [
    {
      name: 'he4rt-squad-server',
      script: './src/index.js', // cjs
      watch: false,
      error_file: './error.log',
      out_file: './output.log',
      autorestart: true,
      cron_restart: '0 3 * * 0', // every dawn sunday
      restart_delay: 10000,
      kill_timeout: 2000,
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
}