// hash.js
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash a password
 */
async function hashPassword(password) {
    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
}

/**
 * Verify password
 */
async function verifyPassword(password, hashedPassword) {
    try {
        const isMatch = await bcrypt.compare(password, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error("Error verifying password:", error);
        throw error;
    }
}

// Example usage
async function run() {
    const plainPassword = "Marspetcare@123#";

    // Hash password
    const hashed = await hashPassword(plainPassword);
    console.log("Hashed Password:", hashed);

    // Verify password
    const isValid = await verifyPassword(plainPassword, hashed);
    console.log("Password Match:", isValid);
}

run();