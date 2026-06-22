import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const payload = {
  userId: "5658550305371365000",
  email: "zydus@trailytics.com",
  userName: "Zydus",
  dbName: "zydus",
  role: "user",
  dbStatus: true,
  tabPermissions: {}
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

async function run() {
    try {
        console.log("Token:", token);
        const res = await axios.get('http://localhost:5000/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Verify response:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Verify failed:", e.response ? e.response.data : e.message);
    }
}
run();
