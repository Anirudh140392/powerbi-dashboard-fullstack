// /**
//  * Short-lived single-use tokens for the gap between password-success and
//  * MFA-success (and for the password-reset email link).
//  *
//  * Backed by ratings.auth_sessions with purpose IN (
//  *   'mfa_challenge', 'mfa_enrolment', 'password_reset'
//  * ) — reusing the existing table (hashed token, revocation, expiry) avoids
//  * inventing a new store.
//  *
//  * mintChallenge   → returns plaintext token + writes hashed row.
//  * consumeChallenge → loads row, validates purpose+expiry+revocation,
//  *                    atomically revokes it (single-use), returns userId.
//  */
// const crypto = require('crypto');

// const TTL_SECONDS = {
//     mfa_challenge: 5 * 60,        // 5 min — type your code in
//     mfa_enrolment: 10 * 60,       // 10 min — scan QR + type code
//     password_reset: 30 * 60,      // 30 min — read email + click link
// };

// function createToken() {
//     return crypto.randomBytes(32).toString('hex');
// }

// function hashToken(token) {
//     return crypto.createHash('sha256').update(token).digest('hex');
// }

// async function mintChallenge(pool, { userId, membershipId, companyId, purpose, ip, userAgent }) {
//     if (!TTL_SECONDS[purpose]) throw new Error(`Unknown challenge purpose: ${purpose}`);

//     // auth_sessions requires membership_id + company_id NOT NULL. For
//     // password_reset and the MFA flows the user may have multiple memberships;
//     // we pin the row to the primary (or first active) membership so the FK
//     // holds. The actual session minted AFTER MFA success uses its own
//     // properly-selected membership.
//     let pinnedMembershipId = membershipId;
//     let pinnedCompanyId = companyId;
//     if (!pinnedMembershipId || !pinnedCompanyId) {
//         const { rows } = await pool.query(
//             `SELECT id, company_id FROM ratings.user_company_memberships
//              WHERE user_id = $1 AND status = 'active'
//              ORDER BY is_primary DESC, created_at ASC LIMIT 1`,
//             [userId]
//         );
//         if (rows.length === 0) {
//             throw new Error('User has no active membership; cannot mint challenge token.');
//         }
//         pinnedMembershipId = rows[0].id;
//         pinnedCompanyId = rows[0].company_id;
//     }

//     const token = createToken();
//     const tokenHash = hashToken(token);
//     const id = crypto.randomUUID();
//     const expiresAt = new Date(Date.now() + TTL_SECONDS[purpose] * 1000);

//     await pool.query(
//         `INSERT INTO ratings.auth_sessions
//             (id, user_id, membership_id, company_id, session_token_hash,
//              expires_at, last_activity_at, ip_address, user_agent, purpose)
//          VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9)`,
//         [id, userId, pinnedMembershipId, pinnedCompanyId, tokenHash,
//          expiresAt.toISOString(), ip || null, userAgent || null, purpose]
//     );

//     return { token, expiresAt: expiresAt.toISOString(), challengeId: id };
// }

// /**
//  * Atomically validates + revokes a challenge token. Returns the user_id and
//  * membership_id, or null if the token is invalid/expired/already-used/wrong-purpose.
//  */
// async function consumeChallenge(pool, token, expectedPurpose) {
//     if (!token || typeof token !== 'string') return null;
//     const tokenHash = hashToken(token);
//     const { rows } = await pool.query(
//         `UPDATE ratings.auth_sessions
//          SET revoked_at = now()
//          WHERE session_token_hash = $1
//            AND purpose = $2
//            AND revoked_at IS NULL
//            AND expires_at > now()
//          RETURNING user_id, membership_id, company_id`,
//         [tokenHash, expectedPurpose]
//     );
//     if (rows.length === 0) return null;
//     return rows[0];
// }

// /**
//  * Peek at a challenge without consuming it. Used by enrol/start which
//  * issues a follow-up challenge for confirm — we don't want to burn the
//  * original token until the user actually proves they can scan the QR.
//  *
//  * Returns the row + a derived `valid` flag.
//  */
// async function peekChallenge(pool, token, expectedPurpose) {
//     if (!token || typeof token !== 'string') return null;
//     const tokenHash = hashToken(token);
//     const { rows } = await pool.query(
//         `SELECT user_id, membership_id, company_id, expires_at, revoked_at, purpose
//          FROM ratings.auth_sessions
//          WHERE session_token_hash = $1
//          LIMIT 1`,
//         [tokenHash]
//     );
//     if (rows.length === 0) return null;
//     const row = rows[0];
//     const valid = row.purpose === expectedPurpose
//         && row.revoked_at === null
//         && new Date(row.expires_at).getTime() > Date.now();
//     return { ...row, valid };
// }

// module.exports = {
//     mintChallenge,
//     consumeChallenge,
//     peekChallenge,
//     hashToken,
// };
