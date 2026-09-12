import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const tokenPayload = {
    userId: 1,
    email: 'test@trailytics.com',
    userName: 'Test User',
    dbName: 'mars',
};

const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
console.log(token);
