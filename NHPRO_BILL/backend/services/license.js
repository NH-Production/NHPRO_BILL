// ============================================================
// NH PRODUCTION — NHPRO_BILL v2.0.0
// services/license.js — License Validation Service
// Mengelola validasi lisensi dengan NH Production License Server
// ============================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path menuju kunci publik yang dicocokkan dengan lisensi terenkripsi
const PUBLIC_KEY_PATH = path.join(__dirname, '../config/public_key.pem');

/**
 * Mengambil Hardware ID (Fingerprint) Unik secara otomatis dari Sistem Operasi.
 * Mendukung Linux, Windows, dan macOS.
 */
function getHardwareId() {
    try {
        let machineId = '';
        if (process.platform === 'linux') {
            // Mengambil UUID Produk Motherboard atau Machine-ID bawaan Linux
            machineId = execSync('cat /sys/class/dmi/id/product_uuid || cat /etc/machine-id').toString().trim();
        } else if (process.platform === 'win32') {
            // Mengambil UUID Hardware via WMIC di Windows
            machineId = execSync('wmic csproduct get uuid').toString().replace('UUID', '').trim();
        } else if (process.platform === 'darwin') {
            // Mengambil IOPlatformUUID di macOS
            machineId = execSync("ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { print $4 }'").toString().replace(/"/g, '').trim();
        }
        
        // Melakukan Hashing SHA256 agar format selalu rapi (32 Karakter Utama)
        return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32).toUpperCase();
    } catch (error) {
        console.error('Gagal mengambil Hardware ID Mesin:', error.message);
        return 'UNKNOWN-HARDWARE-ID-ERR';
    }
}

/**
 * Memverifikasi validitas string lisensi yang tersimpan di sistem.
 * @param {string} licenseKey - Kunci lisensi terenkripsi format Base64
 */
function verifyLicense(licenseKey) {
    if (!licenseKey) return { valid: false, reason: 'Lisensi tidak ditemukan di dalam database sistem.' };
    
    try {
        if (!fs.existsSync(PUBLIC_KEY_PATH)) {
            return { valid: false, reason: 'Kunci Publik Pengaman (public_key.pem) hilang dari folder config.' };
        }
        
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        const buffer = Buffer.from(licenseKey, 'base64');
        
        // Dekripsi menggunakan RSA Public Key
        const decrypted = crypto.publicDecrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_PADDING
            },
            buffer
        );
        
        const licenseData = JSON.parse(decrypted.toString('utf8'));
        const currentHwId = getHardwareId();

        // 1. Validasi Integritas Hardware ID
        if (licenseData.hwid !== currentHwId) {
            return { valid: false, reason: 'Kode lisensi ini diterbitkan untuk mesin/hardware server yang berbeda.' };
        }

        // 2. Validasi Masa Aktif
        const now = Date.now();
        if (licenseData.exp !== 0 && licenseData.exp < now) {
            return { valid: false, reason: 'Masa aktif lisensi untuk produk ini telah kedaluwarsa.' };
        }

        return {
            valid: true,
            client: licenseData.client,
            expires: licenseData.exp === 0 ? 'Lifetime (Selamanya)' : new Date(licenseData.exp).toISOString().split('T')[0]
        };
    } catch (error) {
        return { valid: false, reason: 'Format kode lisensi rusak, dimodifikasi, atau tidak valid.' };
    }
}

module.exports = { getHardwareId, verifyLicense };
