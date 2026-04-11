import axios from 'axios';

async function testAccessEnforcement() {
    const API = 'http://localhost:5000/api/auth/login';

    console.log("--- CASE 1: Logging in as a PENDING user ---");
    try {
        const res = await axios.post(API, {
            email: 'boat@trailytics.com',
            password: 'Boat@123#'
        });
        console.log("SUCCESS (Unexpected):", res.data);
    } catch (e) {
        console.log("EXPECTED ERROR:", e.response?.data?.error || e.message);
    }

    console.log("\n--- CASE 2: Logging in as an ADMIN (Should always pass) ---");
    try {
        const res = await axios.post(API, {
            email: 'sanyamadmin@trailytics.com',
            password: 'Admin@123#'
        });
        console.log("SUCCESS:", res.data.success);
    } catch (e) {
        console.log("ERROR (Unexpected):", e.response?.data?.error || e.message);
    }
}

testAccessEnforcement();
