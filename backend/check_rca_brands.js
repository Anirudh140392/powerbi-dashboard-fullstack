
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

async function checkRcaBrands() {
    const connection = await mysql.createConnection(config);

    try {
        console.log("--- Checking rca_sku_dim Brands ---");
        const [rows] = await connection.execute('SELECT DISTINCT brand_name FROM rca_sku_dim ORDER BY brand_name ASC');
        console.log('Brands found:', rows.map(r => r.brand_name));
    } catch (err) {
        console.log('Error querying rca_sku_dim:', err.message);
    }

    await connection.end();
}

checkRcaBrands();
