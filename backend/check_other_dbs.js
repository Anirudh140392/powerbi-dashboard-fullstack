
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
};

async function listTables(dbName) {
    try {
        const connection = await mysql.createConnection({ ...config, database: dbName });
        const [rows] = await connection.execute('SHOW TABLES');
        console.log(`Tables in ${dbName}:`);
        rows.forEach(row => console.log(`- ${Object.values(row)[0]}`));
        await connection.end();
    } catch (err) {
        console.error(`Error listing tables in ${dbName}:`, err.message);
    }
}

async function checkDatabases() {
    await listTables('gcpl');
    await listTables('Bunge');
}

checkDatabases();
