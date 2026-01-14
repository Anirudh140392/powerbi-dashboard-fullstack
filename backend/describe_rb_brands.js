
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

async function describeRbBrands() {
    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute('DESCRIBE rb_brands');
        console.log('Columns in rb_brands:');
        rows.forEach(row => console.log(`${row.Field} (${row.Type})`));

        const [data] = await connection.execute('SELECT brand_name FROM rb_brands LIMIT 10');
        console.log('Sample brands:', data.map(d => d.brand_name));
    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

describeRbBrands();
