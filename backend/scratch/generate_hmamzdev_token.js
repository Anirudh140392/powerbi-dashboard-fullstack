import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const payload = {
  userId: "3146618080541448438",
  email: "hmamzdev@trailytics.com",
  userName: "Ravi teja",
  dbName: "hm_amz_dev",
  role: "admin",
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

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
console.log("GENERATED_TOKEN:", token);
