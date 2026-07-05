// ============================================================
// NH PRODUCTION — LICENSE SERVER v1.0.0
// server.js — Entry Point Utama
// ============================================================
'use strict';

require('dotenv').config();

// ── Guard: validasi environment critical ─────────────────────
(function validateEnv() {
    const jwtSecret     = process.env.JWT_SECRET;
    const licenseSecret = process.env.LICENSE_JWT_SECRET;
    const placeholder1  = 'ganti_dengan_secret_key_yang_sangat_panjang_dan_acak_min32char';
    const placeholder2  = 'ganti_dengan_secret_license_yang_berbeda_dan_sangat_panjang_min48char';

    if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === placeholder1) {
        console.error('❌ JWT_SECRET tidak aman. Set JWT_SECRET di .env minimal 32 karakter acak.');
        process.exit(1);
    }
    if (!licenseSecret || licenseSecret.length < 32 || licenseSecret === placeholder2) {
        console.error('❌ LICENSE_JWT_SECRET tidak aman. Set LICENSE_JWT_SECRET minimal 48 karakter acak.');
        process.exit(1);
    }
})();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();

// ── Trust proxy (jika di belakang Nginx) ─────────────────────
app.set('trust proxy', 'loopback');

// ── Security middleware ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// CORS config
const corsOrigins = process.env.CORS_ORIGINS || '*';
const corsOptions = corsOrigins === '*'
    ? { origin: '*' }
    : { origin: corsOrigins.split(',').map(o => o.trim()), credentials: true };
app.use(cors(corsOptions));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate limiting ─────────────────────────────────────────────
// Global
app.use(rateLimit({
    validate:  { xForwardedForHeader: false },
    windowMs:  15 * 60 * 1000,
    max:       500,
    message:   { error: 'Terlalu banyak permintaan, coba lagi nanti.' },
}));

// Endpoint validasi/aktivasi: lebih longgar (SimBill call periodik)
app.use(['/api/validate', '/api/activate'], rateLimit({
    validate:  { xForwardedForHeader: false },
    windowMs:  15 * 60 * 1000,
    max:       parseInt(process.env.RATE_LIMIT_VALIDATE) || 100,
    message:   { error: 'Rate limit validasi terlampaui.' },
}));

// Login admin: ketat
app.use('/api/admin/auth/login', rateLimit({
    validate:  { xForwardedForHeader: false },
    windowMs:  15 * 60 * 1000,
    max:       parseInt(process.env.RATE_LIMIT_LOGIN) || 10,
    message:   { error: 'Terlalu banyak percobaan login.' },
}));

// ── Static frontend ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Routes ────────────────────────────────────────────────────
// Public API (diakses SimBill client)
app.use('/api', require('./routes/validate'));

// Admin API (butuh JWT)
app.use('/api/admin/auth',     require('./routes/auth'));
app.use('/api/admin/licenses', require('./routes/license-admin'));
app.use('/api/admin/stats',    require('./routes/stats'));

// ── Serve dashboard SPA ───────────────────────────────────────
app.get('*', (req, res) => {
    // Hanya serve dashboard.html untuk non-API routes
    if (!req.path.startsWith('/api/')) {
        return res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
    }
    res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error.' });
});

// ── Start server ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 7000;
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   NH Production — License Server v1.0.0   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`  Port    : ${PORT}`);
    console.log(`  Env     : ${process.env.NODE_ENV || 'development'}`);
    console.log(`  URL     : ${process.env.APP_URL || `http://localhost:${PORT}`}`);
    console.log(`  CORS    : ${process.env.CORS_ORIGINS || '*'}`);
    console.log('');
    console.log('  Endpoints:');
    console.log('    POST /api/activate    — Aktivasi lisensi');
    console.log('    POST /api/validate    — Validasi lisensi');
    console.log('    POST /api/deactivate  — Deaktivasi lisensi');
    console.log('    GET  /api/health      — Health check');
    console.log('    GET  /                — Admin dashboard');
    console.log('');
});
