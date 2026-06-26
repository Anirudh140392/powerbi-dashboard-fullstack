import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const payload = {
  userId: "admin_user_id",
  email: "admin@trailytics.com",
  userName: "Admin",
  role: "admin",
  dbStatus: true,
  tabPermissions: {}
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

async function run() {
    try {
        console.log("Fetching platforms for mamaearth...");
        const resMama = await axios.get('http://localhost:5000/api/admin/platforms?dbName=mamaearth', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Mamaearth response:", resMama.data);

        console.log("Fetching platforms for mars...");
        const resMars = await axios.get('http://localhost:5000/api/admin/platforms?dbName=mars', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Mars response:", resMars.data);

        console.log("Fetching platforms without dbName...");
        const resNone = await axios.get('http://localhost:5000/api/admin/platforms', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Default response:", resNone.data);
    } catch (e) {
        console.error("API test failed:", e.response ? e.response.data : e.message);
    }
}
run();
