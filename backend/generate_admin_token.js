import jwt from 'jsonwebtoken';

const JWT_SECRET = 'trailytics_jwt_secret_2026';
const tokenPayload = {
    userId: '12345678',
    email: 'anirudh@trailytics.com',
    userName: 'Anirudh Admin',
    dbName: 'mars',
    dbLogoUrl: '',
    role: 'admin',
    dbStatus: true,
    tabPermissions: {}
};

const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
console.log('TOKEN_VALUE_START');
console.log(token);
console.log('TOKEN_VALUE_END');
console.log('USER_VALUE_START');
console.log(JSON.stringify({
    email: 'anirudh@trailytics.com',
    name: 'Anirudh Admin',
    dbName: 'mars',
    dbLogoUrl: '',
    role: 'admin',
    dbStatus: true,
    tabPermissions: {}
}));
console.log('USER_VALUE_END');
