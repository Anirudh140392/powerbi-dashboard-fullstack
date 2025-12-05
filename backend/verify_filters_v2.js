
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

async function verifyFilters() {
    const connection = await mysql.createConnection(config);

    try {
        console.log("--- Checking Brands (rb_brands) ---");
        const [brands] = await connection.execute('SELECT DISTINCT brand_name FROM rb_brands ORDER BY brand_name ASC LIMIT 5');
        console.log('Brands:', brands.map(b => b.brand_name));

        console.log("\n--- Checking Locations (rb_location) ---");
        const [locations] = await connection.execute('SELECT DISTINCT location FROM rb_location ORDER BY location ASC LIMIT 5');
        console.log('Locations:', locations.map(l => l.location));

        console.log("\n--- Checking Platforms (rb_platform) ---");
        const [platforms] = await connection.execute('SELECT DISTINCT pf_name FROM rb_platform ORDER BY pf_name ASC LIMIT 5');
        console.log('Platforms:', platforms.map(p => p.pf_name));

    } catch (err) {
        console.log('Error:', err.message);
    }

    await connection.end();
}

verifyFilters();
