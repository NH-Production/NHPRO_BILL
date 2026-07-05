// ============================================================
// NH PRODUCTION — NHPRO_BILL v2.0.0
// routes/license.js — Manajemen Lisensi (sisi NHPRO_BILL)
// ============================================================
'use strict';

const router = require('express').Router();
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { query } = require('../config/db');
const lic = require('../services/license');

router.use(authMiddleware);

// ── POST /api/license/activate ────────────────────────────────
// Aktivasi lisensi: simpan key ke DB lalu hubungi license server
router.post('/activate', requireAdmin, async (req, res) => {
    let { license_key, license_server_url } = req.body || {};
    license_key        = String(license_key || '').trim().toUpperCase();
    license_server_url = String(license_server_url || '').trim().replace(/\/+$/, '');

    if (!license_key)
        return res.status(400).json({ error: 'Kunci lisensi wajib diisi.' });

    try {
        const hasil = await lic.aktivasi(license_key, license_server_url || null);
        res.json({ ok: true, message: 'Lisensi berhasil diaktivasi!', ...hasil });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ── POST /api/license/deactivate ──────────────────────────────
// Deaktivasi lisensi (melepas HWID binding)
router.post('/deactivate', requireAdmin, async (req, res) => {
    try {
        const hasil = await lic.deaktivasi();
        res.json({ ok: true, message: 'Lisensi berhasil dideaktivasi.', ...hasil });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ── GET /api/license/status ───────────────────────────────────
// Status lisensi untuk panel admin
router.get('/status', async (req, res) => {
    try {
        const force = req.query.reload === '1';
        const s = await lic.status(force);
        res.json(s);
    } catch (e) {
        res.status(500).json({ error: 'Gagal ambil status lisensi: ' + e.message });
    }
});

// ── GET /api/license/hwid ─────────────────────────────────────
// Hardware ID mesin ini (untuk registrasi di License Server)
router.get('/hwid', (req, res) => {
    res.json({ hwid: lic.hwid() });
});

// ── POST /api/license/enforce ─────────────────────────────────
// Toggle enforcement lisensi (superadmin only)
router.post('/enforce', async (req, res) => {
    if (!['superadmin'].includes(req.admin?.role))
        return res.status(403).json({ error: 'Hanya superadmin.' });

    const { aktif } = req.body || {};
    try {
        await query(
            `INSERT INTO setting (kunci, nilai, deskripsi)
             VALUES ('license_enforce', ?, 'Enforce lisensi: 1=ya, 0=tidak')
             ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
            [aktif ? '1' : '0']
        );
        res.json({
            ok: true,
            enforce: !!aktif,
            message: aktif ? 'Lisensi sekarang diwajibkan.' : 'Lisensi tidak lagi diwajibkan.'
        });
    } catch (e) {
        res.status(500).json({ error: 'Gagal update setting: ' + e.message });
    }
});

// ── GET /api/license/server-info ──────────────────────────────
// Cek koneksi ke license server
router.get('/server-info', async (req, res) => {
    const axios = require('axios');
    try {
        const cfg = await lic.getConfig();
        const resp = await axios.get(`${cfg.server}/api/health`, { timeout: 5000 });
        res.json({
            ok:        true,
            reachable: true,
            server:    cfg.server,
            data:      resp.data,
        });
    } catch (e) {
        const cfg = await lic.getConfig().catch(() => ({}));
        res.json({
            ok:        false,
            reachable: false,
            server:    cfg.server || 'unknown',
            error:     e.message,
        });
    }
});

module.exports = router;
