
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

async function checkExactKeys() {
    const connection = await mysql.createConnection(config);

    try {
        console.log("--- rb_location ---");
        const [rows1] = await connection.execute('SELECT * FROM rb_location LIMIT 1');
        if (rows1.length > 0) console.log(Object.keys(rows1[0]));

        console.log("\n--- rb_platform ---");
        const [rows2] = await connection.execute('SELECT * FROM rb_platform LIMIT 1');
        if (rows2.length > 0) console.log(Object.keys(rows2[0]));

        console.log("\n--- rb_brands ---");
        const [rows3] = await connection.execute('SELECT * FROM rb_brands LIMIT 1');
        if (rows3.length > 0) console.log(Object.keys(rows3[0]));

    } catch (err) {
        console.error('Error:', err.message);
    }
    await connection.end();
}

checkExactKeys();
