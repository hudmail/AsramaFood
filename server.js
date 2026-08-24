require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

require('./db'); // init & auto-seed database

const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '6mb' }));
app.use(
  cookieSession({
    name: 'af_session',
    keys: [process.env.SESSION_SECRET || 'ganti-secret-ini-di-env'],
    maxAge: 12 * 60 * 60 * 1000, // 12 jam
    httpOnly: true,
    sameSite: 'lax',
  })
);

app.use(express.static(path.join(__dirname, 'public')));

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
