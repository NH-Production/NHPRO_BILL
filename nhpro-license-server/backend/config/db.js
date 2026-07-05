'use strict';

/**
 * NH Production License Server - Database Configuration
 * Pool koneksi MySQL/MariaDB dengan helper functions
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// ============================================================
// Buat connection pool
// ============================================================
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || '127.0.0.1',
  port:              parseInt(process.env.DB_PORT || '3306', 10),
  database:          process.env.DB_NAME     || 'nhpro_license_server',
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASS     || '',
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
  charset:           'utf8mb4',
  timezone:          '+07:00',               // WIB - Waktu Indonesia Barat
  enableKeepAlive:   true,
  keepAliveInitialDelay: 30000,
  connectTimeout:    10000,
});

// ============================================================
// Helper: sanitize params - konversi undefined menjadi null
// ============================================================
function sanitizeParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map(p => (p === undefined ? null : p));
}

// ============================================================
// query(sql, params)
// Eksekusi query dan return semua baris hasil
// ============================================================
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, sanitizeParams(params));
    return rows;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    console.error('[DB] SQL:', sql);
    throw err;
  }
}

// ============================================================
// queryOne(sql, params)
// Eksekusi query dan return hanya 1 baris pertama (atau null)
// ============================================================
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// ============================================================
// withTransaction(work)
// Eksekusi function 'work' di dalam transaksi database
// Otomatis COMMIT jika berhasil, ROLLBACK jika ada error
//
// Contoh penggunaan:
//   const result = await withTransaction(async (conn) => {
//     await conn.execute('INSERT INTO ...', [...]);
//     await conn.execute('UPDATE ...', [...]);
//     return { success: true };
//   });
// ============================================================
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Bungkus conn.execute agar params disanitize
    const safeConn = {
      execute: (sql, params = []) => conn.execute(sql, sanitizeParams(params)),
      query:   (sql, params = []) => conn.query(sql, sanitizeParams(params)),
    };

    const result = await work(safeConn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    console.error('[DB] Transaction error, rollback:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

// ============================================================
// Test koneksi saat startup
// ============================================================
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[DB] ✅ Koneksi database berhasil → ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`);
    return true;
  } catch (err) {
    console.error('[DB] ❌ Gagal koneksi database:', err.message);
    console.error('[DB]    Pastikan DB_HOST, DB_USER, DB_PASS, DB_NAME sudah benar di .env');
    return false;
  }
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  pool,
  query,
  queryOne,
  withTransaction,
  sanitizeParams,
  testConnection,
};
