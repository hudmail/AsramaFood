# 🍽️ AsramaFood (Simple)

Versi sederhana dari AsramaFood — aplikasi pemesanan makanan/minuman untuk asrama.
Satu aplikasi Node.js, satu file database SQLite, **tanpa** build step, tanpa container terpisah untuk database/nginx. Tinggal jalan.

## Kenapa versi ini beda dari sebelumnya?

Versi lama pakai Next.js + NestJS + PostgreSQL + Nginx (4 service terpisah) — powerful tapi ribet untuk dipakai di lingkungan asrama yang kecil. Versi ini:

- 1 aplikasi Node.js (Express), HTML/JS biasa di frontend (tanpa build/compile)
- 1 file database SQLite, pakai modul **bawaan Node.js** (`node:sqlite`) — bukan package native seperti `better-sqlite3`, jadi **tidak butuh Python/Visual Studio Build Tools** sama sekali, aman di Windows manapun
- Bisa jalan langsung dengan `node server.js`, atau 1 container Docker
- Cocok untuk Windows (Docker Desktop), CasaOS, atau VPS kecil

> ⚠️ Butuh **Node.js versi 22.13 atau lebih baru** (karena pakai `node:sqlite`). Cek versi kamu dengan `node -v`. Kalau masih Node 18/20, update dulu lewat [nodejs.org](https://nodejs.org) atau `nvm install 22`.

Fitur inti yang tersedia: menu (kategori, cari, stok), keranjang & checkout, pembayaran **QRIS statis + konfirmasi manual** (pelanggan scan QRIS lalu upload bukti transfer, admin konfirmasi di dashboard), kode pesanan unik + lacak status, dashboard admin, kelola pesanan (ubah status, batalkan), CRUD menu & kategori, pengaturan toko (buka/tutup, ongkir, jam buka, gambar QRIS).

Belum ada (menyusul kalau dibutuhkan): POS walk-in, laporan/export CSV, manajemen banyak user.

## 🚀 Menjalankan dengan Docker (disarankan — Windows / CasaOS / VPS)

### Windows (Docker Desktop) atau VPS (Docker + Docker Compose)

```bash
# 1. Copy dan isi environment
cp .env.example .env
# edit .env — isi SESSION_SECRET dan ADMIN_DEFAULT_PASSWORD

# 2. Build & jalankan
docker compose up -d --build

# 3. Buka di browser
# Customer : http://localhost:3000
# Admin    : http://localhost:3000/admin/login.html
```

Login admin default: `owner` / `kasir`, password sesuai `ADMIN_DEFAULT_PASSWORD` di `.env` (default: `ganti-password-ini`). **Segera login dan ganti password lewat menu Pengaturan / database setelah deploy.**

**Setelah deploy, jangan lupa upload gambar QRIS kamu** di menu Admin → Pengaturan → QRIS Pembayaran, supaya pelanggan bisa langsung bayar.

Data (SQLite) tersimpan di folder `./data` di host — aman walau container di-restart/rebuild.

### CasaOS

1. Push folder ini ke sebuah Git repo (GitHub/Gitea), atau upload langsung ke VPS/NAS.
2. Di CasaOS App Store → **Install a Custom App** → gunakan `docker-compose.yml` di repo ini (atau import lewat menu "Docker Compose").
3. Set environment variable `SESSION_SECRET` dan `ADMIN_DEFAULT_PASSWORD` di panel CasaOS.
4. Mapping port `3000` ke port yang kamu mau, mapping volume `./data` → `/app/data`.
5. Jalankan, lalu akses lewat IP CasaOS kamu, misal `http://192.168.1.x:3000`.

### VPS (Ubuntu, tanpa Docker Desktop)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
git clone <repo-kamu> asrama-food && cd asrama-food
cp .env.example .env && nano .env
docker compose up -d --build
```

Kalau mau pakai domain + HTTPS, taruh reverse proxy simpel di depannya (Caddy paling gampang — otomatis SSL):

```bash
# contoh Caddyfile
domain-kamu.com {
    reverse_proxy localhost:3000
}
```

## 🖥️ Menjalankan tanpa Docker (langsung Node.js)

Kalau di Windows kamu sudah ada Node.js (>=18) terpasang dan tidak mau pakai Docker sama sekali:

```bash
npm install
copy .env.example .env    # Windows
# atau: cp .env.example .env   (Mac/Linux)
# edit .env sesuai kebutuhan

npm start
```

Buka `http://localhost:3000`. Database SQLite otomatis dibuat di folder `data/` saat pertama kali dijalankan — tidak perlu migrasi/seed manual.

## 📂 Struktur Proyek

```
asrama-food-simple/
├── server.js          # entry point Express
├── db.js              # setup SQLite + auto-seed data awal
├── middleware/auth.js  # cek login admin
├── routes/
│   ├── customer.js     # API publik: menu, checkout, tracking
│   └── admin.js        # API admin: login, pesanan, menu, pengaturan
├── public/              # semua frontend (HTML/CSS/JS polos, tanpa build)
│   ├── index.html        # halaman pesan (customer)
│   ├── track.html         # lacak pesanan
│   └── admin/              # login, dashboard pesanan, kelola menu, pengaturan
├── data/                 # file database SQLite (dibuat otomatis)
├── Dockerfile
└── docker-compose.yml
```

## 🔧 Environment Variables

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port aplikasi |
| `SESSION_SECRET` | - | Wajib diganti untuk production, string acak panjang |
| `ADMIN_DEFAULT_PASSWORD` | `ganti-password-ini` | Password akun `owner`/`kasir` saat pertama kali seed |
| `DATA_DIR` | `./data` | Lokasi file database SQLite |

> Catatan: saat dijalankan kamu akan lihat `ExperimentalWarning: SQLite is an experimental feature...` di log — ini normal, cuma peringatan dari Node.js, bukan error. Fiturnya sudah stabil dipakai sejak Node 22.13.

## 💾 Backup

Karena database cuma 1 file SQLite, backup tinggal copy filenya:

```bash
cp data/asrama-food.sqlite backup-$(date +%Y%m%d).sqlite
```

## 🔄 Kode Pesanan

Format tetap sama seperti versi sebelumnya: `AF-YYYYMMDD-XXXX`, reset urutan tiap hari.

## 📝 Alur Status Pesanan

`pending` → `diproses` → `siap` → `diantar` (jika diantar) / `selesai` (jika ambil sendiri)

Bisa dibatalkan (`dibatalkan`) di status apapun sebelum selesai — stok otomatis dikembalikan.

## 💳 Alur Pembayaran QRIS

Pembayaran terpisah dari status pesanan, jalan paralel:

`menunggu_pembayaran` → pelanggan scan QRIS & upload bukti transfer → `menunggu_konfirmasi` → admin cek bukti di dashboard → `dibayar` (atau `ditolak` jika bukti tidak valid, pelanggan bisa upload ulang)

QRIS yang ditampilkan ke pelanggan adalah **QRIS statis** (satu gambar untuk semua nominal) yang di-upload admin lewat menu Pengaturan — bukan QRIS dinamis dari payment gateway, jadi konfirmasi pembayaran dilakukan manual oleh admin/kasir setelah mengecek mutasi rekening/e-wallet.
