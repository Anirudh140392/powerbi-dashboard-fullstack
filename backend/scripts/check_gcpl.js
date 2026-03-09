
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'gcpl', // Explicitly checking gcpl
    port: process.env.DB_PORT
};

async function checkGcpl() {
    try {
        const connection = await mysql.createConnection(config);

        console.log("--- Checking rca_sku_dim in gcpl ---");
        const [rows] = await connection.execute("SHOW TABLES LIKE 'rca_sku_dim'");
        if (rows.length > 0) {
            console.log("rca_sku_dim EXISTS in gcpl");
            // Describe it to be sure
            const [desc] = await connection.execute("DESCRIBE rca_sku_dim");
            console.log("Columns:", desc.map(d => d.Field));
        } else {
            console.log("rca_sku_dim DOES NOT EXIST in gcpl");
        }

        console.log("\n--- Checking other key tables in gcpl ---");
        const tablesToCheck = ['zepto_brand_crawl', 'tb_zepto_brand_sales_analytics', 'rb_kw'];
        for (const table of tablesToCheck) {
            const [t] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
            console.log(`${table}: ${t.length > 0 ? 'EXISTS' : 'MISSING'}`);
        }

        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkGcpl();
