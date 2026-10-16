// src/utils/encryption.js
// AES-256-CBC encryption/decryption utility for sensitive data (email, phone, etc.)
// Uses a 32-byte key derived from an environment variable via SHA-256 hashing.
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * Derive a consistent 32-byte key from the env secret.
 * Falls back to a default key for development ONLY — set ENCRYPTION_SECRET in production.
 */
const getKey = () => {
    const secret = process.env.ENCRYPTION_SECRET || 'trailytics-default-secret-change-me';
    return crypto.createHash('sha256').update(secret).digest(); // 32 bytes
};

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Output format: <hex IV>:<hex ciphertext>
 * @param {string} plaintext
 * @returns {string} encrypted string (iv:ciphertext)
 */
export const encrypt = (plaintext) => {
    if (!plaintext || typeof plaintext !== 'string' || plaintext.trim() === '') {
        return '';
    }

    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt a string that was encrypted with the encrypt() function above.
 * @param {string} encryptedText - Format: <hex IV>:<hex ciphertext>
 * @returns {string} original plaintext
 */
export const decrypt = (encryptedText) => {
    if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
        return encryptedText || '';
    }

    try {
        const key = getKey();
        const [ivHex, cipherHex] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        console.error('[Encryption] Decryption failed:', err.message);
        // Return the original text if decryption fails (e.g., legacy unencrypted data)
        return encryptedText;
    }
};
