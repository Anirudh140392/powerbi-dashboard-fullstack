
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

async function testSelect() {
    const connection = await mysql.createConnection(config);
    try {
        console.log("Querying location_name...");
        const [rows] = await connection.execute('SELECT location_name FROM rb_location LIMIT 1');
        console.log('Result:', rows);
    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

testSelect();
