import jwt from 'jsonwebtoken';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';
const tokenPayload = {
    userId: 1,
    email: 'test@test.com',
    userName: 'test',
    dbName: 'mars',
};
const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

async function run() {
    const url = "http://localhost:5000/api/availability-analysis/signal-lab?type=visibility&signalType=drainer&page=1&limit=5&groupBy=brand";
    console.log("Fetching", url);
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);

    try {
        const errDump = fs.readFileSync('/tmp/signal_err.txt', 'utf8');
        console.log("ERROR DUMP:\\n", errDump);
    } catch (e) {
        console.log("No error dump found locally");
    }
}
run();
