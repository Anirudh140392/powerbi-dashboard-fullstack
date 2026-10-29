import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const basePayload = {
  userId: "1681045526671301566",
  email: "Mars@trailytics.com",
  userName: "Manan Sabharwal",
  dbName: "mars",
  dbStatus: true,
  tabPermissions: {
    "Business Overview": true,
    "India Overview": true,
    "Insights": true,
    "Availability Analysis": true,
    "Market Coverage": false,
    "Visibility Analysis": true,
    "Market Share": true,
    "Sales Data": false,
    "Pricing Analysis": true,
    "Performance Marketing": true,
    "Portfolio Analysis": false,
    "Content Analysis": true,
    "Inventory Analysis": true,
    "Play it Yourself": false,
    "Category RCA": false,
    "Scheduled Reports": true,
    "Download Report": false,
    "Ad Auto": false,
    "Rating": false,
    "Supply": false,
    "Content": true,
    "Priority Action": false
  }
};

// 1. User role token
const userPayload = { ...basePayload, role: "user" };
const userToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });
console.log("=== ROLE: USER ===");
console.log(userToken);
console.log("\n");

// 2. Admin role token
const adminPayload = { ...basePayload, role: "admin" };
const adminToken = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '30d' });
console.log("=== ROLE: ADMIN ===");
console.log(adminToken);
