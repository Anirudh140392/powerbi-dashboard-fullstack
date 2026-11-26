import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const payload = {
  userId: "14455423951137815000",
  email: "demo@trailytics.com",
  userName: "Kenil Kavar",
  dbName: "mamaearth",
  role: "user",
  dbStatus: true,
  tabPermissions: {
    "Business Overview": true,
    "India Overview": true,
    "Insights": true,
    "Availability Analysis": true,
    "Market Coverage": true,
    "Visibility Analysis": true,
    "Market Share": true,
    "Sales Data": true,
    "Pricing Analysis": true,
    "Performance Marketing": true,
    "Portfolio Analysis": true,
    "Content Analysis": true,
    "Inventory Analysis": true,
    "Play it Yourself": true,
    "Category RCA": true,
    "Scheduled Reports": true,
    "Ad Auto": true,
    "Rating": true,
    "Supply": true,
    "Content": true,
    "Priority Action": true
  }
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
console.log("GENERATED_TOKEN:", token);
