
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

async function describeRbLocation() {
    const connection = await mysql.createConnection(config);
    try {
        const [rows] = await connection.execute('DESCRIBE rb_location');
        console.log('Columns in rb_location:');
        rows.forEach(row => console.log(`${row.Field} (${row.Type})`));

        const [data] = await connection.execute('SELECT location_name FROM rb_location LIMIT 10');
        console.log('Sample locations:', data.map(d => d.location_name));
    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

describeRbLocation();
