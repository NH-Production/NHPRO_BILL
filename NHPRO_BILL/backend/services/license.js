// ============================================================
// NH PRODUCTION — NHPRO_BILL v2.0.0
// services/license.js — License Validation Service
// Mengelola validasi lisensi dengan NH Production License Server
// ============================================================
'use strict';

const fs     = require('fs');
const os     = require('os');
const crypto = require('crypto');
const axios  = require('axios');
const { query, queryOne } = require('../config/db');

// ── Konstanta ────────────────────────────────────────────────
const CACHE_TTL_MS    = 6  * 60 * 60 * 1000; // 6 jam
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 jam offline grace
const DEFAULT_SERVER  = 'https://license.nhpro.id';
const APP_NAME        = 'nhpro_bill';

// ── State internal ───────────────────────────────────────────
let _hwid       = null;
let _memCache   = null; // cache memory (hilang saat restart)
let _hbTimer    = null; // timer heartbeat

// ============================================================
// hwid() — Hardware ID dari mesin server
// SHA256 dari machine-id + MAC address + hostname
// ============================================================
function hwid() {
    if (_hwid) return _hwid;

    let machineId = '';
    const machineIdFiles = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    for (const f of machineIdFiles) {
        try { machineId = fs.readFileSync(f, 'utf8').trim(); break; } catch (_) {}
    }

    let macAddr = '';
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                macAddr = iface.mac;
                break;
            }
        }
        if (macAddr) break;
    }

    const raw  = `${machineId}|${macAddr}|${os.hostname()}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    _hwid = [
        hash.slice(0,  8),
        hash.slice(8,  12),
        hash.slice(12, 16),
        hash.slice(16, 20),
        hash.slice(20, 32),
    ].join('-');

    return _hwid;
}

// ============================================================
// getConfig() — Baca konfigurasi lisensi dari DB
// ============================================================
async function getConfig() {
    try {
        const rows = await query(
            `SELECT kunci, nilai FROM setting
             WHERE kunci IN ('license_key','license_server_url','license_enforce')`
        ).catch(() => []);

        const cfg = {};
        rows.forEach(r => { cfg[r.kunci] = r.nilai; });

        return {
            key:     (cfg.license_key || '').trim(),
            server:  (cfg.license_server_url || '').trim().replace(/\/+$/, '') || DEFAULT_SERVER,
            enforce: cfg.license_enforce === '1',
        };
    } catch (_) {
        return { key: '', server: DEFAULT_SERVER, enforce: false };
    }
}

// ============================================================
// saveToCache() — Simpan hasil validasi ke DB (setting)
// ============================================================
async function saveToCache(result) {
    try {
        await query(
            `INSERT INTO setting (kunci, nilai, deskripsi)
             VALUES ('license_cache', ?, 'Cache validasi lisensi')
             ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
            [JSON.stringify({ ok: result.ok, data: result.data, ts: result.ts })]
        );
    } catch (_) {}
}

// ============================================================
// getFromCache() — Baca cache dari DB
// ============================================================
async function getFromCache() {
    try {
        const row = await queryOne(`SELECT nilai FROM setting WHERE kunci='license_cache'`);
        if (row?.nilai) return JSON.parse(row.nilai);
    } catch (_) {}
    return null;
}

// ============================================================
// isCacheValid(cache) — Cek apakah cache masih berlaku
// ============================================================
function isCacheValid(cache) {
    if (!cache?.ok) return false;
    // Cek TTL cache (6 jam)
    if (!cache.ts || Date.now() - cache.ts > CACHE_TTL_MS) return false;
    // Cek expired_at lisensi
    if (cache.data?.expired_at) {
        const expMs = new Date(cache.data.expired_at).getTime();
        if (!isNaN(expMs) && expMs < Date.now()) return false;
    }
    return true;
}

// ============================================================
// isCacheInGrace(cache) — Cek apakah cache masih dalam grace period
// ============================================================
function isCacheInGrace(cache) {
    if (!cache?.ok || !cache.ts) return false;
    // Cek expired_at lisensi masih valid
    if (cache.data?.expired_at) {
        const expMs = new Date(cache.data.expired_at).getTime();
        if (!isNaN(expMs) && expMs < Date.now()) return false;
    }
    // Cek apakah masih dalam GRACE_PERIOD_MS dari ts terakhir sukses
    return (Date.now() - cache.ts) < GRACE_PERIOD_MS;
}

// ============================================================
// validateWithServer(config) — Panggil license server
// ============================================================
async function validateWithServer(config) {
    try {
        const resp = await axios.post(
            `${config.server}/api/validate`,
            {
                license_key:  config.key,
                hwid:         hwid(),
                app_name:     APP_NAME,
                app_version:  process.env.APP_VERSION || '2.0.0',
            },
            { timeout: 8000, validateStatus: () => true }
        );

        if (resp.status === 200 && resp.data?.ok) {
            const result = { ok: true, data: resp.data, ts: Date.now() };
            _memCache = result;
            await saveToCache(result);
            return result;
        }

        // Server merespons tapi lisensi tidak valid
        return {
            ok:   false,
            data: { status: resp.data?.code || 'invalid', pesan: resp.data?.error || 'Lisensi tidak valid.' },
            ts:   Date.now(),
        };
    } catch (_) {
        // Timeout atau tidak bisa reach server
        return null;
    }
}

