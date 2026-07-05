// ============================================================
// NH PRODUCTION — LICENSE SERVER
// routes/validate.js — Public API untuk SimBill Client
// Endpoint ini diakses oleh SimBill untuk aktivasi & validasi
// ============================================================
'use strict';

const router = require('express').Router();
const dayjs  = require('dayjs');
const { query, queryOne, withTransaction } = require('../config/db');
const { signLicenseToken } = require('../services/jwt-license');
const { validateKeyFormat } = require('../services/key-generator');

// ── Helper: log event ────────────────────────────────────────
async function logEvent(license_id, hwid, event, ip_address, detail = '') {
    try {
        await query(
            'INSERT INTO license_events (license_id, hwid, event, ip_address, detail) VALUES (?,?,?,?,?)',
            [license_id || null, hwid || null, event, ip_address || null, String(detail).slice(0, 500)]
        );
    } catch (_) {}
}

// ── Helper: ambil IP request ─────────────────────────────────
function getIP(req) {
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

// ── Helper: build license token payload ──────────────────────
function buildTokenPayload(license, activation) {
    return {
        license_id:    license.id,
        license_key:   license.license_key,
        plan:          license.plan,
        max_pelanggan: license.max_pelanggan,
        features:      typeof license.features === 'string'
                           ? JSON.parse(license.features || '{}')
                           : (license.features || {}),
        expired_at:    license.expired_at ? dayjs(license.expired_at).toISOString() : null,
        hwid:          activation?.hwid || null,
        issued_at:     new Date().toISOString(),
    };
}

// ── GET /api/health ───────────────────────────────────────────
// Health check — tanpa auth
router.get('/health', (req, res) => {
    res.json({
        status:  'ok',
        server:  'NH Production License Server',
        version: '1.0.0',
        time:    new Date().toISOString(),
    });
});

// ── POST /api/activate ────────────────────────────────────────
// Aktivasi awal lisensi — mengikat HWID ke license key
router.post('/activate', async (req, res) => {
    const { license_key, hwid, app_name, app_url, app_version, hostname } = req.body || {};
    const ip = getIP(req);

    if (!license_key || !hwid)
        return res.status(400).json({ ok: false, error: 'license_key dan hwid wajib diisi.', code: 'INVALID_REQUEST' });

    if (!validateKeyFormat(license_key))
        return res.status(400).json({ ok: false, error: 'Format license key tidak valid.', code: 'INVALID_FORMAT' });

    try {
        const license = await queryOne('SELECT * FROM licenses WHERE license_key = ?', [license_key.toUpperCase()]);

        if (!license)
            return res.status(404).json({ ok: false, error: 'License key tidak ditemukan.', code: 'KEY_NOT_FOUND' });

        if (license.status === 'revoked')
            return res.status(403).json({ ok: false, error: 'Lisensi telah dicabut.', code: 'REVOKED' });

        if (license.status === 'suspended')
            return res.status(403).json({ ok: false, error: 'Lisensi sedang disuspend.', code: 'SUSPENDED' });

        if (license.status === 'expired')
            return res.status(403).json({ ok: false, error: 'Lisensi sudah kadaluarsa.', code: 'EXPIRED' });

        // Cek apakah sudah expired berdasarkan tanggal
        if (license.expired_at && dayjs().isAfter(dayjs(license.expired_at).add(license.grace_period_days, 'day')))
            return res.status(403).json({ ok: false, error: 'Lisensi sudah kadaluarsa.', code: 'EXPIRED' });

        // Cek apakah sudah ada aktivasi di HWID lain (1 lisensi = 1 mesin)
        const existingActive = await queryOne(
            'SELECT * FROM license_activations WHERE license_id = ? AND status = ?',
            [license.id, 'active']
        );

        if (existingActive) {
            if (existingActive.hwid === hwid) {
                // HWID sama — update last_seen dan return token (re-activation)
                await query(
                    'UPDATE license_activations SET last_seen = NOW(), last_ip = ?, app_version = ?, app_url = ? WHERE id = ?',
                    [ip, app_version || null, app_url || null, existingActive.id]
                );
                await logEvent(license.id, hwid, 'activate', ip, 'Re-activation (same HWID)');
                const token = signLicenseToken(buildTokenPayload(license, existingActive));
                return res.json({
                    ok: true,
                    message: 'Lisensi berhasil diaktivasi (re-activation).',
                    license_token: token,
                    plan: license.plan,
                    max_pelanggan: license.max_pelanggan,
                    features: buildTokenPayload(license, existingActive).features,
                    expired_at: license.expired_at,
                });
            } else {
                // HWID berbeda — tolak
                await logEvent(license.id, hwid, 'validate_fail', ip, `Activation rejected: already bound to another HWID`);
                return res.status(409).json({
                    ok: false,
                    error: 'Lisensi ini sudah aktif di perangkat lain. Hubungi NH Production untuk memindahkan lisensi.',
                    code: 'ALREADY_ACTIVATED',
                });
            }
        }

        // Aktivasi baru
        const result = await query(
            `INSERT INTO license_activations
             (license_id, hwid, app_name, app_url, app_version, hostname, ip_address, last_seen, last_ip)
             VALUES (?,?,?,?,?,?,?,NOW(),?)`,
            [license.id, hwid, app_name || 'nhpro_bill', app_url || null, app_version || null, hostname || null, ip, ip]
        );

        await logEvent(license.id, hwid, 'activate', ip, `App: ${app_name || 'nhpro_bill'} | URL: ${app_url || '-'}`);

        const activation = { id: result.insertId, hwid };
        const token = signLicenseToken(buildTokenPayload(license, activation));

        res.json({
            ok: true,
            message: 'Lisensi berhasil diaktivasi!',
            license_token: token,
            plan: license.plan,
            max_pelanggan: license.max_pelanggan,
            features: buildTokenPayload(license, activation).features,
            expired_at: license.expired_at,
        });

    } catch (e) {
        console.error('[validate/activate]', e.message);
        res.status(500).json({ ok: false, error: 'Internal server error.', code: 'SERVER_ERROR' });
    }
});

// ── POST /api/validate ────────────────────────────────────────
// Validasi periodik dari SimBill (setiap 6 jam)
router.post('/validate', async (req, res) => {
    const { license_key, hwid, app_version } = req.body || {};
    const ip = getIP(req);

    if (!license_key || !hwid)
        return res.status(400).json({ ok: false, error: 'license_key dan hwid wajib diisi.', code: 'INVALID_REQUEST' });

    try {
        const license = await queryOne('SELECT * FROM licenses WHERE license_key = ?', [license_key.toUpperCase()]);

        if (!license)
            return res.status(404).json({ ok: false, error: 'License key tidak ditemukan.', code: 'KEY_NOT_FOUND' });

        if (['revoked', 'suspended'].includes(license.status))
            return res.status(403).json({ ok: false, error: `Lisensi ${license.status}.`, code: license.status.toUpperCase() });

        // Cek expired (dengan grace period)
        const expiredHard = license.expired_at &&
            dayjs().isAfter(dayjs(license.expired_at).add(license.grace_period_days, 'day'));
        if (expiredHard)
            return res.status(403).json({ ok: false, error: 'Lisensi sudah kadaluarsa.', code: 'EXPIRED' });

        // Cek HWID match
        const activation = await queryOne(
            'SELECT * FROM license_activations WHERE license_id = ? AND hwid = ? AND status = ?',
            [license.id, hwid, 'active']
        );

        if (!activation)
            return res.status(403).json({
                ok: false,
                error: 'HWID tidak terdaftar untuk lisensi ini. Lakukan aktivasi ulang.',
                code: 'HWID_MISMATCH'
            });

        // Update last_seen
        await query(
            'UPDATE license_activations SET last_seen = NOW(), last_ip = ?, app_version = ? WHERE id = ?',
            [ip, app_version || activation.app_version, activation.id]
        );

        await logEvent(license.id, hwid, 'validate', ip, `v${app_version || '-'}`);

        // Hitung hari tersisa
        const days_left = license.expired_at
            ? Math.max(0, dayjs(license.expired_at).diff(dayjs(), 'day'))
            : null;

        const token = signLicenseToken(buildTokenPayload(license, activation));

        res.json({
            ok: true,
            license_token: token,
            plan: license.plan,
            max_pelanggan: license.max_pelanggan,
            features: buildTokenPayload(license, activation).features,
            expired_at: license.expired_at,
            days_left,
            status: license.status,
        });

    } catch (e) {
        console.error('[validate/validate]', e.message);
        res.status(500).json({ ok: false, error: 'Internal server error.', code: 'SERVER_ERROR' });
    }
});

// ── POST /api/deactivate ──────────────────────────────────────
// Deaktivasi lisensi (SimBill melepas binding HWID)
router.post('/deactivate', async (req, res) => {
    const { license_key, hwid } = req.body || {};
    const ip = getIP(req);

    if (!license_key || !hwid)
        return res.status(400).json({ ok: false, error: 'license_key dan hwid wajib diisi.' });

    try {
        const license = await queryOne('SELECT id FROM licenses WHERE license_key = ?', [license_key.toUpperCase()]);
        if (!license)
            return res.status(404).json({ ok: false, error: 'License key tidak ditemukan.' });

        await query(
            'UPDATE license_activations SET status = ?, deactivated_at = NOW() WHERE license_id = ? AND hwid = ?',
            ['deactivated', license.id, hwid]
        );
        await logEvent(license.id, hwid, 'deactivate', ip, 'Self-deactivated by SimBill');

        res.json({ ok: true, message: 'Lisensi berhasil dideaktivasi.' });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'Gagal deaktivasi: ' + e.message });
    }
});

module.exports = router;
