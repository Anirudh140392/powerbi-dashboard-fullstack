
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

async function listTables() {
    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.execute('SHOW TABLES');
        console.log('Tables in ' + config.database + ':');
        rows.forEach(row => console.log(`- ${Object.values(row)[0]}`));
        await connection.end();
    } catch (err) {
        console.error('Error listing tables:', err);
    }
}

listTables();
