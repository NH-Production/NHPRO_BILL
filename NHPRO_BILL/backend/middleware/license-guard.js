// ============================================================
// NH PRODUCTION — NHPRO_BILL v2.0.0
// middleware/license-guard.js — License Guard Middleware
// Memblokir akses API jika lisensi tidak valid (enforce=true)
// ============================================================
const { verifyLicense, getHardwareId } = require('../services/license');
const db = require('../config/db'); // Pastikan path ini sesuai dengan koneksi database utama Anda

/**
 * Middleware Proteksi Utama NHPROBILL.
 * Menghadang seluruh request API jika lisensi tidak valid atau telah habis.
 */
async function licenseGuard(req, res, next) {
    // Berikan Bypass URL khusus untuk API Cek Status Lisensi dan Halaman Aktivasi
    if (req.path.includes('/api/license/status') || req.path.includes('/api/license/activate')) {
        return next();
    }

    try {
        // Mengambil kode lisensi dari tabel konfigurasi/settings di database
        // Silakan sesuaikan nama tabel dan kolom dengan database asli NHPROBILL Anda
        const [rows] = await db.query("SELECT license_key FROM settings WHERE id = 1 LIMIT 1");
        const licenseKey = rows && rows[0] ? rows[0].license_key : null;

        // Jalankan verifikasi enkripsi RSA + HWID
        const check = verifyLicense(licenseKey);

        if (!check.valid) {
            return res.status(403).json({
                status: 'error',
                code: 'LICENSE_INVALID_OR_EXPIRED',
                message: check.reason,
                hardware_id: getHardwareId(),
                instruction: 'Silakan salin Hardware ID di atas dan hubungi developer resmi untuk mendapatkan lisensi baru.'
            });
        }

        // Jika valid, teruskan request ke controller berikutnya
        req.licenseInfo = check;
        next();
    } catch (error) {
        // Jika database bermasalah atau belum termigrasi, kunci aplikasi demi keamanan
        return res.status(500).json({
            status: 'error',
            message: 'Sistem Pengunci Gagal Membaca Konfigurasi Lisensi.',
            error: error.message
        });
    }
}

module.exports = licenseGuard;
