function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Belum login' });
}

// requireOwner memeriksa KEDUANYA: userId (sudah login) DAN role owner.
// Tanpa cek userId, sesi yang dimanipulasi dengan role='owner' tapi userId kosong
// bisa lolos dari pengecekan role saja.
function requireOwner(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'owner') return next();
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Belum login' });
  return res.status(403).json({ error: 'Hanya owner yang boleh mengakses' });
}

// --- Rate limiter sederhana untuk endpoint login admin ---
// Membatasi percobaan login per IP supaya tidak mudah di-brute-force.
// Disimpan in-memory (cukup untuk single container/instance).
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 menit
const attempts = new Map(); // ip -> { count, resetAt }

function loginRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_ATTEMPTS) {
    const waitMin = Math.ceil((record.resetAt - now) / 60000);
    return res.status(429).json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${waitMin} menit.` });
  }

  record.count += 1;
  next();
}

// Bersihkan entri lama secara berkala biar Map tidak membengkak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts) {
    if (now > record.resetAt) attempts.delete(ip);
  }
}, WINDOW_MS).unref();

module.exports = { requireAuth, requireOwner, loginRateLimit };
