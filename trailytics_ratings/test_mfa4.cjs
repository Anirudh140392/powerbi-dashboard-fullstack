const { Pool } = require('pg');
require('dotenv').config({path: './.env'});
const challengeLib = require('./server/auth/challengeToken.cjs');
const mfaLib = require('./server/auth/mfa.cjs');

async function test() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: { rejectUnauthorized: false }
    });
    
    // get a user
    const { rows: users } = await pool.query(`SELECT * FROM ratings.users WHERE mfa_enabled = true LIMIT 1`);
    const user = users[0];
    
    // mint a challenge
    const { token } = await challengeLib.mintChallenge(pool, {
        userId: user.id,
        purpose: 'mfa_challenge',
        ip: '127.0.0.1'
    });
    
    // Test the API directly with an invalid backup code
    const res = await fetch('http://localhost:3001/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: token, code: "INVALID", isBackupCode: true })
    });
    console.log(res.status, await res.text());
    pool.end();
}
test();
