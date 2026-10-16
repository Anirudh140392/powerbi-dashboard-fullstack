/**
 * Seeds the three Trailytics super-admin accounts.
 *
 * Idempotent: re-running rotates the password for each. The CSV output is
 * the only place the plaintext is shown — capture it once and share securely.
 *
 *   saurabh.j@trailytics.com
 *   harshit.k@trailytics.com
 *   akshuti.m@trailytics.com
 *
 * super_admin is the only role with access to:
 *   - Rules → Mailer / Category / Stakeholder / Competitor maps
 *   - Rules → Job Triggers / Run History / Users (MFA reset)
 *   - PipelineStatusHero banner
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

const COMPANY_ID = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
const ROLE = 'super_admin';

const ACCOUNTS = [
    { email: 'saurabh.j@trailytics.com',  fullName: 'Saurabh J' },
    { email: 'harshit.k@trailytics.com',  fullName: 'Harshit K' },
    { email: 'akshuti.m@trailytics.com',  fullName: 'Akshuti M' },
];

function makePassword() {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 14; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
    return out;
}

async function main() {
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

    const company = await client.query('SELECT id, name FROM public.companies WHERE id = $1', [COMPANY_ID]);
    if (company.rowCount === 0) throw new Error(`Company not found: ${COMPANY_ID}`);

    const rows = [['email', 'username', 'password']];
    for (const { email, fullName } of ACCOUNTS) {
        const username = email.split('@')[0].toLowerCase();
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
                    status = EXCLUDED.status,
                    role = EXCLUDED.role,
                    updated_at = now()
                RETURNING id
            `, [userId, username, email, fullName, passwordHash, ROLE]);

            await client.query(`
                INSERT INTO ratings.user_company_memberships
                    (id, user_id, company_id, role, status, is_primary, platform_scope, updated_at)
                VALUES ($1, $2, $3, $4, 'active', true, 'all', now())
                ON CONFLICT (user_id, company_id)
                DO UPDATE SET role = EXCLUDED.role, status = 'active', is_primary = true, updated_at = now()
            `, [membershipId, u.rows[0].id, COMPANY_ID, ROLE]);

            await client.query('COMMIT');
            rows.push([email, username, password]);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`Failed for ${email}: ${e.message}`);
        }
    }

    console.log('--- SUPER-ADMIN CREDENTIALS (CSV) ---');
    console.log('Share these securely (1Password etc.). MFA enrolment is enforced on first login.\n');
    for (const r of rows) console.log(r.join(','));
    console.log('\n--- END ---');

    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
