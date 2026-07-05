// ============================================================
// NH PRODUCTION — LICENSE SERVER
// routes/license-admin.js — Admin CRUD Lisensi
// Semua endpoint butuh authMiddleware
// ============================================================
'use strict';

const router = require('express').Router();
const dayjs  = require('dayjs');
const { query, queryOne, withTransaction } = require('../config/db');
const { authMiddleware, requireSuperadmin } = require('../middleware/auth');
const { generateKey } = require('../services/key-generator');

router.use(authMiddleware);

// ── Helper log event ─────────────────────────────────────────
async function logEvent(license_id, hwid, event, ip, detail = '') {
    try {
        await query(
            'INSERT INTO license_events (license_id, hwid, event, ip_address, detail) VALUES (?,?,?,?,?)',
            [license_id || null, hwid || null, event, ip || null, String(detail).slice(0, 500)]
        );
    } catch (_) {}
}

// ── GET /api/admin/licenses ───────────────────────────────────
// List lisensi dengan filter & pagination
router.get('/', async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page) || 1);
        const limit  = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const status = req.query.status || '';
        const plan   = req.query.plan   || '';
        const search = req.query.search || '';

        const conditions = [];
        const params     = [];

        if (status) { conditions.push('l.status = ?'); params.push(status); }
        if (plan)   { conditions.push('l.plan = ?');   params.push(plan); }
        if (search) {
            conditions.push('(l.license_key LIKE ? OR l.customer_name LIKE ? OR l.customer_email LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like, like);
        }

        const WHERE = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const [rows, countRow] = await Promise.all([
            query(
                `SELECT l.id, l.license_key, l.customer_name, l.customer_email, l.customer_phone,
                        l.plan, l.status, l.max_pelanggan, l.expired_at, l.issued_at, l.created_at,
                        DATEDIFF(l.expired_at, NOW()) AS days_left,
                        COUNT(CASE WHEN la.status='active' THEN 1 END) AS active_activations
                 FROM licenses l
                 LEFT JOIN license_activations la ON la.license_id = l.id
                 ${WHERE}
                 GROUP BY l.id
                 ORDER BY l.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            ),
            queryOne(`SELECT COUNT(*) AS total FROM licenses l ${WHERE}`, params),
        ]);

        res.json({ ok: true, data: rows, total: countRow.total, page, limit });
    } catch (e) {
        res.status(500).json({ error: 'Gagal ambil lisensi: ' + e.message });
    }
});

// ── POST /api/admin/licenses ──────────────────────────────────
// Buat lisensi baru
router.post('/', requireSuperadmin, async (req, res) => {
    const {
        customer_name, customer_email, customer_phone,
        plan = 'professional', max_pelanggan = 500,
        expired_at, grace_period_days = 3,
        features, notes
    } = req.body || {};

    if (!customer_name)
        return res.status(400).json({ error: 'Nama customer wajib diisi.' });

    const license_key = generateKey();
    const featuresStr = JSON.stringify(features || {
        whatsapp: true, telegram: true, payment_gateway: true,
        acs_tr069: false, reseller: false, multi_admin: false
    });

    try {
        const result = await query(
            `INSERT INTO licenses
             (license_key, customer_name, customer_email, customer_phone, plan, max_pelanggan,
              features, expired_at, grace_period_days, notes, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [
                license_key, customer_name, customer_email || null, customer_phone || null,
                plan, parseInt(max_pelanggan) || 500, featuresStr,
                expired_at || null, parseInt(grace_period_days) || 3,
                notes || null, req.admin.username
            ]
        );

        const newLicense = await queryOne('SELECT * FROM licenses WHERE id = ?', [result.insertId]);
        await logEvent(result.insertId, null, 'create', req.ip, `Created by ${req.admin.username}`);

        res.status(201).json({ ok: true, license: newLicense });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'License key duplikat, coba lagi.' });
        }
        res.status(500).json({ error: 'Gagal buat lisensi: ' + e.message });
    }
});

// ── GET /api/admin/licenses/:id ───────────────────────────────
// Detail lisensi lengkap dengan aktivasi dan event log
router.get('/:id', async (req, res) => {
    try {
        const license = await queryOne('SELECT * FROM licenses WHERE id = ?', [req.params.id]);
        if (!license) return res.status(404).json({ error: 'Lisensi tidak ditemukan.' });

        const [activations, events] = await Promise.all([
            query(
                'SELECT * FROM license_activations WHERE license_id = ? ORDER BY activated_at DESC',
                [license.id]
            ),
            query(
                'SELECT * FROM license_events WHERE license_id = ? ORDER BY created_at DESC LIMIT 50',
                [license.id]
            ),
        ]);

        // Parse features JSON
        if (typeof license.features === 'string') {
            try { license.features = JSON.parse(license.features); } catch (_) { license.features = {}; }
        }

        res.json({ ok: true, license, activations, events });
    } catch (e) {
        res.status(500).json({ error: 'Gagal ambil detail lisensi: ' + e.message });
    }
});

