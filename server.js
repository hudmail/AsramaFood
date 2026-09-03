require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const compression = require('compression');

require('./db'); // init & auto-seed database

const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Performance
// CSP diaktifkan dengan daftar sumber eksternal yang benar-benar dipakai
// (Google Fonts + Font Awesome via cdnjs). 'unsafe-inline' untuk script/style
// masih diperlukan karena banyak onclick="" dan <style> inline di halaman -
// tapi ini tetap jauh lebih ketat daripada mematikan CSP sepenuhnya, karena
// tetap membatasi asal skrip/gambar/koneksi lain dan mematikan <object>/frame.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        // PENTING: helmet secara default set scriptSrcAttr ke 'none' kalau tidak
        // di-override, dan directive ini SECARA TERPISAH mengatur atribut event
        // inline (onclick="", onchange="", dst) - beda dari scriptSrc yang cuma
        // mengatur <script> tag. Tanpa baris ini, SEMUA onclick="" di seluruh
        // aplikasi diblokir browser walau scriptSrc sudah 'unsafe-inline'.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        // PENTING: helmet MENYISIPKAN 'upgrade-insecure-requests' secara default
        // ke CSP walau kita sudah override directive lain di atas (directives
        // yang tidak disebutkan tetap dipakai dari default helmet, bukan hilang).
        // Directive ini memaksa BROWSER mengubah semua request http:// di
        // halaman (termasuk CSS/JS/gambar dari domain sendiri) jadi https://
        // sebelum diambil. Kalau server tidak benar-benar melayani HTTPS di
        // port itu (misal deploy di CasaOS/NAS/homelab diakses lewat IP polos
        // seperti http://192.168.x.x:3000), semua aset itu gagal dimuat dengan
        // error ERR_SSL_PROTOCOL_ERROR dan halaman jadi tanpa styling sama
        // sekali. Di localhost hal ini tidak kelihatan karena browser
        // menganggap "localhost" origin yang sudah aman sehingga tidak
        // di-upgrade - makanya mulus saat di test di Windows tapi rusak begitu
        // diakses lewat alamat IP/domain lain di jaringan. Set null untuk
        // mematikan directive ini (App ini memang belum disajikan lewat HTTPS
        // langsung; kalau nanti dipasang reverse proxy dengan HTTPS beneran,
        // directive ini boleh diaktifkan lagi).
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(compression());

app.use(express.json({ limit: '1mb' }));
app.use(
  cookieSession({
    name: 'af_session',
    keys: [process.env.SESSION_SECRET || 'ganti-secret-ini-di-env'],
    maxAge: 12 * 60 * 60 * 1000, // 12 jam
    httpOnly: true,
    sameSite: 'lax',
  })
);

// Proteksi halaman HTML admin di level server, SEBELUM static middleware.
// Tanpa ini, express.static akan mengirim admin/index.html dkk ke siapa saja
// yang request, dan pengecekan login cuma berjalan belakangan lewat JS di
// browser (fetch ke /api/admin/me) - celah ini bisa dieksploitasi dengan
// tools seperti Burp Suite untuk intercept & menahan request sebelum JS
// sempat redirect, sehingga halaman admin (HTML/JS-nya, bukan datanya)
// tetap bisa dilihat walau belum login.
const ADMIN_PROTECTED_PAGES = new Set([
  '/admin',
  '/admin/',
  '/admin/index.html',
  '/admin/menu.html',
  '/admin/reports.html',
  '/admin/settings.html',
]);

app.use((req, res, next) => {
  if (ADMIN_PROTECTED_PAGES.has(req.path)) {
    if (!(req.session && req.session.userId)) {
      return res.redirect('/admin/login.html');
    }
  }
  next();
});

// Cache static assets for 1 day
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

app.use('/api', customerRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

app.listen(PORT, () => {
  console.log(`AsramaFood jalan di http://localhost:${PORT}`);
});
