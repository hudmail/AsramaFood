# Dokumentasi Aplikasi — AsramaFood (Simple)

Versi dokumen ini mencakup kondisi aplikasi terbaru, termasuk perbaikan bug dan penambahan fitur **Diskon Menu** & **Menu Terlaris**.

---

## 1. Ringkasan Aplikasi

AsramaFood adalah aplikasi pemesanan makanan/minuman sederhana untuk lingkungan asrama. Pelanggan (anak asrama) memesan lewat halaman web tanpa perlu akun, memilih antar ke kamar atau ambil sendiri, membayar via QRIS (upload bukti transfer manual) atau COD, lalu melacak status pesanannya lewat kode unik. Admin (owner/kasir) mengelola pesanan, menu, kategori, dan pengaturan toko lewat dashboard terpisah.

**Arsitektur:** 1 aplikasi Node.js (Express) + 1 file database SQLite (`node:sqlite`, modul bawaan Node — tidak perlu native build tools). Frontend HTML/CSS/JS polos tanpa build step. Bisa dijalankan langsung dengan `node server.js` atau lewat Docker.

**Kebutuhan:** Node.js ≥ 22.13 (karena memakai `node:sqlite`).

---

## 2. Peran Pengguna

| Peran | Akses |
|---|---|
| **Pelanggan** (tanpa akun) | Lihat menu, checkout, lacak pesanan sendiri lewat kode unik |
| **Kasir** (login admin) | Kelola pesanan (ubah status, konfirmasi/tolak bukti bayar), kelola stok & harga menu, tambah kategori |
| **Owner** (login admin) | Semua akses kasir **+** hapus menu, hapus kategori, ubah pengaturan toko (jam buka, ongkir, QRIS, dll) |

Login admin default saat pertama kali dijalankan: username `owner` dan `kasir`, password sesuai environment variable `ADMIN_DEFAULT_PASSWORD` (wajib diganti sebelum dipakai produksi).

---

## 3. Fitur Pelanggan (`/`)

- **Katalog menu** — filter kategori, cari nama menu, filter rentang harga
- **Menu Terlaris** *(baru)* — seksi khusus di atas katalog, menampilkan menu dengan jumlah terjual terbanyak; otomatis tersembunyi kalau belum ada penjualan sama sekali
- **Badge diskon** *(baru)* — menu yang sedang didiskon tampil dengan harga coret + harga diskon + label "Diskon" pada kartu menunya
- **Keranjang & checkout** tanpa akun — isi nama, WhatsApp, gedung/kamar (kalau diantar), catatan
- **Metode pengambilan** — antar ke kamar atau ambil sendiri
- **Metode pembayaran** — QRIS (scan kode statis lalu upload bukti transfer) atau COD (khusus pesanan antar)
- **Kode pesanan unik** — format `AF-YYYYMMDD-XXXXXX` (6 karakter acak di akhir, bukan sekuensial, supaya tidak bisa ditebak/dijelajahi oleh pelanggan lain)
- **Lacak pesanan** (`/track.html?code=...`) — lihat status pesanan & status pembayaran, upload/re-upload bukti transfer

## 4. Fitur Admin (`/admin`)

- **Login** (`/admin/login.html`) — dengan rate-limit anti brute-force (maksimal 5 percobaan gagal per 10 menit per alamat IP)
- **Dashboard pesanan** (`/admin/index.html`) — daftar pesanan, filter status, ringkasan omzet/profit/pesanan tertunda hari ini, notifikasi stok menipis
- **Detail pesanan** — lihat isi pesanan, ubah status (diproses → siap → diantar/selesai), batalkan pesanan (stok otomatis dikembalikan), konfirmasi/tolak bukti transfer, lihat gambar bukti transfer
- **Kelola menu** (`/admin/menu.html`) — tambah/edit/hapus menu, atur harga pokok & harga jual, stok, foto, ketersediaan, kategori
- **Diskon menu** *(baru)* — tandai "Sedang diskon" pada form menu lalu isi harga diskon; sistem otomatis memvalidasi harga diskon harus lebih murah dari harga jual normal
- **Kolom Terjual** *(baru)* — tabel Kelola Menu menampilkan jumlah unit terjual per menu, berguna untuk melihat menu mana yang laris
- **Kelola kategori** — tambah kategori baru (bisa juga dengan menekan Enter di kolom nama), hapus kategori (khusus owner)
- **Pengaturan toko** (`/admin/settings.html`, khusus owner) — nama toko, jam buka, status buka/tutup, ongkos kirim, daftar gedung yang dilayani, gambar QRIS, aktif/nonaktifkan metode QRIS/COD

---

## 5. Alur Status Pesanan

```
pending → diproses → siap → diantar (jika diantar) / selesai (jika ambil sendiri)
```
Bisa dibatalkan (`dibatalkan`) dari status apapun sebelum selesai — stok yang sudah dikurangi otomatis dikembalikan.

## 6. Alur Pembayaran

Status pembayaran berjalan **paralel**, terpisah dari status pesanan:

```
menunggu_pembayaran → (pelanggan upload bukti) → menunggu_konfirmasi → (admin cek) → dibayar
                                                                                    ↳ ditolak (pelanggan bisa upload ulang)
```

QRIS yang ditampilkan adalah QRIS statis (satu gambar untuk semua nominal) yang diunggah admin — bukan QRIS dinamis dari payment gateway, sehingga konfirmasi pembayaran dilakukan manual oleh admin/kasir setelah mengecek mutasi.

## 7. Cara Kerja Diskon

