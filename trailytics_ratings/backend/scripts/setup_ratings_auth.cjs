require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false,
});

const ddl = `
CREATE TABLE IF NOT EXISTS ratings.users (
    id uuid PRIMARY KEY,
    username text NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    password_hash text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    role text NOT NULL DEFAULT 'viewer',
    last_login_at timestamptz NULL,
    must_reset_password boolean NOT NULL DEFAULT false,
    mfa_enabled boolean NOT NULL DEFAULT false,
    timezone varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_users_username_key
    ON ratings.users (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS ratings_users_email_key
    ON ratings.users (lower(email));

CREATE TABLE IF NOT EXISTS ratings.user_company_memberships (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES ratings.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    role text NOT NULL DEFAULT 'viewer',
    status text NOT NULL DEFAULT 'active',
    is_primary boolean NOT NULL DEFAULT false,
    platform_scope text NOT NULL DEFAULT 'all',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ratings_user_company_memberships_platform_scope_check
        CHECK (platform_scope IN ('all', 'restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_user_company_memberships_user_company_key
    ON ratings.user_company_memberships (user_id, company_id);

CREATE INDEX IF NOT EXISTS ratings_user_company_memberships_company_idx
    ON ratings.user_company_memberships (company_id);

CREATE TABLE IF NOT EXISTS ratings.user_platform_access (
    id uuid PRIMARY KEY,
    membership_id uuid NOT NULL REFERENCES ratings.user_company_memberships(id) ON DELETE CASCADE,
    platform_uuid uuid NOT NULL REFERENCES public.platforms(uuid) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_user_platform_access_membership_platform_key
    ON ratings.user_platform_access (membership_id, platform_uuid);

CREATE INDEX IF NOT EXISTS ratings_user_platform_access_platform_idx
    ON ratings.user_platform_access (platform_uuid);

CREATE TABLE IF NOT EXISTS ratings.auth_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES ratings.users(id) ON DELETE CASCADE,
    membership_id uuid NOT NULL REFERENCES ratings.user_company_memberships(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    session_token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    ip_address inet NULL,
    user_agent text NULL,
    revoked_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_auth_sessions_token_hash_key
    ON ratings.auth_sessions (session_token_hash);

CREATE INDEX IF NOT EXISTS ratings_auth_sessions_user_idx
    ON ratings.auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS ratings_auth_sessions_company_idx
    ON ratings.auth_sessions (company_id);

CREATE INDEX IF NOT EXISTS ratings_auth_sessions_active_idx
    ON ratings.auth_sessions (expires_at, revoked_at);
`;

async function main() {
    await client.connect();
    await client.query(ddl);
    console.log('Ratings auth schema is ready.');
    await client.end();
}

main().catch(async (error) => {
    console.error('Failed to set up Ratings auth schema:', error);
    try {
        await client.end();
    } catch {}
    process.exit(1);
});
