/**
 * TOTP MFA primitives — secret generation, code verification, backup codes.
 *
 * Stateless module: all DB interactions happen in the caller (server/api.cjs)
 * so this file stays trivially testable. Replay protection (the "don't accept
 * the same 30s code twice" rule) is enforced by the caller comparing against
 * users.mfa_last_used_code + mfa_last_used_at.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

// ±30 s drift tolerance — covers most phones with bad NTP without weakening
// the brute-force guarantee meaningfully (window 1 = 3 valid codes at any
// instant, still 333k combinations to guess inside 90 s).
authenticator.options = { window: 1, step: 30, digits: 6 };

const ISSUER = process.env.MFA_ISSUER || 'Rating Intelligence';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skip 0/O/I/1 — easier to read

function generateSecret({ email }) {
    const secret = authenticator.generateSecret(); // base32, 16 chars
    const otpauthUri = authenticator.keyuri(email, ISSUER, secret);
    return { secret, otpauthUri };
}

async function renderQrDataUri(otpauthUri) {
    return qrcode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 1, width: 260 });
}

function verifyTotp(secret, code) {
    if (!secret || typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
    try {
        return authenticator.check(code, secret);
    } catch {
        return false;
    }
}

function generateBackupCodes(count = BACKUP_CODE_COUNT) {
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(`${randomChars(4)}-${randomChars(4)}`);
    }
    return out;
}

function randomChars(n) {
    let out = '';
    const bytes = crypto.randomBytes(n);
    for (let i = 0; i < n; i++) out += BACKUP_CODE_ALPHABET[bytes[i] % BACKUP_CODE_ALPHABET.length];
    return out;
}

function normalizeBackupCode(input) {
    if (typeof input !== 'string') return null;
    const stripped = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (stripped.length !== 8) return null;
    return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
}

async function hashBackupCode(code) {
    return bcrypt.hash(code, 10);
}

/**
 * Compare `code` against every unused backup-code row, in constant work order
 * regardless of which row matches (no short-circuit). Returns the row that
 * matched, or null.
 *
 * Caller must mark the returned row's used_at = NOW().
 */
async function findMatchingBackupCode(pool, userId, codeInput) {
    const code = normalizeBackupCode(codeInput);
    if (!code) return null;
    const { rows } = await pool.query(
        `SELECT id, code_hash FROM ratings.mfa_backup_codes
         WHERE user_id = $1 AND used_at IS NULL
         ORDER BY id ASC`,
        [userId]
    );
    let match = null;
    for (const row of rows) {
        const ok = await bcrypt.compare(code, row.code_hash);
        if (ok && !match) match = row; // don't break — keep timing constant
    }
    return match;
}

module.exports = {
    generateSecret,
    renderQrDataUri,
    verifyTotp,
    generateBackupCodes,
    hashBackupCode,
    findMatchingBackupCode,
    normalizeBackupCode,
};
