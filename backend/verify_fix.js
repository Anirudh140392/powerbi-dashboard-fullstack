import axios from 'axios';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';

async function verify() {
    try {
        console.log("Generating token for kenilkavar@gmail.com...");
        const token = jwt.sign({
            userId: 1,
            email: 'kenilkavar@gmail.com',
            userName: 'Kenil',
            dbName: 'colpal' // The middleware should force this to mars
        }, JWT_SECRET);

        console.log("Fetching KPIs...");
        const res = await axios.get('http://localhost:5000/api/pricing-analysis/kpis', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                startDate: '2026-03-01',
                endDate: '2026-03-07'
            }
        });

        console.log("KPI Response:", JSON.stringify(res.data, null, 2));

        if (res.data.success && res.data.data.discount.value > 0) {
            console.log("✅ VERIFICATION SUCCESS: Data returned for Mars context.");
        } else {
            console.log("❌ VERIFICATION FAILED: Data is empty or failed.");
        }

    } catch (err) {
        console.error("Verification error:", err.message);
    }
}
verify();
