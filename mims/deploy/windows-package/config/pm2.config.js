module.exports = {
  apps: [
    {
      name: 'mims-license-validator',
      script: 'validate-license.js',
      cwd: 'C:\\mims\\config',
      env: { LICENSE_PATH: 'C:/mims/license.key' },
      restart_delay: 5000,
      max_restarts: 3
    },
    {
      name: 'mims-backend',
      script: 'main.js',
      cwd: 'C:\\mims\\backend',
      env: { 
        NODE_ENV: 'production', 
        PORT: 3001,
        LICENSE_PATH: 'C:/mims/license.key'
      },
      depends_on: 'mims-license-validator'
    },
    {
      name: 'mims-frontend', 
      script: 'server.js',
      cwd: 'C:\\mims\\frontend\\standalone',
      env: { 
        NODE_ENV: 'production', 
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        LICENSE_PATH: 'C:/mims/license.key'
      },
      depends_on: 'mims-backend'
    }
  ]
};
