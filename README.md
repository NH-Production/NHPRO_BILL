# NH Production — NHPRO_BILL & License Server

Sistem penagihan ISP/Hotspot lengkap (NHPRO_BILL) beserta sistem manajemen lisensinya (License Server).

Proyek ini telah direbranding menjadi **NH Production NHPRO_BILL v2.0.0**.

## 📂 Struktur Repositori

Repositori ini berisi 2 proyek terpisah yang saling terhubung:

1. **`NHPRO_BILL/` (Aplikasi Utama)**
   Aplikasi utama untuk manajemen pelanggan PPPoE & Hotspot, terintegrasi dengan FreeRADIUS, WhatsApp Gateway, dan Payment Gateway.
   - Baca [NHPRO_BILL/README.md](NHPRO_BILL/README.md) untuk instalasi.

2. **`nhpro-license-server/` (License Server)**
   Server pusat untuk mengelola, membuat, dan memvalidasi lisensi untuk semua instalasi NHPRO_BILL.
   - Baca [nhpro-license-server/README.md](nhpro-license-server/README.md) untuk instalasi.

## 🔗 Arsitektur Lisensi

```text
┌────────────────────┐          ┌──────────────────────┐
│                    │          │                      │
│   NHPRO_BILL       │ ◀──────▶ │ nhpro-license-server │
│  (Client Mesin)    │ Validate │    (Pusat Lisensi)   │
│                    │          │                      │
└────────────────────┘          └──────────────────────┘
          │
          ▼
   hwid: Mac + MachineID
```

- NHPRO_BILL wajib diaktivasi menggunakan License Key (`NHPRO-XXXX-XXXX-XXXX-XXXX`).
- License Server mengikat key tersebut ke Hardware ID (HWID) server NHPRO_BILL.
- NHPRO_BILL akan memvalidasi lisensi secara periodik (setiap 6 jam).
- Terdapat sistem *Grace Period* 72 jam jika License Server sedang *offline*, sehingga pelanggan internet tidak langsung terputus.

---
**NH Production © 2026**
