// set_env.js
process.env.DB_HOST = process.env.DB_HOST || '15.207.197.27';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'readonly_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'Readonly@123';
process.env.DB_NAME = process.env.DB_NAME || 'gcpl';
console.log('✅ Environment variables set for test run');