// ============================================================
// validate(force) — Fungsi validasi utama
// ============================================================
async function validate(force = false) {
    const config = await getConfig();

    // Tidak ada key → tidak perlu validasi
    if (!config.key) {
        return {
            ok:     false,
            status: 'not_configured',
            pesan:  'Kunci lisensi belum dikonfigurasi.',
        };
    }

    // Gunakan memory cache jika valid dan tidak force
    if (!force && _memCache && isCacheValid(_memCache)) {
        return _memCache;
    }

    // Load dari DB jika memory cache kosong
    if (!_memCache) {
        const dbCache = await getFromCache();
        if (dbCache) _memCache = dbCache;
    }

    // Gunakan DB cache jika valid dan tidak force
    if (!force && _memCache && isCacheValid(_memCache)) {
        return _memCache;
    }

    // Coba validasi ke server
    const serverResult = await validateWithServer(config);

    if (serverResult) {
        // Server berhasil direach
        return serverResult;
    }

    // Server tidak bisa direach (offline)
    // Cek grace period dari cache terakhir
    const fallback = _memCache || (await getFromCache());
    if (isCacheInGrace(fallback)) {
        return { ...fallback, offline: true };
    }

    // Grace period habis
    return {
        ok:     false,
        data:   { status: 'offline', pesan: 'Tidak dapat terhubung ke License Server. Grace period habis.' },
        ts:     Date.now(),
        offline: true,
    };
}

// ============================================================
// status(force) — Untuk frontend admin panel
// ============================================================
async function status(force = false) {
    const config = await getConfig();
    const result = await validate(force);

    let days_left = null;
    if (result.data?.expired_at) {
        const ms = new Date(result.data.expired_at).getTime() - Date.now();
        days_left = Math.max(0, Math.ceil(ms / 86400000));
    }

    return {
        valid:              result.ok,
        offline:            !!result.offline,
        enforce:            config.enforce,
        license_server_url: config.server,
        hwid:               hwid(),
        status:             result.data?.status || (result.ok ? 'active' : 'invalid'),
        pesan:              result.data?.pesan || result.data?.error || '',
        plan:               result.data?.plan || null,
        max_pelanggan:      result.data?.max_pelanggan || null,
        features:           result.data?.features || null,
        expired_at:         result.data?.expired_at || null,
        days_left,
    };
}

// ============================================================
// aktivasi(license_key, license_server_url) — Aktivasi awal
// ============================================================
async function aktivasi(license_key, license_server_url) {
    const server = (license_server_url || '').replace(/\/+$/, '') || DEFAULT_SERVER;

    const resp = await axios.post(
        `${server}/api/activate`,
        {
            license_key,
            hwid:         hwid(),
            app_name:     APP_NAME,
            app_url:      process.env.APP_URL || '',
            app_version:  process.env.APP_VERSION || '2.0.0',
            hostname:     os.hostname(),
        },
        { timeout: 10000, validateStatus: () => true }
    );

    if (!resp.data?.ok) {
        throw new Error(resp.data?.error || `Aktivasi gagal (HTTP ${resp.status})`);
    }

    // Simpan ke setting DB
    const ups = `INSERT INTO setting (kunci,nilai,deskripsi) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nilai=VALUES(nilai)`;
    await query(ups, ['license_key',        license_key, 'Kunci lisensi NH Production']);
    await query(ups, ['license_server_url', server,      'URL License Server']);

    // Invalidate cache
    _memCache = null;

    return resp.data;
}

// ============================================================
// deaktivasi() — Lepas binding HWID
// ============================================================
async function deaktivasi() {
    const config = await getConfig();
    if (!config.key) throw new Error('Tidak ada kunci lisensi untuk dideaktivasi.');

    const resp = await axios.post(
        `${config.server}/api/deactivate`,
        { license_key: config.key, hwid: hwid() },
        { timeout: 8000, validateStatus: () => true }
    );

    // Bersihkan cache lokal
    _memCache = null;
    await query(`DELETE FROM setting WHERE kunci='license_cache'`).catch(() => {});

    return resp.data;
}

// ============================================================
// mulaiHeartbeat() — Revalidasi periodik
// ============================================================
function mulaiHeartbeat(intervalMs = CACHE_TTL_MS) {
    if (_hbTimer) return; // sudah berjalan

    const cek = async () => {
        try {
            const config = await getConfig();
            if (config.key) await validate(true);
        } catch (_) {}
    };

    // Jalankan pertama kali setelah 30 detik
    const t = setTimeout(cek, 30_000);
    if (t.unref) t.unref();

    // Kemudian setiap intervalMs
    _hbTimer = setInterval(cek, intervalMs);
    if (_hbTimer.unref) _hbTimer.unref();
}

// ============================================================
// Exports
// ============================================================
module.exports = {
    hwid,
    getConfig,
    validate,
    status,
    aktivasi,
    deaktivasi,
    mulaiHeartbeat,
    GRACE_PERIOD_MS,
    CACHE_TTL_MS,
};