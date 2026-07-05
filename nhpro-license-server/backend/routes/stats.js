// ============================================================
// NH PRODUCTION — LICENSE SERVER
// routes/stats.js — Statistik & Monitoring
// ============================================================
'use strict';

const router = require('express').Router();
const { query, queryOne } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const [
            licenseStats, planStats, activationsTrend,
            validatesTrend, topActive, recentEvents
        ] = await Promise.all([
            // Jumlah lisensi per status
            query(`SELECT status, COUNT(*) AS total FROM licenses GROUP BY status`),
            // Jumlah lisensi per plan
            query(`SELECT plan, COUNT(*) AS total FROM licenses GROUP BY plan`),
            // Aktivasi baru per hari (30 hari terakhir)
            query(`
                SELECT DATE(activated_at) AS tgl, COUNT(*) AS total
                FROM license_activations
                WHERE activated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(activated_at)
                ORDER BY tgl ASC
            `),
            // Validasi per hari (7 hari terakhir)
            query(`
                SELECT DATE(created_at) AS tgl, COUNT(*) AS total
                FROM license_events
                WHERE event = 'validate'
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at)
                ORDER BY tgl ASC
            `),
            // Top 10 lisensi paling sering divalidasi
            query(`
                SELECT l.id, l.license_key, l.customer_name, l.plan,
                       COUNT(e.id) AS validate_count
                FROM license_events e
                JOIN licenses l ON l.id = e.license_id
                WHERE e.event = 'validate'
                  AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY l.id
                ORDER BY validate_count DESC
                LIMIT 10
            `),
            // 20 event terbaru
            query(`
                SELECT e.*, l.customer_name, l.license_key
                FROM license_events e
                LEFT JOIN licenses l ON l.id = e.license_id
                ORDER BY e.created_at DESC
                LIMIT 20
            `),
        ]);

        // Summary stats
        const statusMap = {};
        licenseStats.forEach(r => { statusMap[r.status] = r.total; });

        const summary = {
            total:     Object.values(statusMap).reduce((a, b) => a + Number(b), 0),
            active:    Number(statusMap.active    || 0),
            suspended: Number(statusMap.suspended || 0),
            expired:   Number(statusMap.expired   || 0),
            revoked:   Number(statusMap.revoked   || 0),
        };

        // Validasi hari ini
        const todayValidates = await queryOne(
            `SELECT COUNT(*) AS total FROM license_events WHERE event='validate' AND DATE(created_at)=CURDATE()`
        );
        // Total aktivasi aktif
        const totalActivations = await queryOne(
            `SELECT COUNT(*) AS total FROM license_activations WHERE status='active'`
        );
        // Lisensi expiring dalam 30 hari
        const expiringSoon = await queryOne(
            `SELECT COUNT(*) AS total FROM licenses WHERE status='active' AND expired_at IS NOT NULL AND expired_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`
        );

        res.json({
            ok: true,
            summary: {
                ...summary,
                expiring_soon:    Number(expiringSoon?.total   || 0),
                total_activations: Number(totalActivations?.total || 0),
                validates_today:  Number(todayValidates?.total  || 0),
            },
            by_plan:             planStats,
            activations_trend:   activationsTrend,
            validates_trend:     validatesTrend,
            top_active_licenses: topActive,
            recent_events:       recentEvents,
        });
    } catch (e) {
        console.error('[stats]', e.message);
        res.status(500).json({ error: 'Gagal ambil statistik: ' + e.message });
    }
});

module.exports = router;
