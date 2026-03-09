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
            dbName: 'colpal' // authService logic will override this to mars
        }, JWT_SECRET);

        console.log("Fetching Dimension Overview...");
        const res = await axios.get('http://localhost:5000/api/pricing-analysis/dimension-overview', {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                dimension: 'category',
                startDate: '2026-03-01',
                endDate: '2026-03-07'
            }
        });

        console.log("Response Success:", res.data.success);
        console.log("Data count:", res.data.data?.length);

        if (res.data.success && res.data.data?.length > 0) {
            console.log("✅ VERIFICATION SUCCESS: Category data returned.");
            console.log("First row:", JSON.stringify(res.data.data[0], null, 2));
        } else {
            console.log("❌ VERIFICATION FAILED: Data is empty.");
        }

    } catch (err) {
        console.error("Verification error:", err.message);
    }
}
verify();
