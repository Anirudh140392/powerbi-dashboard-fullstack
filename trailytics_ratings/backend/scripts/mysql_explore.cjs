const mysql = require('mysql2/promise');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

async function main() {
    const conn = await mysql.createConnection({
        host: requireEnv('PRESTIGE_MYSQL_HOST'),
        port: 3306,
        user: requireEnv('PRESTIGE_MYSQL_USER'),
        password: requireEnv('PRESTIGE_MYSQL_PASSWORD'),
        database: requireEnv('PRESTIGE_MYSQL_DATABASE'),
    });

    const [tables] = await conn.query('SHOW TABLES');
    console.table(tables);
    await conn.end();
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
