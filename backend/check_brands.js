
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

async function checkBrands() {
    const connection = await mysql.createConnection(config);

    try {
        console.log("--- Checking zepto_brand_crawl ---");
        const [rows1] = await connection.execute('SELECT DISTINCT brand_name FROM zepto_brand_crawl');
        console.log('Brands in zepto_brand_crawl:', rows1.map(r => r.brand_name));
    } catch (err) {
        console.log('Error querying zepto_brand_crawl:', err.message);
    }

    try {
        console.log("\n--- Checking rca_sku_dim ---");
        const [rows2] = await connection.execute('SELECT DISTINCT brand_name FROM rca_sku_dim');
        console.log('Brands in rca_sku_dim:', rows2.map(r => r.brand_name));
    } catch (err) {
        console.log('Error querying rca_sku_dim:', err.message);
    }

    try {
        console.log("\n--- Checking tb_zepto_brand_sales_analytics ---");
        const [rows3] = await connection.execute('SELECT DISTINCT brand_name FROM tb_zepto_brand_sales_analytics');
        console.log('Brands in tb_zepto_brand_sales_analytics:', rows3.map(r => r.brand_name));
    } catch (err) {
        console.log('Error querying tb_zepto_brand_sales_analytics:', err.message);
    }

    await connection.end();
}

checkBrands();
