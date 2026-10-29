import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const payload = {
  userId: "5658550305371365000",
  email: "zydus@trailytics.com",
  userName: "Boat Tenant",
  dbName: "boat",
  role: "user",
  dbStatus: true,
  tabPermissions: {}
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

async function run() {
    try {
        console.log("Token generated.");
        
        // 1. Test KPI Trends (3M, Monthly)
        console.log("\nTesting /api/availability-analysis/kpi-trends (3M, Monthly, no custom dates)...");
        let res = await axios.get('http://localhost:5000/api/availability-analysis/kpi-trends', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                platform: 'All',
                period: '3M',
                timeStep: 'Monthly'
            }
        });
        console.log("KPI Trends (3M, Monthly) Dates returned:", res.data.timeSeries ? res.data.timeSeries.map(p => p.date) : []);

        // 2. Test KPI Trends (6M, Monthly)
        console.log("\nTesting /api/availability-analysis/kpi-trends (6M, Monthly, no custom dates)...");
        res = await axios.get('http://localhost:5000/api/availability-analysis/kpi-trends', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                platform: 'All',
                period: '6M',
                timeStep: 'Monthly'
            }
        });
        console.log("KPI Trends (6M, Monthly) Dates returned:", res.data.timeSeries ? res.data.timeSeries.map(p => p.date) : []);

        // 3. Test Competition Brand Trends (3M, Monthly)
        console.log("\nTesting /api/availability-analysis/competition-brand-trends (3M, Monthly, no custom dates)...");
        res = await axios.post('http://localhost:5000/api/availability-analysis/competition-brand-trends', {
            platform: 'All',
            period: '3M',
            timeStep: 'Monthly',
            brands: 'boat'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Competition Brand Trends (3M, Monthly) Dates returned:", res.data.dates);

    } catch (e) {
        console.error("Test failed:", e.response ? e.response.data : e.message);
    }
    process.exit(0);
}
run();
