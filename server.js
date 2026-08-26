require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
<<<<<<< HEAD
const helmet = require('helmet');
const compression = require('compression');
=======
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce

require('./db'); // init & auto-seed database

const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

<<<<<<< HEAD
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
      },
    },
  })
);
app.use(compression());

app.use(express.json({ limit: '1mb' }));
=======
app.use(express.json({ limit: '6mb' }));
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
app.use(
  cookieSession({
    name: 'af_session',
    keys: [process.env.SESSION_SECRET || 'ganti-secret-ini-di-env'],
    maxAge: 12 * 60 * 60 * 1000, // 12 jam
    httpOnly: true,
    sameSite: 'lax',
  })
);

<<<<<<< HEAD
// Cache static assets for 1 day
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
=======
app.use(express.static(path.join(__dirname, 'public')));
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce

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
