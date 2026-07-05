# NH Production — License Server

<p align="center">
  <b>Server Manajemen Lisensi untuk NHPRO_BILL</b><br>
  Node.js + Express + MariaDB · JWT · Admin Dashboard
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versi-v1.0.0-6366f1">
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933">
  <img src="https://img.shields.io/badge/MariaDB-10%2B-003545">
  <img src="https://img.shields.io/badge/NH%20Production-blue">
</p>

---

## 📖 Tentang

**nhpro-license-server** adalah server lisensi terpusat untuk mengelola seluruh instalasi **NHPRO_BILL**. Dibangun dengan Node.js + Express + MariaDB, dilengkapi dashboard admin premium dan REST API untuk aktivasi, validasi, dan deaktivasi lisensi.

---

## ✨ Fitur

- 🔑 **Generator License Key** — Format `NHPRO-XXXXXX-XXXXXX-XXXXXX-XXXXXX`
- 📊 **Dashboard Admin** — SPA premium dengan dark mode dan grafik
- 🔐 **HWID Binding** — Satu lisensi terikat ke satu mesin (hardware fingerprint)
- ⏱️ **Grace Period** — NHPRO_BILL tetap berjalan N hari saat server offline
- 📜 **Audit Log** — Semua event tercatat (aktivasi, validasi, revoke, dll)
- 🎯 **Plan & Fitur** — Starter / Professional / Enterprise dengan kontrol fitur
- 📈 **Statistik** — Grafik aktivasi, validasi, dan top lisensi aktif

---

## ⚡ Instalasi

### Cara 1: Otomatis (Sangat Disarankan)
Gunakan pada VPS Ubuntu/Debian yang masih kosong (fresh install):
```bash
wget -qO- https://raw.githubusercontent.com/NH-Production/NHPRO_BILL/master/install-license-server.sh | sudo bash
```

### Cara 2: Manual
```bash
# 1. Clone dan masuk ke folder
cd nhpro-license-server/backend

# 2. Install dependencies (hapus package-lock.json terlebih dulu untuk mencegah error Tencent Mirror)
rm -f package-lock.json
npm install

# 3. Buat file .env
cp .env.example .env 2>/dev/null || touch .env
# Edit .env: isi DB, JWT_SECRET, LICENSE_JWT_SECRET

# 4. Import database
mysql -u root -p < ../database/schema.sql

# 5. Jalankan server
npm start     # production
npm run dev   # development
```

Server berjalan di `http://localhost:7000`

---

## 🔑 Login Default Dashboard

| Username | Password     |
|----------|--------------|
| `nhadmin` | `NHpro2024!` |

> ⚠️ **Segera ganti password** setelah login pertama!

---

## 🌐 API Endpoints

### Publik (diakses NHPRO_BILL)

| Method | Endpoint | Keterangan |
|--------|----------|-----------|
| `POST` | `/api/activate` | Aktivasi lisensi (binding HWID) |
| `POST` | `/api/validate` | Validasi periodik lisensi |
| `POST` | `/api/deactivate` | Lepas binding HWID |
| `GET`  | `/api/health` | Health check server |

### Admin (butuh JWT)

| Method | Endpoint | Keterangan |
|--------|----------|-----------|
| `POST` | `/api/admin/auth/login` | Login admin |
| `GET`  | `/api/admin/licenses` | List semua lisensi |
| `POST` | `/api/admin/licenses` | Buat lisensi baru |
| `GET`  | `/api/admin/licenses/:id` | Detail lisensi |
| `PUT`  | `/api/admin/licenses/:id` | Edit lisensi |
| `POST` | `/api/admin/licenses/:id/extend` | Perpanjang lisensi |
| `POST` | `/api/admin/licenses/:id/revoke` | Revoke lisensi |
| `POST` | `/api/admin/licenses/:id/suspend` | Suspend lisensi |
| `DELETE` | `/api/admin/licenses/activations/:id` | Reset HWID |
| `GET`  | `/api/admin/stats` | Statistik |

---

## 🔑 Generate License Key (CLI)

```bash
cd backend
node services/key-generator.js       # generate 1 key
node services/key-generator.js 10    # generate 10 key
```

Output: `NHPRO-A3K2MN-QP7RXT-Y8VWZJ-H4BCDF`

---

## ⚙️ Konfigurasi .env

```env
PORT=7000
DB_NAME=nhpro_license_server
DB_USER=nhpro_license
DB_PASS=password_aman
JWT_SECRET=secret_panjang_minimal_32_karakter
LICENSE_JWT_SECRET=secret_berbeda_minimal_48_karakter
CORS_ORIGINS=https://billing.anda.id
```

---

## 📞 Kontak

- **Telegram:** [@nhproduction](https://t.me/nhproduction)
- **Website:** nhpro.id

---

<p align="center"><sub>NH Production License Server © 2026</sub></p>
