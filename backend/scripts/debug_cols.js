
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

async function debugCols() {
    console.log('DB:', config.database);
    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute('SELECT * FROM rb_location LIMIT 1');
        const keys = Object.keys(rows[0]);
        console.log('Keys:', keys.map(k => `'${k}'`));

        // Try to find the one that looks like location_name
        const locKey = keys.find(k => k.trim() === 'location_name');
        console.log('Found key:', `'${locKey}'`);

        if (locKey) {
            console.log(`Querying '${locKey}'...`);
            // Use backticks to handle special chars
            const [res] = await connection.execute(`SELECT \`${locKey}\` FROM rb_location LIMIT 1`);
            console.log('Result:', res);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

debugCols();
