# 🚀 Panduan Deploy & Upgrade AsramaFood

> Panduan ini mencakup **deploy pertama kali** dan **prosedur upgrade** ke versi/file terbaru.  
> Pilih salah satu metode sesuai setup server kamu.

---

## 📋 Daftar Isi

- [Metode A — Docker (Direkomendasikan)](#metode-a--docker-direkomendasikan)
- [Metode B — Node.js Langsung (tanpa Docker)](#metode-b--nodejs-langsung-tanpa-docker)
- [Upgrade File Terbaru](#-upgrade-file-terbaru)
- [Backup & Restore Data](#-backup--restore-data)
- [Troubleshooting](#-troubleshooting)

---

## Metode A — Docker (Direkomendasikan)

### Prasyarat

```bash
docker --version   # >= 20.x
docker compose version  # >= 2.x
```

### 1. Deploy Pertama Kali

```bash
# 1. Clone / salin file proyek ke server
git clone <repo-url> asrama-food
cd asrama-food

# 2. Buat file .env dari contoh
cp .env.example .env

# 3. Edit .env — wajib ganti kedua nilai ini!
nano .env
#   SESSION_SECRET=isi-string-acak-panjang-minimal-32-karakter
#   ADMIN_DEFAULT_PASSWORD=password-admin-yang-kuat

# 4. Jalankan
docker compose up -d --build

# 5. Cek status
docker compose ps
docker compose logs -f asrama-food
```

Aplikasi berjalan di `http://localhost:3000`  
Login admin: `http://localhost:3000/admin/login.html`

---

## Metode B — Node.js Langsung (tanpa Docker)

### Prasyarat

```bash
node --version   # >= 22.x
npm --version
pm2 --version    # optional, untuk keep-alive
```

### 1. Deploy Pertama Kali

```bash
# 1. Masuk ke direktori proyek
cd /path/to/asrama-food

# 2. Install dependencies
npm install --omit=dev

# 3. Buat file .env
cp .env.example .env
nano .env
#   SESSION_SECRET=isi-string-acak-panjang
#   ADMIN_DEFAULT_PASSWORD=password-admin

# 4a. Jalankan langsung
node server.js

# 4b. Atau pakai PM2 (agar tetap jalan saat terminal ditutup)
pm2 start server.js --name asrama-food
pm2 save
pm2 startup   # ikuti instruksi yang muncul
```

---

## 🔄 Upgrade File Terbaru

Ini prosedur saat ada file yang diupdate (misalnya `app.js`, `customer.js`, CSS, dll).

### Metode A — Docker

```bash
cd /path/to/asrama-food

# 1. Tarik file terbaru (jika pakai Git)
git pull

# atau, kalau manual: salin file yang diupdate ke server via SCP/SFTP
# scp -r ./public user@server:/path/to/asrama-food/
# scp ./routes/customer.js user@server:/path/to/asrama-food/routes/

# 2. Rebuild image dan restart container
#    Data (database & uploads) AMAN — tersimpan di volume ./data & ./public/uploads
docker compose up -d --build

# 3. Verifikasi
docker compose ps
docker compose logs --tail=50 asrama-food
```

> **ℹ️ Catatan:** `--build` hanya rebuild image jika ada perubahan file.  
> Volume `./data` dan `./public/uploads` tidak tersentuh — data pesanan & gambar aman.

---

### Metode B — Node.js (PM2)

```bash
cd /path/to/asrama-food

# 1. Tarik file terbaru
git pull

# atau salin manual file yang berubah:
# scp ./public/js/app.js user@server:/path/to/asrama-food/public/js/
# scp ./routes/customer.js user@server:/path/to/asrama-food/routes/
# scp ./db.js user@server:/path/to/asrama-food/

# 2. Install dependency baru (jika package.json berubah)
npm install --omit=dev

# 3. Restart aplikasi
pm2 restart asrama-food

# 4. Cek log
pm2 logs asrama-food --lines 50
```

### Metode B — Node.js (tanpa PM2)

```bash
# 1. Hentikan proses lama (Ctrl+C atau kill PID)
pkill -f "node server.js"

# 2. Tarik file terbaru
git pull

# 3. Jalankan ulang
node server.js
```

---

## 📁 File-File yang Sering Diupdate

| File/Folder | Keterangan |
|-------------|-----------|
| `public/js/app.js` | Logika frontend pelanggan |
| `public/css/style.css` | Tampilan/styling |
| `public/index.html` | Halaman pelanggan |
| `public/admin/js/` | Logika panel admin |
| `routes/customer.js` | API pelanggan (order, menu, dll) |
| `routes/admin.js` | API admin (pengaturan, menu, laporan) |
| `db.js` | Skema database & migrasi otomatis |
| `server.js` | Entry point server |

> **✅ Migrasi DB otomatis:** Setiap kali server dijalankan, `db.js` otomatis menambahkan kolom/tabel baru jika ada perubahan skema. Tidak perlu jalankan script migrasi manual.

---

## 💾 Backup & Restore Data

### Backup

```bash
# Backup database
cp ./data/asrama-food.db ./backup/asrama-food-$(date +%Y%m%d).db

# Backup semua (database + gambar upload)
tar -czf backup-$(date +%Y%m%d_%H%M).tar.gz ./data ./public/uploads
```

### Restore

```bash
# Hentikan server dulu!
docker compose stop          # Docker
# atau: pm2 stop asrama-food  # PM2

# Restore database
cp ./backup/asrama-food-20261201.db ./data/asrama-food.db

# Restore uploads (opsional)
tar -xzf backup-20261201_1200.tar.gz

# Jalankan kembali
docker compose start         # Docker
# atau: pm2 start asrama-food  # PM2
```

---

## 🔒 Checklist Keamanan Sebelum Deploy

- [ ] `SESSION_SECRET` sudah diganti dengan string acak yang kuat (min. 32 karakter)
- [ ] `ADMIN_DEFAULT_PASSWORD` sudah diganti dan bukan password default
- [ ] File `.env` **tidak** masuk ke Git (sudah ada di `.gitignore`)
- [ ] Setelah login pertama, segera ganti password lewat panel admin
- [ ] Pasang reverse proxy (Nginx/Caddy) dengan HTTPS untuk produksi publik

### Generate `SESSION_SECRET` yang aman:

```bash
# Linux / Mac
openssl rand -hex 32

# Node.js (semua platform)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🛠 Troubleshooting

### Server tidak mau jalan (exit code 1)

```bash
# Lihat error detail
node server.js 2>&1 | head -50

# atau via Docker
docker compose logs asrama-food
```

**Penyebab umum:**
- Port 3000 sudah dipakai → ubah `PORT` di `.env`
- File `.env` belum dibuat → `cp .env.example .env`
- `node_modules` belum ada → `npm install --omit=dev`

### Database corrupt / perlu reset

```bash
# HATI-HATI: ini menghapus semua data!
rm ./data/asrama-food.db
node server.js   # DB baru dibuat otomatis
```

### Gambar upload tidak muncul setelah upgrade Docker

```bash
# Pastikan volume mount sudah benar di docker-compose.yml:
# volumes:
#   - ./public/uploads:/app/public/uploads
docker compose down && docker compose up -d --build
```

---

## ⚡ Perintah Cepat

```bash
# Status container
docker compose ps

# Log real-time
docker compose logs -f asrama-food

# Restart cepat (tanpa rebuild)
docker compose restart asrama-food

# Upgrade lengkap (pull + rebuild + restart)
git pull && docker compose up -d --build

# Cek versi Node di container
docker compose exec asrama-food node --version
```

---

*Dibuat untuk AsramaFood Simple — Node.js + SQLite + Express*
