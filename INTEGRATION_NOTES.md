# Integrasi Tema AsramaFood

Integrasi ini menggabungkan backend `asrama-food-simple` dengan tema Asrama Food biru/mint.

## Guest
- Halaman menu responsif `/`
- Filter kategori, harga, pencarian
- Keranjang dan checkout tanpa akun
- Pilihan antar kamar / ambil sendiri
- Pilihan pembayaran QRIS / COD
- Penyimpanan lokasi guest di localStorage
- Tracking pesanan `/track.html?code=...`
- QRIS: scan + upload bukti bayar
- COD: tidak meminta bukti QRIS

## Admin
- Login `/admin/login.html`
- Dashboard pesanan `/admin/index.html`
- Kelola menu/kategori `/admin/menu.html`
- Pengaturan toko & QRIS `/admin/settings.html`
- Konfirmasi bukti QRIS atau tandai COD sudah dibayar
- Dark mode konsisten dengan guest

## Backend tambahan
- Kolom `payment_method` (`qris` / `cod`) ditambahkan otomatis lewat migrasi ringan.
- API pembuatan pesanan menerima `payment_method`.
- COD dibatasi untuk metode pengantaran.

## Menjalankan
1. Salin `.env.example` menjadi `.env`.
2. Isi `SESSION_SECRET` dan `ADMIN_DEFAULT_PASSWORD`.
3. Jalankan `npm install` lalu `npm start`, atau gunakan Docker Compose.
4. Buka guest di `http://localhost:3000` dan admin di `http://localhost:3000/admin/login.html`.
