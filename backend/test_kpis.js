import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = process.env.JWT_SECRET || 'trailytics_jwt_secret_2026';

async function testApi() {
    try {
        const tokenPayload = {
            userId: 1,
            email: 'test@mars.com',
            userName: 'Mars Test User',
            dbName: 'mars',
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

        const kpiRes = await axios.get('http://localhost:5000/api/pricing-analysis/kpis', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                startDate: '2026-03-01',
                endDate: '2026-03-07'
            }
        });

        console.log("Data:", JSON.stringify(kpiRes.data, null, 2));

    } catch (err) {
        if (err.response) {
            console.error("API Error:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Error:", err.message);
        }
    }
}
testApi();
