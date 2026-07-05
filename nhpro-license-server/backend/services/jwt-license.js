// ============================================================
// NH PRODUCTION — LICENSE SERVER
// services/jwt-license.js — Sign & Verify JWT License Token
// Token ini dikirim ke SimBill client untuk validasi offline
// ============================================================
'use strict';

const jwt = require('jsonwebtoken');

const SECRET  = process.env.LICENSE_JWT_SECRET;
const EXPIRES = process.env.LICENSE_JWT_EXPIRES || '7d';

/**
 * Sign JWT license token untuk dikirim ke SimBill client.
 * SimBill menyimpan token ini dan menggunakannya saat offline (grace period).
 *
 * @param {object} payload - Data lisensi
 * @returns {string} JWT token
 */
function signLicenseToken(payload) {
    if (!SECRET) throw new Error('LICENSE_JWT_SECRET belum dikonfigurasi.');
    return jwt.sign(
        {
            ...payload,
            iss: 'nhpro-license-server',
            aud: 'nhpro-bill',
        },
        SECRET,
        { expiresIn: EXPIRES }
    );
}

/**
 * Verifikasi JWT license token (digunakan saat offline grace period di SimBill).
 *
 * @param {string} token
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function verifyLicenseToken(token) {
    if (!token) return { valid: false, error: 'Token kosong.' };
    if (!SECRET) return { valid: false, error: 'SECRET tidak dikonfigurasi.' };
    try {
        const payload = jwt.verify(token, SECRET, { audience: 'nhpro-bill' });
        return { valid: true, payload };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}

/**
 * Decode token tanpa verifikasi (untuk debug/log saja, jangan gunakan untuk auth).
 */
function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = { signLicenseToken, verifyLicenseToken, decodeToken };
