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

    const [rows] = await conn.query(`
        SELECT web_review_ID, platform_name, web_pid, created_time, review_time, reviewed_by, LEFT(content_2, 200) AS review_text
        FROM rb_crawl_review_info
        ORDER BY created_time DESC
        LIMIT 20
    `);
    console.table(rows);
    await conn.end();
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
