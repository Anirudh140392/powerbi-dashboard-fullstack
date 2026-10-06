import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const payload = {
  userId: "5658550305371365000",
  email: "boat@trailytics.com",
  userName: "Boat",
  dbName: "boat",
  role: "user",
  dbStatus: true,
  tabPermissions: {}
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

async function testTrend(timeStep) {
    try {
        console.log(`\n--- Testing ${timeStep} Watchtower KPI Trends ---`);
        const res = await axios.get('http://localhost:5000/api/watchtower/kpi-trends', {
            params: {
                period: '1M',
                timeStep: timeStep,
                platform: 'Amazon',
                brand: 'boat'
            },
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`[${timeStep}] Status:`, res.status);
        console.log(`[${timeStep}] TimeSeries count:`, res.data.timeSeries ? res.data.timeSeries.length : 'none');
        console.log(`[${timeStep}] Sample:`, res.data.timeSeries ? res.data.timeSeries.slice(0, 3) : []);
    } catch (e) {
        console.error(`[${timeStep}] Failed:`, e.response ? e.response.data : e.message);
    }
}

async function run() {
    await testTrend('Daily');
    await testTrend('Weekly');
    await testTrend('Monthly');
}
run();
