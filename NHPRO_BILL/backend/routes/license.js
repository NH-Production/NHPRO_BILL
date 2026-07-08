// ============================================================
// NH PRODUCTION — NHPRO_BILL v2.0.0
// routes/license.js — Manajemen Lisensi (sisi NHPRO_BILL)
// ============================================================
const express = require('express');
const router = express.Router();
const { getHardwareId, verifyLicense } = require('../services/license');
const db = require('../config/db'); // Sesuaikan dengan instance DB Anda

/**
 * @route   GET /api/license/status
 * @desc    Mengecek status lisensi saat ini dan mengambil Hardware ID server client
 */
router.get('/status', async (req, res) => {
    try {
        const hwid = getHardwareId();
        const [rows] = await db.query("SELECT license_key FROM settings WHERE id = 1 LIMIT 1");
        const licenseKey = rows && rows[0] ? rows[0].license_key : null;
        
        const check = verifyLicense(licenseKey);
        
        return res.json({
            status: 'success',
            hardware_id: hwid,
            has_license: !!licenseKey,
            is_valid: check.valid,
            reason: check.valid ? null : check.reason,
            details: check.valid ? { client: check.client, expires: check.expires } : null
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route   POST /api/license/activate
 * @desc    Menginput kode lisensi baru untuk mengaktifkan sistem NHPROBILL
 */
router.post('/activate', async (req, res) => {
    const { license_key } = req.body;
    
    if (!license_key) {
        return res.status(400).json({ status: 'error', message: 'Parameter license_key wajib diisi.' });
    }

    // Lakukan validasi instan sebelum disimpan ke DB
    const check = verifyLicense(license_key);
    if (!check.valid) {
        return res.status(400).json({ status: 'error', message: `Aktivasi Ditolak: ${check.reason}` });
    }

    try {
        // Simpan kode lisensi baru ke database settings
        await db.query("UPDATE settings SET license_key = ? WHERE id = 1", [license_key]);
        
        return res.json({
            status: 'success',
            message: 'Sistem NHPROBILL Berhasil Diaktifkan! Terima kasih telah menggunakan produk resmi.',
            details: {
                client: check.client,
                expires: check.expires
            }
        });
    } catch (error) {
        return res.status(500).json({ 
            status: 'error', 
            message: 'Gagal menulis lisensi ke database: ' + error.message 
        });
    }
});

module.exports = router;
