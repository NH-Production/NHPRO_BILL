<h1 align="center">NH Production NHPRO_BILL</h1>

<p align="center">
  <b>Sistem Billing ISP & Hotspot Lengkap</b><br>
  PPPoE + Hotspot · FreeRADIUS · MikroTik · WhatsApp & Telegram Bot · Payment Gateway · TR-069 ACS
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versi-v2.0.0-BA7517"> 
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933"> 
  <img src="https://img.shields.io/badge/MariaDB-10%2B-003545"> 
  <img src="https://img.shields.io/badge/NH%20Production-blue">
</p>

---

## 📖 Tentang

**NH Production NHPRO_BILL** adalah aplikasi manajemen billing premium untuk ISP, RT/RW Net, dan operator Hotspot. Dibangun dengan **Node.js + Express + MariaDB**, terintegrasi langsung dengan **FreeRADIUS** dan **MikroTik** untuk autentikasi PPPoE & Hotspot, dilengkapi gateway **WhatsApp** dan **Telegram**, pembayaran online otomatis, serta manajemen perangkat ONU lewat **TR-069 (ACS)** — semuanya dalam satu dashboard berbahasa Indonesia yang responsif (bisa dibuka di HP).

Versi v2.0.0 kini terhubung dengan arsitektur **License Server Terpusat** untuk manajemen keamanan dan fitur yang lebih baik.

---

## ⚡ Instalasi Cepat

> Jalankan di **VPS baru** (Ubuntu 22/24 atau Debian 11/12) sebagai root.

**Install di VPS BARU:**
```bash
wget -qO- https://raw.githubusercontent.com/NH-Production/NHPRO_BILL/master/install.sh | sudo bash
```

**Update di VPS yang sudah terpasang:**
```bash
wget -qO- https://raw.githubusercontent.com/NH-Production/NHPRO_BILL/master/update.sh | sudo bash
```

Installer otomatis memasang **Node.js 20, pm2, MariaDB**, membuat database `nhpro_bill_radius`, meng-clone aplikasi ke `/opt/nhpro_bill`, membuat file `.env` (JWT digenerate otomatis), mengimpor schema, lalu menjalankan aplikasi via **pm2** dengan nama `nhpro_bill`. Setelah selesai, akses dashboard di `http://IP-VPS:3000`.

### 🔑 Login Default

Setelah install, masuk dengan akun default:

| Username | Password   |
|----------|------------|
| `admin`  | `admin123` |

> ⚠️ **Segera ganti password** dari menu profil setelah login pertama.

---

## ✨ Fitur Utama

- **Billing Otomatis:** Generate tagihan, pengingat WA, dan isolir otomatis untuk pelanggan menunggak.
- **PPPoE & Hotspot:** Integrasi sempurna dengan MikroTik dan FreeRADIUS.
- **License Guard System:** Sistem keamanan lisensi terintegrasi, transparan, dengan Grace Period 72 jam jika server pusat down.
- **TR-069 (ACS):** Pantau redaman sinyal optik ONU dari jarak jauh.
- **Reseller:** Portal khusus untuk mitra dan reseller Anda.
- **Payment Gateway:** Midtrans, Xendit, Duitku, Tripay.
- **Voucher Generator:** Buat voucher massal yang siap cetak.

---

## ⚙️ Konfigurasi Lisensi & Lingkungan

Konfigurasi utama ada di `/opt/nhpro_bill/backend/.env` (dibuat otomatis oleh installer).

```env
PORT=3000
DB_NAME=nhpro_bill_radius
DB_USER=nhpro_bill
DB_PASS=********           
JWT_SECRET=********         
LICENSE_KEY=NHPRO-XXXX-XXXX-XXXX-XXXX
```

### Aktivasi Lisensi
Anda membutuhkan `LICENSE_KEY` dari NH Production untuk menggunakan aplikasi secara penuh. Masukkan key tersebut di menu **Pengaturan → Lisensi** di dalam dashboard admin.

---

## 🤝 Dukungan & Kontak

**NH Production** adalah pengembang dan pengelola resmi proyek SimBill.

✈️ **Telegram Support:** [@nhproduction](https://t.me/nhproduction)
🌐 **Website:** [nhpro.id](https://nhpro.id)

---

<p align="center"><sub>Hak Cipta © 2026 NH Production — Semua Hak Dilindungi.</sub></p>
