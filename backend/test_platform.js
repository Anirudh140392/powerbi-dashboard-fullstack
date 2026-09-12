import jwt from 'jsonwebtoken';

const token = jwt.sign({
    userId: 1, email: 'kenilkavar@gmail.com', userName: 'Test User', dbName: 'mars'
}, 'trailytics_jwt_secret_2026', { expiresIn: '1h' });

const url = "http://127.0.0.1:5000/api/watchtower/platform-overview?startDate=2024-01-01&endDate=2024-03-31&brand=All&platform=All&location=All&channel=Ecommerce";

fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(json => {
        if (!Array.isArray(json)) console.log("JSON:", json);
        const allPlatform = json.find(p => p.key === 'all' || p.label === 'All');
        if (allPlatform) {
            console.log("All column title offtakes:", allPlatform.columns.find(c => c.title === 'Offtakes'));
        } else {
             console.log("Platform 'all' not found");
        }
    })
    .catch(err => console.error(err));
