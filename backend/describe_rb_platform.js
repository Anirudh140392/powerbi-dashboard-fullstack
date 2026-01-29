
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

async function describeRbPlatform() {
    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute('DESCRIBE rb_platform');
        console.log('Columns in rb_platform:');
        rows.forEach(row => console.log(`${row.Field} (${row.Type})`));
    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

describeRbPlatform();
