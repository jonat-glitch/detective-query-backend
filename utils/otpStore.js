const { systemDB } = require('../db');

/**
 * Database-backed OTP helper with automatic expiration and cleanup.
 * Survives backend restarts and multiple instances.
 */
const setOtp = async (key, code, ttlMinutes = 10) => {
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    try {
        await systemDB.query("DELETE FROM otp_verifications WHERE otp_key = ?", [key]);
        await systemDB.query(
            "INSERT INTO otp_verifications (otp_key, otp_code, expires_at) VALUES (?, ?, ?)",
            [key, String(code).trim(), expiresAt]
        );
    } catch (err) {
        console.error("[OTP Store setOtp Error]:", err);
        throw err;
    }
};

const verifyOtp = async (key, code) => {
    try {
        const [rows] = await systemDB.query(
            "SELECT id, otp_code, expires_at FROM otp_verifications WHERE otp_key = ? ORDER BY id DESC LIMIT 1",
            [key]
        );

        if (!rows || rows.length === 0) {
            return { valid: false, reason: 'NOT_FOUND' };
        }

        const record = rows[0];
        const now = Date.now();

        if (now > Number(record.expires_at)) {
            await systemDB.query("DELETE FROM otp_verifications WHERE id = ?", [record.id]);
            return { valid: false, reason: 'EXPIRED' };
        }

        if (record.otp_code !== String(code).trim()) {
            return { valid: false, reason: 'MISMATCH' };
        }

        // Successfully verified — consume OTP
        await systemDB.query("DELETE FROM otp_verifications WHERE id = ?", [record.id]);
        return { valid: true };
    } catch (err) {
        console.error("[OTP Store verifyOtp Error]:", err);
        throw err;
    }
};

module.exports = {
    setOtp,
    verifyOtp
};
