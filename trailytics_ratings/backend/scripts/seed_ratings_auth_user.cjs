require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

function getArg(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return null;
    return process.argv[idx + 1] || null;
}

const username = getArg('--username') || process.env.RATINGS_AUTH_USERNAME;
const email = getArg('--email') || process.env.RATINGS_AUTH_EMAIL;
const fullName = getArg('--name') || process.env.RATINGS_AUTH_NAME || 'Admin';
const password = getArg('--password') || process.env.RATINGS_AUTH_PASSWORD;
const companyId = getArg('--company-id') || process.env.RATINGS_AUTH_COMPANY_ID;
const role = getArg('--role') || process.env.RATINGS_AUTH_ROLE || 'company_admin';
const platformScope = getArg('--platform-scope') || process.env.RATINGS_AUTH_PLATFORM_SCOPE || 'all';

if (!username || !email || !password || !companyId) {
    console.error('Usage: node scripts/seed_ratings_auth_user.cjs --username <username> --email <email> --password <password> --company-id <uuid> [--name <name>] [--role <role>] [--platform-scope all|restricted]');
    process.exit(1);
}

const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false,
});

async function main() {
    await client.connect();

    const companyCheck = await client.query(
        'select id, name from public.companies where id = $1',
        [companyId]
    );
    if (companyCheck.rowCount === 0) {
        throw new Error(`Company not found: ${companyId}`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();

    await client.query('begin');

    const userResult = await client.query(`
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
        returning id, username, email, full_name, role
    `, [userId, username, email, fullName, passwordHash, role]);

    const user = userResult.rows[0];

    const membershipResult = await client.query(`
        insert into ratings.user_company_memberships (id, user_id, company_id, role, status, is_primary, platform_scope, updated_at)
        values ($1, $2, $3, $4, 'active', true, $5, now())
        on conflict (user_id, company_id)
        do update set
            role = excluded.role,
            status = excluded.status,
            is_primary = excluded.is_primary,
            platform_scope = excluded.platform_scope,
            updated_at = now()
        returning id, company_id, role, platform_scope
    `, [membershipId, user.id, companyId, role, platformScope]);

    await client.query(`
        update ratings.user_company_memberships
        set is_primary = case when id = $2 then true else false end,
            updated_at = now()
        where user_id = $1
    `, [user.id, membershipResult.rows[0].id]);

    await client.query('commit');

    console.log(JSON.stringify({
        user,
        membership: membershipResult.rows[0],
        company: companyCheck.rows[0],
    }));
    await client.end();
}

main().catch(async (error) => {
    try {
        await client.query('rollback');
    } catch {}
    console.error('Failed to seed Ratings auth user:', error);
    try {
        await client.end();
    } catch {}
    process.exit(1);
});
