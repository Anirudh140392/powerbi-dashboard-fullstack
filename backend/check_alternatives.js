
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

async function checkAlternatives() {
    const connection = await mysql.createConnection(config);

    try {
        console.log("--- Checking rb_brands ---");
        const [rows1] = await connection.execute('SELECT * FROM rb_brands LIMIT 5');
        console.log('Sample rows:', rows1);
        const [count1] = await connection.execute('SELECT COUNT(*) as count FROM rb_brands');
        console.log('Total count:', count1[0].count);
    } catch (err) {
        console.log('Error querying rb_brands:', err.message);
    }

    try {
        console.log("\n--- Checking rb_sku_platform ---");
        const [rows2] = await connection.execute('SELECT * FROM rb_sku_platform LIMIT 5');
        console.log('Sample rows:', rows2);
    } catch (err) {
        console.log('Error querying rb_sku_platform:', err.message);
    }

    await connection.end();
}

checkAlternatives();
