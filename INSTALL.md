# Panduan Instalasi NHPRO_BILL & License Server

Dokumen ini menjelaskan cara menginstal **NHPRO_BILL** (Aplikasi Utama) dan **nhpro-license-server** (Server Pusat Lisensi) di server VPS (Ubuntu 22.04 / 24.04 atau Debian 11/12).

---

## Opsi 1: Instalasi Otomatis NHPRO_BILL (Sangat Disarankan)

Cara paling cepat untuk menginstal NHPRO_BILL di VPS yang **masih baru (fresh install)**. Skrip ini akan secara otomatis menginstal Node.js, MariaDB, mengkonfigurasi database, serta menjalankan aplikasi.

1. Login ke VPS Anda menggunakan SSH sebagai `root`.
2. Jalankan perintah berikut:
   ```bash
   wget -qO- https://raw.githubusercontent.com/NH-Production/NHPRO_BILL/master/install.sh | sudo bash
   ```
3. Tunggu hingga proses selesai. Installer akan menampilkan kredensial database dan URL akses dashboard (default: `http://IP_VPS:3000`).

---

## Opsi 2: Instalasi Manual NHPRO_BILL

Jika Anda tidak ingin menggunakan instalasi otomatis atau menggunakan VPS yang sudah berisi website lain.

### 1. Persiapan Server
Pastikan VPS Anda sudah terpasang:
- **Node.js** (Minimal versi 20.x)
- **MariaDB** atau **MySQL** (Versi 10.x ke atas)
- **PM2** (Untuk menjaga aplikasi tetap hidup)

### 2. Konfigurasi Database
Buat database dan user baru di MariaDB:
```sql
mysql -u root -p
CREATE DATABASE nhpro_bill_radius CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nhpro_bill'@'localhost' IDENTIFIED BY 'PASSWORD_KUAT_ANDA';
GRANT ALL PRIVILEGES ON nhpro_bill_radius.* TO 'nhpro_bill'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Instalasi Aplikasi
```bash
# Pindah ke direktori /opt
cd /opt

# Clone Repositori
git clone https://github.com/NH-Production/NHPRO_BILL.git nhpro_bill_project
cd nhpro_bill_project/NHPRO_BILL/backend

# Hapus lockfile yang bermasalah (agar tidak error Tencent)
rm -f package-lock.json

# Install dependensi
npm install
```

### 4. Konfigurasi Lingkungan (`.env`)
Buat file konfigurasi `.env`. Jika `.env.example` tersedia, salin file tersebut. Jika tidak, buat manual:
```bash
cp .env.example .env 2>/dev/null || touch .env
nano .env
```
Sesuaikan bagian database dengan kredensial yang dibuat di langkah 2:
```env
DB_NAME=nhpro_bill_radius
DB_USER=nhpro_bill
DB_PASS=PASSWORD_KUAT_ANDA
```
Untuk **JWT_SECRET**, jalankan perintah ini di terminal lain untuk membuat kunci acak, lalu salin hasilnya ke dalam file `.env`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 5. Impor Skema Database
```bash
mysql -u nhpro_bill -p nhpro_bill_radius < ../database/schema.sql
```

### 6. Jalankan Aplikasi
```bash
# Menggunakan PM2 agar aplikasi berjalan di latar belakang
pm2 start server.js --name "nhpro_bill"
pm2 save
pm2 startup
```

Aplikasi NHPRO_BILL sekarang dapat diakses di `http://IP_VPS:3000`. Login dengan `admin` / `admin123`.

---

## Instalasi License Server (`nhpro-license-server`)

License server harus dipasang di server terpisah atau domain terpisah yang menjadi pusat kontrol lisensi Anda (misalnya `license.nhpro.id`).

### Opsi 1: Instalasi Otomatis (Sangat Disarankan)
Gunakan opsi ini jika Anda menggunakan VPS baru yang masih kosong.
```bash
wget -qO- https://raw.githubusercontent.com/NH-Production/NHPRO_BILL/master/install-license-server.sh | sudo bash
```
Tunggu hingga proses selesai. Installer akan memberikan tautan ke dashboard admin Anda beserta informasi rahasia.

### Opsi 2: Instalasi Manual
1. Masuk ke direktori license server:
   ```bash
   cd /opt/nhpro_bill_project/nhpro-license-server/backend
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Buat database `nhpro_license_server` di MariaDB dan impor skemanya:
   ```bash
   mysql -u root -p < ../database/schema.sql
   ```
4. Salin dan edit konfigurasi `.env`:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Pastikan Anda membuat kunci unik untuk `JWT_SECRET` (minimal 32 karakter) dan `LICENSE_JWT_SECRET` (minimal 48 karakter).
5. Jalankan server:
   ```bash
   pm2 start server.js --name "nhpro_license"
   pm2 save
   ```
6. Akses dashboard admin di `http://IP_VPS:7000` (atau gunakan Reverse Proxy Nginx untuk mengaksesnya melalui domain HTTPS). Login menggunakan `nhadmin` / `NHpro2024!`.

---

## Memperbarui Aplikasi

Jika ada pembaruan kode di GitHub, Anda bisa menjalankan perintah berikut untuk melakukan update otomatis pada NHPRO_BILL:
```bash
wget -qO- https://raw.githubusercontent.com/NH-Production/NHPRO_BILL/master/update.sh | sudo bash
```
