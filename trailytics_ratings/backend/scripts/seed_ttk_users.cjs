/**
 * Bulk-creates Ratings auth accounts for a list of @ttkprestige.com emails.
 *
 * Each row: derive username from local-part, derive name from segments,
 * generate a unique 12-char password, upsert into ratings.users + grant
 * Prestige membership.
 *
 * Output: CSV of (email, username, password) to stdout — single source for
 * sharing creds. Idempotent: re-running rotates passwords for the same users.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

const COMPANY_ID = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
const ROLE = 'company_admin';

const EMAILS = [
    'anil.gurnani@ttkprestige.com',
    'nitin.verma@ttkprestige.com',
    'akila.c@ttkprestige.com',
    'pawankumar.rastogi@ttkprestige.com',
    'gokulakrishnan.m@ttkprestige.com',
    'chandramani.gangolli@ttkprestige.com',
    'sajal.malhotra@ttkprestige.com',
    'jaffar.sadiq@ttkprestige.com',
    'parth.pradhan@ttkprestige.com',
    'payal.mamnani@ttkprestige.com',
    'anujs.pandey@ttkprestige.com',
    'dheeraj.batra@ttkprestige.com',
    'chetan.vyas@ttkprestige.com',
    'kumar.tarun@ttkprestige.com',
    'aditya.rao@ttkprestige.com',
    'siddharth.bharadwaj@ttkprestige.com',
    'vishal.sharma@ttkprestige.com',
    'mohammed.meraj@ttkprestige.com',
    'kathirvel.t@ttkprestige.com',
];

function titleCase(s) {
    return s.split(/[._\s-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function makePassword() {
    // 12 chars, easy-to-type, mixed case + digits, no ambiguous chars
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 12; i++) {
        out += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return out;
}

async function main() {
    const client = new Client({
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false,
    });
    await client.connect();

    const company = await client.query('select id, name from public.companies where id = $1', [COMPANY_ID]);
    if (company.rowCount === 0) throw new Error(`Company not found: ${COMPANY_ID}`);

    const rows = [['email', 'username', 'password']];
    for (const email of EMAILS) {
        const username = email.split('@')[0].toLowerCase();
        const fullName = titleCase(username);
        const password = makePassword();
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        const membershipId = crypto.randomUUID();

        await client.query('begin');
        try {
            const u = await client.query(`
                insert into ratings.users (id, username, email, full_name, password_hash, status, role, must_reset_password, mfa_enabled, timezone, updated_at)
                values ($1, $2, $3, $4, $5, 'active', $6, false, false, 'Asia/Kolkata', now())
                on conflict ((lower(username)))
                do update set
                    email = excluded.email,
                    full_name = excluded.full_name,
                    password_hash = excluded.password_hash,
                    status = excluded.status,
                    role = excluded.role,
                    must_reset_password = excluded.must_reset_password,
                    mfa_enabled = excluded.mfa_enabled,
                    timezone = excluded.timezone,
                    updated_at = now()
                returning id
            `, [userId, username, email, fullName, passwordHash, ROLE]);

            await client.query(`
                insert into ratings.user_company_memberships (id, user_id, company_id, role, status, is_primary, platform_scope, updated_at)
                values ($1, $2, $3, $4, 'active', true, 'all', now())
                on conflict (user_id, company_id)
                do update set role = excluded.role, status = 'active', is_primary = true, platform_scope = 'all', updated_at = now()
            `, [membershipId, u.rows[0].id, COMPANY_ID, ROLE]);

            await client.query('commit');
            rows.push([email, username, password]);
        } catch (e) {
            await client.query('rollback');
            console.error(`Failed for ${email}: ${e.message}`);
        }
    }

    console.log('--- CREDENTIALS (CSV) ---');
    for (const r of rows) console.log(r.join(','));
    console.log('--- END ---');

    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
