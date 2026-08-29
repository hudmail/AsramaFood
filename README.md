# 🍽️ AsramaFood

**Aplikasi pemesanan makanan & minuman untuk asrama** — satu aplikasi Node.js, satu file database SQLite, tanpa build step. Tinggal jalan.

Penghuni asrama memesan lewat halaman web, memilih antar ke kamar atau ambil sendiri, membayar dengan QRIS (upload bukti transfer) atau COD, lalu melacak status pesanan pakai kode unik. Admin mengelola pesanan, menu, dan pengaturan toko lewat dashboard terpisah.

> ⚠️ Butuh **Node.js 22.13+** (pakai `node:sqlite` bawaan). Cek: `node -v`

---

## ✨ Fitur

### 🛒 Pelanggan
- **Menu** — kategori, pencarian, filter harga, stok real-time
- **Menu terlaris** — otomatis berdasarkan jumlah terjual
- **Keranjang & checkout** — pilih antar ke kamar / ambil sendiri
- **Opsi makanan** — tambah telur (+Telur) per menu yang diizinkan admin
- **Opsi minuman** — pilih Panas / Es (Dingin) per menu yang diizinkan admin, dengan stok es batu
- **Diskon** — harga coret + badge diskon otomatis
- **Pembayaran** — QRIS (scan & upload bukti) atau COD (bayar di tempat)
- **Tracking** — lacak status pesanan real-time dengan kode unik

### 🔧 Admin (Owner & Kasir)
- **Dashboard pesanan** — kelola status, konfirmasi pembayaran, lihat bukti transfer
- **CRUD menu** — kategori, harga pokok/jual, diskon, stok, foto, opsi telur & es batu per item
- **Pengaturan toko** — nama toko, ongkir, jam buka, gedung, metode pembayaran
- **Jadwal otomatis** — buka/tutup toko otomatis sesuai jam (termasuk jadwal lewat tengah malam)
- **Stok telur & es batu** — diatur global, otomatis berkurang saat ada pesanan
- **Laporan** — export Excel & PDF per tanggal
- **Auto-update** — cek & instal pembaruan dari GitHub langsung dari panel admin *(hanya Owner)*

### 🏗️ Teknis
- 1 aplikasi Express.js, frontend HTML/CSS/JS polos (tanpa framework/build)
- SQLite bawaan Node.js (`node:sqlite`) — **tidak butuh** Python / Visual Studio Build Tools
- Migrasi database otomatis — kolom/tabel baru ditambahkan saat server start
- Docker ready (1 container)
- Kode pesanan acak (anti-iterasi) — format `AF-YYYYMMDD-XXXXXX`

---

## 🚀 Quick Start

### Tanpa Docker

```bash
# 1. Install dependencies
npm install

# 2. Buat file .env
cp .env.example .env
# Edit .env — isi SESSION_SECRET dan ADMIN_DEFAULT_PASSWORD

# 3. Jalankan
node server.js
```

### Dengan Docker

```bash
cp .env.example .env
# Edit .env

docker compose up -d --build
```

Buka di browser:
- **Pelanggan:** http://localhost:3000
- **Admin:** http://localhost:3000/admin/login.html

Login default: `owner` / `kasir`, password sesuai `ADMIN_DEFAULT_PASSWORD` di `.env`.

---

## 📂 Struktur Proyek

```
asrama-food-simple/
├── server.js              # Entry point Express + CSP + static
├── db.js                  # SQLite setup, migrasi otomatis, seed data awal
├── VERSION                # SHA commit terinstal (untuk fitur auto-update)
├── middleware/
│   └── auth.js            # Middleware login admin (session, role)
├── routes/
│   ├── customer.js        # API publik: menu, kategori, order, tracking, bukti bayar
│   └── admin.js           # API admin: login, pesanan, menu, settings, laporan, update
├── public/                # Frontend (HTML/CSS/JS polos, tanpa build)
│   ├── index.html         # Halaman pesan makanan (pelanggan)
│   ├── track.html         # Halaman lacak pesanan
│   ├── favicon.svg
│   ├── css/
│   │   └── style.css      # Semua styling (dark mode, responsive)
│   ├── js/
│   │   ├── app.js         # Logika frontend pelanggan
│   │   ├── track.js       # Logika tracking pesanan
│   │   └── theme.js       # Toggle dark/light mode
│   └── admin/
│       ├── login.html     # Halaman login admin
│       ├── index.html     # Dashboard pesanan
│       ├── menu.html      # Kelola menu & kategori
│       ├── reports.html   # Laporan Excel/PDF
│       ├── settings.html  # Pengaturan toko + panel update
│       └── js/
│           ├── dashboard.js
│           ├── menu.js
│           ├── reports.js
│           └── settings.js
├── data/                  # Database SQLite (auto-created, di-gitignore)
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── DEPLOY.md              # Panduan deploy & upgrade lengkap
└── package.json
```

