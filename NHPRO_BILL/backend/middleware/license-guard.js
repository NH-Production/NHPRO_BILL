// ============================================================
// NH PRODUCTION — NHPRO_BILL v2.0.0
// middleware/license-guard.js — License Guard Middleware
// Memblokir akses API jika lisensi tidak valid (enforce=true)
// ============================================================
'use strict';

const lic = require('../services/license');

// Path yang EXEMPT — tidak perlu validasi lisensi
const EXEMPT = [
    /^\/api\/auth\//,          // Login/logout admin
    /^\/api\/license\//,       // Manajemen lisensi itu sendiri
    /^\/api\/setting/,         // Setting dasar
    /^\/api\/client\//,        // Portal pelanggan (OTP-based)
    /^\/api\/reseller\/auth/,  // Login reseller
    /^\/webhook\//,            // Callback payment gateway
    /^\/voucher\//,            // Portal voucher publik
    /^\/$|^\/admin$|^\/client$/,// Halaman utama HTML
];

// Cache status lokal — refresh setiap 5 menit (tidak spam DB per request)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let _lastCheck = 0;
let _enforce   = false;  // default: tidak enforce
let _valid     = true;   // default: dianggap valid

module.exports = async function licenseGuard(req, res, next) {
    try {
        // Refresh status setiap CHECK_INTERVAL_MS
        if (Date.now() > _lastCheck + CHECK_INTERVAL_MS) {
            _lastCheck = Date.now();
            const cfg = await lic.getConfig();
            _enforce = cfg.enforce;

            if (_enforce) {
                const result = await lic.validate();
                // Valid jika ok=true, atau masih dalam grace period (offline=true)
                _valid = result.ok || !!result.offline;
            }
        }

        // Jika tidak enforce atau status valid → lanjut
        if (!_enforce || _valid) return next();

        // Cek apakah path ini exempt dari pengecekan lisensi
        if (EXEMPT.some(re => re.test(req.path))) return next();

        // Blokir dengan pesan yang informatif
        return res.status(403).json({
            error:   'Lisensi NHPRO_BILL tidak valid atau belum diaktifkan.',
            license: 'required',
            info:    'Aktifkan lisensi di menu Pengaturan → Lisensi, atau hubungi NH Production.',
        });
    } catch (err) {
        // Jika terjadi error saat cek lisensi → fail open (biarkan lanjut)
        // Ini mencegah NHPRO_BILL mati total jika ada masalah DB sementara
        return next();
    }
};