
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, // Should be gcpl now
    port: process.env.DB_PORT
};

async function verifyFilters() {
    console.log("DB:", config.database);
    const connection = await mysql.createConnection(config);

    try {
        console.log("--- Checking Brands (rca_sku_dim) ---");
        const [brands] = await connection.execute('SELECT DISTINCT brand_name FROM rca_sku_dim ORDER BY brand_name ASC LIMIT 5');
        console.log('Brands:', brands.map(b => b.brand_name));

        console.log("\n--- Checking Locations (rca_sku_dim) ---");
        const [locations] = await connection.execute('SELECT DISTINCT location FROM rca_sku_dim ORDER BY location ASC LIMIT 5');
        console.log('Locations:', locations.map(l => l.location));

        console.log("\n--- Checking Platforms (rca_sku_dim) ---");
        const [platforms] = await connection.execute('SELECT DISTINCT platform FROM rca_sku_dim ORDER BY platform ASC LIMIT 5');
        console.log('Platforms:', platforms.map(p => p.platform));

    } catch (err) {
        console.log('Error:', err.message);
    }

    await connection.end();
}

verifyFilters();
