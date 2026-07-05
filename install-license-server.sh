#!/bin/bash
# ============================================================
# NH PRODUCTION - License Server Installer
# ============================================================

set -e

echo "================================================"
echo "    MENGINSTALL LICENSE SERVER (NH PRODUCTION)  "
echo "================================================"

# Periksa apakah dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo "Harap jalankan sebagai root (sudo su)"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# Update system
echo "[1/7] Memperbarui sistem..."
apt-get update -y
apt-get install -y curl wget git unzip curl build-essential software-properties-common

# Install MariaDB
echo "[2/7] Menginstal MariaDB Server..."
apt-get install -y mariadb-server mariadb-client
systemctl enable mariadb
systemctl start mariadb

# Setup Database
echo "[3/7] Mengkonfigurasi Database License Server..."
DB_NAME="nhpro_license_server"
DB_USER="nhpro_license"
DB_PASS=${ADMIN_PASS:-$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 12 | head -n 1)}

mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# Install Node.js
echo "[4/7] Menginstal Node.js v20 & PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# Clone Repositori
echo "[5/7] Mengunduh kode aplikasi..."
APP_DIR="/opt/nhpro_license_server"
if [ -d "$APP_DIR" ]; then
  echo "Direktori $APP_DIR sudah ada. Mem-backup ke ${APP_DIR}_backup_$(date +%s)"
  mv $APP_DIR "${APP_DIR}_backup_$(date +%s)"
fi

# Clone keseluruhan repository
git clone https://github.com/NH-Production/NHPRO_BILL.git $APP_DIR

# Pindah ke backend license server
cd $APP_DIR/nhpro-license-server/backend
rm -f package-lock.json

echo "[6/7] Menginstal dependensi backend License Server..."
npm install

# Setup Env & Impor Database
echo "[7/7] Mengkonfigurasi dan menjalankan server..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
LICENSE_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

if [ -f ".env.example" ]; then
  cp .env.example .env
  sed -i "s/DB_NAME=.*/DB_NAME=${DB_NAME}/" .env
  sed -i "s/DB_USER=.*/DB_USER=${DB_USER}/" .env
  sed -i "s/DB_PASS=.*/DB_PASS=${DB_PASS}/" .env
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
  sed -i "s/LICENSE_JWT_SECRET=.*/LICENSE_JWT_SECRET=${LICENSE_JWT_SECRET}/" .env
else
  echo "PORT=7000" > .env
  echo "NODE_ENV=production" >> .env
  echo "DB_HOST=127.0.0.1" >> .env
  echo "DB_PORT=3306" >> .env
  echo "DB_NAME=${DB_NAME}" >> .env
  echo "DB_USER=${DB_USER}" >> .env
  echo "DB_PASS=${DB_PASS}" >> .env
  echo "JWT_SECRET=${JWT_SECRET}" >> .env
  echo "LICENSE_JWT_SECRET=${LICENSE_JWT_SECRET}" >> .env
fi

# Impor skema database
mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < ../database/schema.sql

# Jalankan dengan PM2
pm2 start server.js --name "nhpro_license"
pm2 save
pm2 startup | grep -v "PM2" | bash || true

echo "================================================"
echo "            INSTALASI SELESAI                   "
echo "================================================"
echo "Dashboard License Server Anda dapat diakses di:"
echo "http://$(curl -s ifconfig.me):7000"
echo ""
echo "Username default : nhadmin"
echo "Password default : NHpro2024!"
echo "------------------------------------------------"
echo "INFO DATABASE:"
echo "User: ${DB_USER}"
echo "Pass: ${DB_PASS}"
echo "================================================"
echo "Harap segera login ke dashboard dan ubah password!"
echo "NH Production - Copyright 2026"
