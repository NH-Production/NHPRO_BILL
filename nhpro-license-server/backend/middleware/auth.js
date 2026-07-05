'use strict';

/**
 * NH Production License Server - Auth Middleware
 * Middleware untuk verifikasi JWT pada admin dashboard
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// authMiddleware
// Verifikasi JWT dari header Authorization: Bearer <token>
// Menyimpan payload ke req.user jika valid
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: 'Akses ditolak. Token tidak ditemukan.',
      code: 'NO_TOKEN',
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'Akses ditolak. Format token tidak valid.',
      code: 'INVALID_TOKEN_FORMAT',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        error: 'Sesi telah berakhir. Silakan login kembali.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      ok: false,
      error: 'Token tidak valid.',
      code: 'INVALID_TOKEN',
    });
  }
}

// ============================================================
// requireSuperadmin
// Pastikan user adalah superadmin
// Harus dipasang SETELAH authMiddleware
// ============================================================
function requireSuperadmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: 'Tidak terautentikasi.',
      code: 'UNAUTHENTICATED',
    });
  }

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      ok: false,
      error: 'Akses ditolak. Hanya Superadmin yang dapat melakukan aksi ini.',
      code: 'FORBIDDEN_SUPERADMIN_ONLY',
    });
  }

  next();
}

// ============================================================
// requireOperator
// Pastikan user adalah superadmin ATAU operator
// Harus dipasang SETELAH authMiddleware
// ============================================================
function requireOperator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: 'Tidak terautentikasi.',
      code: 'UNAUTHENTICATED',
    });
  }

  const allowedRoles = ['superadmin', 'operator'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      ok: false,
      error: 'Akses ditolak. Anda tidak memiliki izin yang cukup.',
      code: 'FORBIDDEN',
    });
  }

  next();
}

module.exports = {
  authMiddleware,
  requireSuperadmin,
  requireOperator,
};
