const crypto = require('crypto');
const http = require('http');

const SSO_SECRET = 'trailytics_sso_shared_secret_2026_xK9mPq';
const email = 'prestige@trailytics.com';
const payload = { email, exp: Date.now() + 60_000 };
const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', SSO_SECRET).update(payloadB64).digest('base64url');
const ssoToken = `${payloadB64}.${sig}`;

const data = JSON.stringify({ ssoToken });

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/sso',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${body}`);
  });
});

req.on('error', console.error);
req.write(data);
req.end();