---

## 🔧 Environment Variables

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port aplikasi |
| `SESSION_SECRET` | — | **Wajib diganti** untuk production (string acak ≥32 karakter) |
| `ADMIN_DEFAULT_PASSWORD` | `ganti-password-ini` | Password awal akun `owner` & `kasir` |
| `DATA_DIR` | `./data` | Lokasi file database SQLite |

```bash
# Generate SESSION_SECRET yang aman:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📝 Alur Pesanan

### Status Pesanan

```
pending → diproses → siap → diantar → selesai     (antar ke kamar)
pending → diproses → siap → selesai                (ambil sendiri)
```

Bisa `dibatalkan` di status apapun sebelum selesai — stok otomatis dikembalikan.

### Alur Pembayaran QRIS

```
menunggu_pembayaran → pelanggan upload bukti → menunggu_konfirmasi → admin cek → dibayar / ditolak
```

QRIS yang ditampilkan adalah **QRIS statis** yang di-upload admin di Pengaturan. Konfirmasi dilakukan manual oleh admin setelah cek mutasi.

### Alur Pembayaran COD

```
menunggu_pembayaran → (admin ubah ke dibayar saat pesanan diantar) → dibayar
```

COD hanya tersedia untuk pesanan **antar ke kamar**.

---

## 🥚 Opsi Tambahan Per Menu

| Opsi | Pengaturan di Admin | Pengaruh |
|------|---------------------|----------|
| **+Telur** | Centang "Izinkan opsi +Telur" di editor menu | Pelanggan bisa pilih tambah telur, stok telur global berkurang |
| **+Es Batu** | Centang "Izinkan opsi +Es Batu" di editor menu | Pelanggan bisa pilih Panas/Dingin, stok es batu global berkurang |

- Harga tambah telur & surcharge es diatur di **Pengaturan → Harga Opsi Tambahan**
- Stok telur & es batu diatur di **Pengaturan → Stok Telur / Stok Es Batu**
- Jika stok habis, opsi otomatis di-disable di halaman pelanggan

---

## 🔄 Auto-Update dari GitHub

Owner bisa mengecek & menginstal pembaruan langsung dari panel admin:

1. Login sebagai **Owner** → buka **Pengaturan**
2. Scroll ke panel **Pembaruan Aplikasi**
3. Klik **Cek Pembaruan** → info versi terbaru dari GitHub
4. Jika ada → klik **Instal Pembaruan** → konfirmasi → server restart otomatis

**Yang aman saat update:**
- ✅ Database (folder `data/`)
- ✅ Gambar upload (folder `public/uploads/`)
- ✅ File konfigurasi (`.env`)

> ⚠️ Gunakan **PM2** atau **Docker** di production agar server restart otomatis setelah update. Jika pakai `node server.js` biasa, jalankan ulang manual.

---

## 💾 Backup & Restore

```bash
# Backup database + uploads
tar -czf backup-$(date +%Y%m%d_%H%M).tar.gz ./data ./public/uploads

# Restore
tar -xzf backup-20261201_1200.tar.gz
```

Database hanya 1 file SQLite — backup tinggal copy `data/asrama-food.sqlite`.

---

## 🛠️ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `ExperimentalWarning: SQLite...` | Normal — bukan error, hanya peringatan Node.js |
| Port 3000 sudah dipakai | Ubah `PORT` di `.env` |
| File `.env` belum ada | `cp .env.example .env` |
| CSS/gambar tidak muncul (akses via IP) | Sudah dihandle — `upgradeInsecureRequests` dimatikan di CSP |
| Database corrupt | Hapus `data/asrama-food.sqlite`, jalankan ulang (data hilang!) |

---

## 📦 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Backend** | Node.js 22+, Express 4, `node:sqlite` |
| **Frontend** | HTML, CSS, JavaScript (vanilla — tanpa framework) |
| **Database** | SQLite (WAL mode) |
| **Auth** | `cookie-session` + `bcryptjs` |
| **Security** | `helmet` (CSP), `express-rate-limit`, file upload validation |
| **Reports** | `exceljs` (Excel), `pdfkit` (PDF) |
| **Deploy** | Docker / PM2 / langsung `node server.js` |

---

## 📄 Lisensi

Dibuat oleh **HudMail** ([@mail.huda](https://instagram.com/mail.huda))