- Setiap menu punya `price` (harga jual normal) dan opsional `discount_price` + `is_discount`.
- Kalau `is_discount` aktif dan `discount_price` terisi (dan lebih murah dari `price`), maka **harga yang dikenakan ke pelanggan saat checkout adalah `discount_price`**, bukan `price` — baik di tampilan keranjang, ringkasan checkout, maupun perhitungan total pesanan di server.
- Validasi harga diskon dilakukan di server (bukan cuma di tampilan), jadi tidak bisa "diakali" dari sisi klien.
- Riwayat pesanan tetap menyimpan harga yang benar-benar dikenakan saat itu (`price_snapshot`), jadi kalau harga diskon diubah/dimatikan setelahnya, laporan pesanan lama tidak berubah.

## 8. Cara Kerja Menu Terlaris

- Setiap menu punya kolom `sold_count`, bertambah otomatis sejumlah quantity setiap kali menu itu berhasil dipesan pelanggan (saat pesanan dibuat, bukan menunggu pembayaran dikonfirmasi — supaya cepat terlihat trennya).
- Endpoint publik `GET /api/menu/terlaris` mengembalikan menu yang tersedia dan pernah terjual (`sold_count > 0`), diurutkan dari yang paling laris, maksimal 20 item (default tampil 6 di halaman utama).
- Kalau belum ada penjualan sama sekali, seksi ini otomatis disembunyikan di halaman pelanggan (tidak menampilkan kotak kosong).

---

## 9. Struktur Database (SQLite)

| Tabel | Keterangan |
|---|---|
| `admin_users` | Akun admin (`owner` / `kasir`), password di-hash dengan bcrypt |
| `categories` | Kategori menu (nama harus unik) |
| `menu_items` | Data menu: harga pokok/jual, stok, ketersediaan, gambar, **`discount_price`, `is_discount`, `sold_count`** |
| `orders` | Data pesanan: pelanggan, metode, status, status pembayaran, bukti transfer (base64), total |
| `order_items` | Rincian item per pesanan (snapshot nama & harga saat pesanan dibuat, tidak berubah walau menu aslinya diedit/dihapus) |
| `settings` | Pengaturan toko (key-value) |

> **Catatan penyimpanan gambar:** foto menu, gambar QRIS, dan bukti transfer semuanya disimpan sebagai data base64 langsung di kolom database (bukan file terpisah). Ini memudahkan setup (tidak perlu folder upload/storage eksternal), tapi database akan membesar seiring bertambahnya pesanan dan foto. Untuk skala kecil (warung/asrama) ini tidak masalah; kalau volume pesanan sudah besar, pertimbangkan migrasi ke penyimpanan file terpisah.

## 10. Ringkasan Endpoint API

### Publik (tanpa login)
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/settings/public` | Info toko untuk pelanggan (nama, jam buka, ongkir, dll) |
| GET | `/api/categories` | Daftar kategori |
| GET | `/api/menu` | Daftar menu tersedia (bisa filter `?search=` & `?category=`) |
| GET | `/api/menu/terlaris` | Menu terlaris berdasarkan jumlah terjual (`?limit=`) |
| POST | `/api/orders` | Buat pesanan baru |
| GET | `/api/orders/:code` | Lihat detail pesanan lewat kode |
| POST | `/api/orders/:code/bukti-bayar` | Upload bukti transfer |

### Admin (butuh login)
| Method | Path | Peran |
|---|---|---|
| POST | `/api/admin/login` | — (dibatasi rate-limit) |
| POST | `/api/admin/logout` | kasir/owner |
| GET | `/api/admin/me` | kasir/owner |
| GET | `/api/admin/dashboard` | kasir/owner |
| GET/PATCH | `/api/admin/orders...` | kasir/owner |
| GET/POST/PUT | `/api/admin/menu...` | kasir/owner |
| DELETE | `/api/admin/menu/:id` | **owner** |
| GET/POST | `/api/admin/categories` | kasir/owner |
| DELETE | `/api/admin/categories/:id` | **owner** |
| GET/PUT | `/api/admin/settings` | GET: kasir/owner · PUT: **owner** |

---

## 11. Keamanan yang Sudah Diterapkan

- Password admin di-hash dengan bcrypt, tidak pernah disimpan plain text
- Kode pesanan acak (bukan sekuensial) supaya tidak bisa ditebak/dijelajahi
- Rate-limit percobaan login admin
- Pemisahan hak akses owner vs kasir untuk aksi-aksi sensitif (hapus data, ubah pengaturan toko)
- Validasi harga & diskon dilakukan di server, tidak bergantung pada input klien
- Session cookie `httpOnly` + `sameSite: lax`

## 12. Menjalankan Aplikasi

```bash
# Tanpa Docker
npm install
cp .env.example .env   # isi SESSION_SECRET & ADMIN_DEFAULT_PASSWORD
npm start
```

```bash
# Dengan Docker
cp .env.example .env
docker compose up -d --build
```

Akses pelanggan: `http://localhost:3000`
Akses admin: `http://localhost:3000/admin/login.html`

## 13. Keterbatasan Saat Ini

- Belum ada fitur POS untuk pesanan walk-in langsung dari kasir
- Belum ada laporan/export data ke CSV/Excel
- Gambar (menu, QRIS, bukti transfer) disimpan sebagai base64 di database, belum sebagai file terpisah
- Menu Terlaris menghitung dari total pesanan yang **dibuat**, bukan yang sudah dikonfirmasi selesai/dibayar — jadi bisa termasuk pesanan yang nantinya dibatalkan
