#!/bin/bash
# ============================================================
# NH PRODUCTION - NHPRO_BILL Updater
# ============================================================

set -e

echo "================================================"
echo "        UPDATE NHPRO_BILL (NH PRODUCTION)       "
echo "================================================"

# Periksa apakah dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo "Harap jalankan sebagai root (sudo su)"
  exit 1
fi

APP_DIR="/opt/nhpro_bill"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: Direktori $APP_DIR tidak ditemukan."
  echo "Anda belum menginstal NHPRO_BILL atau aplikasi ada di direktori lain."
  exit 1
fi

cd $APP_DIR

echo "[1/4] Mengambil pembaruan dari GitHub..."
git stash
git pull origin master

echo "[2/4] Memperbarui dependensi (Backend)..."
cd NHPRO_BILL/backend
rm -f package-lock.json
npm install

echo "[3/4] Melakukan restart aplikasi dengan PM2..."
pm2 restart nhpro_bill

echo "[4/4] Memperbarui dependensi (License Server)..."
cd $APP_DIR/nhpro-license-server/backend
if [ -f "package.json" ]; then
  rm -f package-lock.json
  npm install
  pm2 restart nhpro_license || true
fi

echo "================================================"
echo "         UPDATE BERHASIL DISELESAIKAN           "
echo "================================================"
echo "NH Production - Copyright 2026"
