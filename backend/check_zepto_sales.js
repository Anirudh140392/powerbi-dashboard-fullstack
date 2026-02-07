
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

async function checkTable() {
    const connection = await mysql.createConnection(config);

    try {
        console.log("Checking tb_zepto_brand_sales_analytics...");
        const [rows] = await connection.execute("SELECT DISTINCT brand_name FROM tb_zepto_brand_sales_analytics");
        console.log("Brands found:", rows.map(r => r.brand_name));
    } catch (err) {
        console.log("Error:", err.message);
    }

    await connection.end();
}

checkTable();