// ── PUT /api/admin/licenses/:id ───────────────────────────────
// Edit lisensi
router.put('/:id', requireSuperadmin, async (req, res) => {
    const { customer_name, customer_email, customer_phone, plan, max_pelanggan, notes, grace_period_days, features } = req.body || {};
    try {
        const existing = await queryOne('SELECT id FROM licenses WHERE id = ?', [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Lisensi tidak ditemukan.' });

        const updates = [];
        const vals    = [];

        if (customer_name)    { updates.push('customer_name=?');    vals.push(customer_name); }
        if (customer_email)   { updates.push('customer_email=?');   vals.push(customer_email); }
        if (customer_phone)   { updates.push('customer_phone=?');   vals.push(customer_phone); }
        if (plan)             { updates.push('plan=?');             vals.push(plan); }
        if (max_pelanggan)    { updates.push('max_pelanggan=?');    vals.push(parseInt(max_pelanggan)); }
        if (notes !== undefined) { updates.push('notes=?');         vals.push(notes); }
        if (grace_period_days){ updates.push('grace_period_days=?'); vals.push(parseInt(grace_period_days)); }
        if (features)         { updates.push('features=?');         vals.push(JSON.stringify(features)); }

        if (!updates.length) return res.status(400).json({ error: 'Tidak ada data untuk diubah.' });

        vals.push(req.params.id);
        await query(`UPDATE licenses SET ${updates.join(',')} WHERE id = ?`, vals);
        await logEvent(req.params.id, null, 'edit', req.ip, `Edited by ${req.admin.username}`);

        const updated = await queryOne('SELECT * FROM licenses WHERE id = ?', [req.params.id]);
        res.json({ ok: true, license: updated });
    } catch (e) {
        res.status(500).json({ error: 'Gagal edit lisensi: ' + e.message });
    }
});

// ── POST /api/admin/licenses/:id/extend ──────────────────────
// Perpanjang lisensi
router.post('/:id/extend', requireSuperadmin, async (req, res) => {
    const { months, expired_at: newExpired } = req.body || {};
    try {
        const license = await queryOne('SELECT * FROM licenses WHERE id = ?', [req.params.id]);
        if (!license) return res.status(404).json({ error: 'Lisensi tidak ditemukan.' });

        let new_expired;
        if (newExpired) {
            new_expired = dayjs(newExpired).format('YYYY-MM-DD HH:mm:ss');
        } else if (months) {
            const base = license.expired_at && dayjs(license.expired_at).isAfter(dayjs())
                ? dayjs(license.expired_at)
                : dayjs();
            new_expired = base.add(parseInt(months), 'month').format('YYYY-MM-DD HH:mm:ss');
        } else {
            return res.status(400).json({ error: 'Isi months atau expired_at.' });
        }

        await query('UPDATE licenses SET expired_at = ?, status = ? WHERE id = ?',
            [new_expired, 'active', license.id]);
        await logEvent(license.id, null, 'extend', req.ip,
            `Extended to ${new_expired} by ${req.admin.username}`);

        res.json({ ok: true, new_expired_at: new_expired });
    } catch (e) {
        res.status(500).json({ error: 'Gagal perpanjang: ' + e.message });
    }
});

// ── POST /api/admin/licenses/:id/revoke ──────────────────────
// Cabut lisensi (permanent)
router.post('/:id/revoke', requireSuperadmin, async (req, res) => {
    const { reason } = req.body || {};
    try {
        await withTransaction(async ({ query: q }) => {
            await q('UPDATE licenses SET status = ? WHERE id = ?', ['revoked', req.params.id]);
            await q('UPDATE license_activations SET status = ?, deactivated_at = NOW() WHERE license_id = ?',
                ['deactivated', req.params.id]);
        });
        await logEvent(req.params.id, null, 'revoke', req.ip,
            `Revoked by ${req.admin.username}. Reason: ${reason || '-'}`);
        res.json({ ok: true, message: 'Lisensi berhasil dicabut.' });
    } catch (e) {
        res.status(500).json({ error: 'Gagal revoke: ' + e.message });
    }
});

// ── POST /api/admin/licenses/:id/suspend ─────────────────────
// Suspend sementara
router.post('/:id/suspend', requireSuperadmin, async (req, res) => {
    try {
        await query('UPDATE licenses SET status = ? WHERE id = ?', ['suspended', req.params.id]);
        await logEvent(req.params.id, null, 'suspend', req.ip, `Suspended by ${req.admin.username}`);
        res.json({ ok: true, message: 'Lisensi berhasil disuspend.' });
    } catch (e) {
        res.status(500).json({ error: 'Gagal suspend: ' + e.message });
    }
});

// ── POST /api/admin/licenses/:id/unsuspend ───────────────────
// Aktifkan kembali dari suspend
router.post('/:id/unsuspend', requireSuperadmin, async (req, res) => {
    try {
        await query('UPDATE licenses SET status = ? WHERE id = ?', ['active', req.params.id]);
        await logEvent(req.params.id, null, 'unsuspend', req.ip, `Unsuspended by ${req.admin.username}`);
        res.json({ ok: true, message: 'Lisensi berhasil diaktifkan kembali.' });
    } catch (e) {
        res.status(500).json({ error: 'Gagal unsuspend: ' + e.message });
    }
});

// ── DELETE /api/admin/activations/:id ────────────────────────
// Hapus aktivasi (reset HWID binding)
router.delete('/activations/:id', requireSuperadmin, async (req, res) => {
    try {
        const act = await queryOne('SELECT * FROM license_activations WHERE id = ?', [req.params.id]);
        if (!act) return res.status(404).json({ error: 'Aktivasi tidak ditemukan.' });

        await query('UPDATE license_activations SET status = ?, deactivated_at = NOW() WHERE id = ?',
            ['deactivated', req.params.id]);
        await logEvent(act.license_id, act.hwid, 'deactivate', req.ip,
            `HWID reset by admin ${req.admin.username}`);

        res.json({ ok: true, message: 'Aktivasi dihapus. Lisensi dapat diaktivasi di perangkat baru.' });
    } catch (e) {
        res.status(500).json({ error: 'Gagal hapus aktivasi: ' + e.message });
    }
});

module.exports = router;
