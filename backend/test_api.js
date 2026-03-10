import jwt from 'jsonwebtoken';

const token = jwt.sign({
    userId: 1,
    email: 'kenilkavar@gmail.com',
    userName: 'Test User',
    dbName: 'mars'
}, 'trailytics_jwt_secret_2026', { expiresIn: '1h' });

const url = "http://localhost:5000/api/watchtower/overview?startDate=2024-01-01&endDate=2024-03-31&brand=All&platform=All&location=All&channel=Ecommerce";

fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(json => {
        if (!json.success) {
            console.error("API Error:", json);
            return;
        }
        console.log("Summary Metrics:", json.data.summaryMetrics);
        const allPlatform = json.data.platformOverview.find(p => p.key === 'all');
        if (allPlatform) {
            console.log("All column details:");
            console.log(allPlatform.columns.find(c => c.title === 'Offtakes'));
        } else {
            console.log("Platform 'all' not found in platformOverview");
        }
    })
    .catch(err => console.error("Fetch Error:", err));
