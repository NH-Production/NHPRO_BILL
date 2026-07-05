// ============================================================
// NH PRODUCTION — LICENSE SERVER
// routes/auth.js — Admin Authentication Routes
// ============================================================
'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query, queryOne } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// ── POST /api/admin/auth/login ────────────────────────────────
// Login admin dashboard license server
router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Username dan password wajib diisi.' });

    try {
        const user = await queryOne(
            'SELECT id, username, password, email, role, active FROM admin_users WHERE username = ?',
            [String(username).trim()]
        );

        if (!user || !user.active)
            return res.status(401).json({ error: 'Username atau password salah.' });

        const match = await bcrypt.compare(String(password), user.password);
        if (!match)
            return res.status(401).json({ error: 'Username atau password salah.' });

        // Update last_login
        await query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '8h' }
        );

        res.json({
            ok: true,
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });
    } catch (e) {
        console.error('[auth/login]', e.message);
        res.status(500).json({ error: 'Gagal login: ' + e.message });
    }
});

// ── GET /api/admin/auth/me ────────────────────────────────────
// Info user yang sedang login
router.get('/me', authMiddleware, (req, res) => {
    res.json({ ok: true, user: req.admin });
});

// ── POST /api/admin/auth/change-password ─────────────────────
// Ganti password admin
router.post('/change-password', authMiddleware, async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password)
        return res.status(400).json({ error: 'Password lama dan baru wajib diisi.' });
    if (String(new_password).length < 8)
        return res.status(400).json({ error: 'Password baru minimal 8 karakter.' });

    try {
        const user = await queryOne('SELECT id, password FROM admin_users WHERE id = ?', [req.admin.id]);
        const match = await bcrypt.compare(String(current_password), user.password);
        if (!match)
            return res.status(400).json({ error: 'Password lama salah.' });

        const hash = await bcrypt.hash(String(new_password), 12);
        await query('UPDATE admin_users SET password = ? WHERE id = ?', [hash, req.admin.id]);

        res.json({ ok: true, message: 'Password berhasil diubah.' });
    } catch (e) {
        res.status(500).json({ error: 'Gagal ubah password: ' + e.message });
    }
});

module.exports = router;
