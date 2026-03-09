
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

async function checkKeys() {
    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute('SELECT * FROM rb_location LIMIT 1');
        if (rows.length > 0) {
            console.log('KEYS_START');
            console.log(Object.keys(rows[0]).join(', '));
            console.log('KEYS_END');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

checkKeys();
