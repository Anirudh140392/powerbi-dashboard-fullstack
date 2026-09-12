import axios from 'axios';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';

function generateToken() {
    const payload = {
        userId: "1234567890",
        email: "drl@trailytics.com",
        userName: "DRL User",
        dbName: "drl",
        role: "user",
        dbStatus: true,
        tabPermissions: {
            "Business Overview": true,
            "Primary Summary": true,
            "Secondary Summary": true
        }
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function testServer() {
    const token = generateToken();
    const urlBase = 'http://localhost:5000/api';
    const config = {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };

    console.log("=== Testing Running Server Endpoints (Authenticated) ===");
    try {
        console.log("1. Hitting /primary-sales/latest-date...");
        const pDateRes = await axios.get(`${urlBase}/primary-sales/latest-date`, config);
        console.log("Primary dates status:", pDateRes.status, pDateRes.data);

        console.log("\n2. Hitting /primary-sales/all...");
        const pAllRes = await axios.get(`${urlBase}/primary-sales/all`, {
            ...config,
            params: {
                startDate: '2026-06-01', // Include June to verify fallback is working over HTTP too
                endDate: '2026-07-30',
                xAxis: 'Retailer Name',
                brandName: 'All',
                retailerName: 'All',
                product: 'All',
                division: 'All',
                zone: 'All',
                location: 'All',
                channel: 'All',
                platform: 'All'
            }
        });
        console.log("Primary all status:", pAllRes.status);
        console.log("Primary KPI check:", pAllRes.data.data?.kpis);
        console.log("Primary MOM sample:", pAllRes.data.data?.mom);
        console.log("Primary Pivot Month headers:", pAllRes.data.data?.pivotTable?.allMonths);
        if (pAllRes.data.data?.pivotTable?.data?.length > 0) {
            console.log("Primary Pivot Row sample:", pAllRes.data.data.pivotTable.data[0]);
        }

        console.log("\n3. Hitting /secondary-sales/latest-date...");
        const sDateRes = await axios.get(`${urlBase}/secondary-sales/latest-date`, config);
        console.log("Secondary dates status:", sDateRes.status, sDateRes.data);

        console.log("\n4. Hitting /secondary-sales/seller-wise...");
        const sSellerRes = await axios.get(`${urlBase}/secondary-sales/seller-wise`, {
            ...config,
            params: {
                startDate: '2026-08-01',
                endDate: '2026-08-02'
            }
        });
        console.log("Secondary seller wise status:", sSellerRes.status, "total:", sSellerRes.data.data?.total);

        console.log("\n5. Hitting /secondary-sales/quarter-wise...");
        const sQuarterRes = await axios.get(`${urlBase}/secondary-sales/quarter-wise`, {
            ...config,
            params: {
                startDate: '2026-08-01',
                endDate: '2026-08-02'
            }
        });
        console.log("Secondary quarter wise status:", sQuarterRes.status, "total:", sQuarterRes.data.data?.total);

    } catch (e) {
        console.error("HTTP Request failed:", e.message);
        if (e.response) {
            console.error("Response error data:", e.response.data);
        }
    }
}

testServer();
