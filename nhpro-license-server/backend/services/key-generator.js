'use strict';

/**
 * NH Production License Server - License Key Generator
 *
 * Format: NHPRO-XXXXXX-XXXXXX-XXXXXX-XXXXXX
 *   - Prefix : NHPRO (tetap)
 *   - Segment: 4 kelompok, masing-masing 6 karakter alphanumeric uppercase
 *   - Total  : 5 + 1 + 6 + 1 + 6 + 1 + 6 + 1 + 6 = 33 karakter
 *
 * Menggunakan crypto.randomBytes() untuk keacakan kriptografis
 *
 * Jalankan via CLI:
 *   node services/key-generator.js          → generate 1 key
 *   node services/key-generator.js 5        → generate 5 key
 *   node services/key-generator.js 10       → generate 10 key
 */

const crypto = require('crypto');

// Karakter yang digunakan - alphanumeric uppercase tanpa karakter ambigu (0,O,I,L,1)
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SEGMENT_LENGTH = 6;
const SEGMENT_COUNT  = 4;
const PREFIX         = 'NHPRO';

// Regex untuk validasi format
const KEY_REGEX = /^NHPRO-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/;

// ============================================================
// generateSegment(length)
// Buat satu segmen karakter acak sepanjang `length`
// ============================================================
function generateSegment(length = SEGMENT_LENGTH) {
  const segment = [];
  const charsetLength = CHARSET.length;

  // Ambil random bytes lebih banyak dari yang dibutuhkan untuk menghindari modulo bias
  // Gunakan rejection sampling
  while (segment.length < length) {
    const bytesNeeded = length - segment.length;
    // Ambil 2x byte untuk buffer rejection sampling
    const randomBytes = crypto.randomBytes(bytesNeeded * 2);

    for (let i = 0; i < randomBytes.length && segment.length < length; i++) {
      const byte = randomBytes[i];
      // Rejection sampling: buang nilai yang menyebabkan modulo bias
      const maxAcceptable = 256 - (256 % charsetLength);
      if (byte < maxAcceptable) {
        segment.push(CHARSET[byte % charsetLength]);
      }
    }
  }

  return segment.join('');
}

// ============================================================
// generateKey()
// Generate satu license key dalam format NHPRO-XXXXXX-XXXXXX-XXXXXX-XXXXXX
// ============================================================
function generateKey() {
  const segments = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    segments.push(generateSegment(SEGMENT_LENGTH));
  }
  return `${PREFIX}-${segments.join('-')}`;
}

// ============================================================
// validateKeyFormat(key)
// Validasi apakah key memiliki format yang benar
// Return: true jika valid, false jika tidak
// ============================================================
function validateKeyFormat(key) {
  if (typeof key !== 'string') return false;
  return KEY_REGEX.test(key.toUpperCase().trim());
}

// ============================================================
// generateBatch(count)
// Generate beberapa key sekaligus
// Return: array of string
// ============================================================
function generateBatch(count = 1) {
  const keys = [];
  const seen = new Set(); // Pastikan tidak ada duplikat dalam batch

  while (keys.length < count) {
    const key = generateKey();
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

// ============================================================
// CLI Support
// Jalankan: node services/key-generator.js [jumlah]
// ============================================================
if (require.main === module) {
  const arg   = process.argv[2];
  const count = arg ? parseInt(arg, 10) : 1;

  if (isNaN(count) || count < 1 || count > 1000) {
    console.error('❌ Jumlah key harus antara 1 dan 1000');
    process.exit(1);
  }

  console.log(`\n🔑 NH Production License Key Generator`);
  console.log(`   Format : NHPRO-XXXXXX-XXXXXX-XXXXXX-XXXXXX`);
  console.log(`   Jumlah : ${count} key\n`);

  const keys = generateBatch(count);
  keys.forEach((key, idx) => {
    console.log(`   ${String(idx + 1).padStart(3, '0')}. ${key}`);
  });

  console.log(`\n✅ Selesai. ${count} key berhasil di-generate.\n`);
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  generateKey,
  generateBatch,
  validateKeyFormat,
  PREFIX,
  CHARSET,
  SEGMENT_LENGTH,
  SEGMENT_COUNT,
};
