/**
 * Seeds nishant.m@trailytics.com as a super_admin. One-off script so it
 * doesn't rotate the passwords of the existing three super_admins.
 *
 * Prints login ID + password to stdout. If SMTP env vars are present, also
 * sends an invitation email with a password-set link.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

const COMPANY_ID = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
const EMAIL = 'nishant.m@trailytics.com';
const FULL_NAME = 'Nishant M';
const ROLE = 'super_admin';

function makePassword() {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 14; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
    return out;
}

(async () => {
    const client = new Client({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: process.env.DB_HOST && !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
            ? { rejectUnauthorized: false } : false,
    });
    await client.connect();

    const username = EMAIL.split('@')[0].toLowerCase();
    const password = makePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();

    await client.query('BEGIN');
    try {
        const u = await client.query(`
            INSERT INTO ratings.users
                (id, username, email, full_name, password_hash, status, role,
                 must_reset_password, mfa_enabled, timezone, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'active', $6, false, false, 'Asia/Kolkata', now())
            ON CONFLICT ((lower(username)))
            DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                password_hash = EXCLUDED.password_hash,
                status = 'active',
                role = EXCLUDED.role,
                updated_at = now()
            RETURNING id
        `, [userId, username, EMAIL, FULL_NAME, passwordHash, ROLE]);

        await client.query(`
            INSERT INTO ratings.user_company_memberships
                (id, user_id, company_id, role, status, is_primary, platform_scope, updated_at)
            VALUES ($1, $2, $3, $4, 'active', true, 'all', now())
            ON CONFLICT (user_id, company_id)
            DO UPDATE SET role = EXCLUDED.role, status = 'active', is_primary = true, updated_at = now()
        `, [membershipId, u.rows[0].id, COMPANY_ID, ROLE]);

        await client.query('COMMIT');

        console.log('\n--- NISHANT SUPER-ADMIN CREDENTIALS ---');
        console.log(`Login ID : ${username}`);
        console.log(`Email    : ${EMAIL}`);
        console.log(`Password : ${password}`);
        console.log(`Role     : ${ROLE}`);
        console.log(`URL      : ${process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app'}`);
        console.log('---\n');

        // Try sending invitation email if SMTP is configured
        const SMTP_OK = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
        if (SMTP_OK) {
            try {
                const { sendAlertEmail } = require('../server/automation/mailer.cjs');
                const dashboard = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
                const html = `
                    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
                      <h2 style="color:#4f46e5;margin:0 0 12px">Welcome to Rating Intelligence</h2>
                      <p>Hi ${FULL_NAME},</p>
                      <p>An account has been set up for you on <strong>Rating Intelligence</strong> as a super-admin.</p>
                      <p style="font-size:13px"><strong>Login ID:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${username}</code><br>
                         <strong>Temporary password:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${password}</code><br>
                         <strong>Sign-in URL:</strong> <a href="${dashboard}" style="color:#4f46e5">${dashboard}</a></p>
                      <p>Your first sign-in will walk you through setting up two-factor authentication (you'll need an authenticator app like Google Authenticator).</p>
                      <p style="font-size:12px;color:#64748b">Once signed in, change your password from the avatar menu → Security.</p>
                    </div>`;
                await sendAlertEmail({
                    to: EMAIL,
                    subject: 'Welcome to Rating Intelligence',
                    html,
                    text: `Login: ${username}\nPassword: ${password}\nURL: ${dashboard}`,
                    priority: 'high',
                });
                console.log(`Invitation email sent to ${EMAIL}.`);
            } catch (mailErr) {
                console.log(`Invitation email FAILED: ${mailErr.message}`);
            }
        } else {
            console.log('SMTP not configured — share the credentials manually.');
            console.log('To enable email sending, set SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM in .env.');
        }
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Failed: ${e.message}`);
        process.exit(1);
    }
    await client.end();
})().catch(e => { console.error(e); process.exit(1); });
