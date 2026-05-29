
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

async function describeTable() {
    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.execute('DESCRIBE zepto_brand_crawl');
        console.log('Columns in zepto_brand_crawl:');
        rows.forEach(row => console.log(`${row.Field} (${row.Type})`));
        await connection.end();
    } catch (err) {
        console.error('Error describing table:', err);
    }
}

describeTable();
