const express = require('express');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, getSetting, setSetting } = require('../db');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
// Batasi ukuran (5MB) dan hanya terima file gambar - supaya /uploads tidak jadi
// celah DoS (file raksasa) atau stored-XSS (upload .html/.svg berisi script).
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('File yang diupload harus berupa gambar'));
    }
    cb(null, true);
  },
});
const { requireAuth, requireOwner, loginRateLimit } = require('../middleware/auth');

// Bungkus upload.single supaya error dari multer (file kegedean, tipe salah)
// dibalas rapi sebagai 400 JSON, bukan nyangkut ke error handler generik (500).
function uploadOne(fieldName) {
  const mw = upload.single(fieldName);
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran file maksimal 5MB' });
      }
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file' });
    });
  };
}

const router = express.Router();

const VALID_STATUSES = ['pending', 'diproses', 'siap', 'diantar', 'selesai', 'dibatalkan'];
const VALID_PAYMENT_STATUSES = ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dibayar', 'ditolak'];

router.post('/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username & password wajib diisi' });

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  res.json({ username: user.username, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.session.username, role: req.session.role });
});

router.get('/dashboard', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const summary = db
    .prepare(
      `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total), 0) AS total_revenue
       FROM orders WHERE date(created_at) = ? AND status != 'dibatalkan'`
    )
    .get(today);
  const cost = db
    .prepare(
      `SELECT COALESCE(SUM(oi.qty * oi.cost_snapshot), 0) AS total_cost
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE date(o.created_at) = ? AND o.status != 'dibatalkan'`
    )
    .get(today);
  const pending = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'`).get().c;
  const unconfirmedPayments = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE payment_status = 'menunggu_konfirmasi'`).get().c;
  const lowStock = db.prepare('SELECT id, name, stock FROM menu_items WHERE stock <= 3 AND is_available = 1').all();
  res.json({ ...summary, total_profit: summary.total_revenue - cost.total_cost, pending_orders: pending, unconfirmed_payments: unconfirmedPayments, low_stock: lowStock });
});

router.get('/orders', requireAuth, (req, res) => {
  const { status = '', payment_status = '' } = req.query;
  let sql = 'SELECT * FROM orders';
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (payment_status) {
    clauses.push('payment_status = ?');
    params.push(payment_status);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY id DESC LIMIT 200';
  const orders = db.prepare(sql).all(...params);
  res.json(orders);
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

router.patch('/orders/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Status tidak valid' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

  const tx = db.transaction(() => {
    if (status === 'dibatalkan' && order.status !== 'dibatalkan') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      const restoreStock = db.prepare('UPDATE menu_items SET stock = stock + ? WHERE id = ?');
      // sold_count juga harus dikurangi balik, kalau tidak menu yang laris
      // gara-gara pesanan yang akhirnya dibatalkan akan tetap dianggap
      // "terlaris" selamanya walau transaksinya tidak pernah benar-benar terjadi.
      const decrementSold = db.prepare('UPDATE menu_items SET sold_count = MAX(0, sold_count - ?) WHERE id = ?');
      items.forEach((it) => {
        if (it.menu_item_id) {
          restoreStock.run(it.qty, it.menu_item_id);
          decrementSold.run(it.qty, it.menu_item_id);
        }
      });
    }
    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, order.id);
  });
  tx();

  res.json({ ok: true });
});

router.patch('/orders/:id/payment-status', requireAuth, (req, res) => {
  const { payment_status } = req.body || {};
  if (!VALID_PAYMENT_STATUSES.includes(payment_status)) {
    return res.status(400).json({ error: 'Status pembayaran tidak valid' });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

  if (payment_status === 'dibayar') {
    db.prepare(
      `UPDATE orders SET payment_status = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(payment_status, order.id);
  } else {
    db.prepare(`UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      payment_status,
      order.id
    );
  }

  res.json({ ok: true });
});

// --- Menu management ---
router.get('/menu', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, c.name AS category_name FROM menu_items m
       LEFT JOIN categories c ON c.id = m.category_id
       ORDER BY m.id DESC`
    )
    .all();
  res.json(rows);
});

// FormData (multipart) mengirim SEMUA field sebagai string, termasuk untuk
// checkbox ("0"/"1") dan angka ("15000"). String "0" itu truthy di JS, dan
// perbandingan >=/<= antar string dilakukan leksikografis (bukan numerik) -
// makanya semua nilai berikut WAJIB dikonversi eksplisit sebelum dipakai,
// supaya validasi & penyimpanan datanya benar.
function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}
function toIntOrDefault(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function toIntOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// Hapus file upload lama dari disk kalau digantikan/tidak dipakai lagi,
// supaya folder /uploads tidak terus membengkak isi file yatim.
function deleteUploadedFile(webPath) {
  if (!webPath || typeof webPath !== 'string' || !webPath.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, '../public', webPath);
  fs.unlink(filePath, () => {}); // best-effort, tidak masalah kalau gagal/sudah tidak ada
}

router.post('/menu', requireAuth, uploadOne('image'), (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').trim();
  const description = body.description || '';
  const price = toIntOrNull(body.price);
  const cost_price = toIntOrDefault(body.cost_price, 0);
  const stock = toIntOrDefault(body.stock, 0);
  const category_id = body.category_id ? toIntOrNull(body.category_id) : null;
  const is_available = toBool(body.is_available);
  const is_discount = toBool(body.is_discount);
  const discount_price = toIntOrNull(body.discount_price);
  const allow_egg = toBool(body.allow_egg);
  const allow_ice = toBool(body.allow_ice);
  // image WAJIB null (bukan undefined) kalau tidak ada file/nilai - node:sqlite
  // menolak bind parameter undefined dan bikin server crash (500).
  const image = req.file ? `/uploads/${req.file.filename}` : (body.image || null);

  if (!name || !price) return res.status(400).json({ error: 'Nama & harga wajib diisi' });
  if (is_discount && (!discount_price || discount_price <= 0)) {
    return res.status(400).json({ error: 'Harga diskon wajib diisi kalau menu ditandai sedang diskon' });
  }
  if (is_discount && discount_price >= price) {
    return res.status(400).json({ error: 'Harga diskon harus lebih murah dari harga jual' });
  }

  const result = db
    .prepare(
      `INSERT INTO menu_items (category_id, name, description, price, cost_price, stock, is_available, image, discount_price, is_discount, allow_egg, allow_ice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(category_id, name, description, price, cost_price, stock, is_available ? 1 : 0, image, is_discount ? discount_price : null, is_discount ? 1 : 0, allow_egg ? 1 : 0, allow_ice ? 1 : 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/menu/:id', requireAuth, uploadOne('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Menu tidak ditemukan' });

  const body = req.body || {};
  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const description = body.description !== undefined ? body.description : existing.description;
  const price = body.price !== undefined ? toIntOrNull(body.price) : existing.price;
  const cost_price = body.cost_price !== undefined ? toIntOrDefault(body.cost_price, 0) : existing.cost_price;
  const stock = body.stock !== undefined ? toIntOrDefault(body.stock, 0) : existing.stock;
  const category_id = body.category_id !== undefined ? (body.category_id ? toIntOrNull(body.category_id) : null) : existing.category_id;
  const is_available = body.is_available !== undefined ? toBool(body.is_available) : !!existing.is_available;
  const is_discount = body.is_discount !== undefined ? toBool(body.is_discount) : !!existing.is_discount;
  const discount_price = body.discount_price !== undefined ? toIntOrNull(body.discount_price) : existing.discount_price;
  const allow_egg = body.allow_egg !== undefined ? toBool(body.allow_egg) : !!existing.allow_egg;
  const allow_ice = body.allow_ice !== undefined ? toBool(body.allow_ice) : !!existing.allow_ice;

  const image = req.file ? `/uploads/${req.file.filename}` : (body.image !== undefined ? body.image || null : existing.image);
  if (req.file && existing.image && existing.image !== image) deleteUploadedFile(existing.image);

  if (!name || !price) return res.status(400).json({ error: 'Nama & harga wajib diisi' });
  if (is_discount && (!discount_price || discount_price <= 0)) {
    return res.status(400).json({ error: 'Harga diskon wajib diisi kalau menu ditandai sedang diskon' });
  }
  if (is_discount && discount_price >= price) {
    return res.status(400).json({ error: 'Harga diskon harus lebih murah dari harga jual' });
  }

  db.prepare(
    `UPDATE menu_items SET name = ?, description = ?, price = ?, cost_price = ?, stock = ?, category_id = ?, image = ?, is_available = ?, discount_price = ?, is_discount = ?, allow_egg = ?, allow_ice = ?
     WHERE id = ?`
  ).run(name, description, price, cost_price, stock, category_id, image, is_available ? 1 : 0, is_discount ? discount_price : null, is_discount ? 1 : 0, allow_egg ? 1 : 0, allow_ice ? 1 : 0, req.params.id);

  res.json({ ok: true });
});

// Hapus menu bersifat destruktif (data lama di riwayat pesanan tetap aman lewat snapshot,
// tapi menu itu sendiri hilang) -> dibatasi untuk owner saja.
router.delete('/menu/:id', requireOwner, (req, res) => {
  const existing = db.prepare('SELECT image FROM menu_items WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  if (existing) deleteUploadedFile(existing.image);
  res.json({ ok: true });
});

// --- Categories ---
router.get('/categories', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all());
});

router.post('/categories', requireAuth, (req, res) => {
  const { name, sort_order = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi' });
  try {
    const result = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, sort_order);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'Kategori sudah ada' });
  }
});

router.delete('/categories/:id', requireOwner, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Settings ---
router.get('/settings', requireAuth, (req, res) => {
  res.json({
    store_name: getSetting('store_name'),
    is_open: getSetting('is_open') === '1',
    delivery_fee: parseInt(getSetting('delivery_fee', '0'), 10),
    open_hours: getSetting('open_hours'),
    qris_image: getSetting('qris_image', ''),
    available_buildings: getSetting('available_buildings', 'Gedung 2'),
    allow_qris: getSetting('allow_qris', '1') === '1',
    allow_cod: getSetting('allow_cod', '1') === '1',
    egg_price: parseInt(getSetting('egg_price', '3000'), 10),
    drink_temp_cold_price: parseInt(getSetting('drink_temp_cold_price', '1000'), 10),
    egg_stock: parseInt(getSetting('egg_stock', '0'), 10),
    ice_stock: parseInt(getSetting('ice_stock', '0'), 10),
    auto_schedule: getSetting('auto_schedule', '0') === '1',
    schedule_open: getSetting('schedule_open', '07:00'),
    schedule_close: getSetting('schedule_close', '21:00'),
  });
});

// Pengaturan toko (jam buka, ongkir, metode pembayaran, gambar QRIS, dll)
// adalah keputusan level pemilik usaha -> dibatasi untuk owner saja.
router.put('/settings', requireOwner, uploadOne('qris_image'), (req, res) => {
  const { store_name, is_open, delivery_fee, open_hours, available_buildings, allow_qris, allow_cod, egg_price, drink_temp_cold_price, egg_stock, ice_stock, auto_schedule, schedule_open, schedule_close } = req.body || {};
  const qris_image = req.file ? `/uploads/${req.file.filename}` : req.body.qris_image;
  if (req.file) {
    const oldQris = getSetting('qris_image', '');
    if (oldQris && oldQris !== qris_image) deleteUploadedFile(oldQris);
  }
  if (store_name !== undefined) setSetting('store_name', store_name);
  if (is_open !== undefined) setSetting('is_open', toBool(is_open) ? '1' : '0');
  if (delivery_fee !== undefined) setSetting('delivery_fee', delivery_fee);
  if (open_hours !== undefined) setSetting('open_hours', open_hours);
  if (qris_image !== undefined) setSetting('qris_image', qris_image);
  if (available_buildings !== undefined) setSetting('available_buildings', available_buildings);
  if (allow_qris !== undefined) setSetting('allow_qris', toBool(allow_qris) ? '1' : '0');
  if (allow_cod !== undefined) setSetting('allow_cod', toBool(allow_cod) ? '1' : '0');
  if (egg_price !== undefined) setSetting('egg_price', parseInt(egg_price, 10) || 0);
  if (drink_temp_cold_price !== undefined) setSetting('drink_temp_cold_price', parseInt(drink_temp_cold_price, 10) || 0);
  if (egg_stock !== undefined) setSetting('egg_stock', Math.max(0, parseInt(egg_stock, 10) || 0));
  if (ice_stock !== undefined) setSetting('ice_stock', Math.max(0, parseInt(ice_stock, 10) || 0));
  if (auto_schedule !== undefined) setSetting('auto_schedule', toBool(auto_schedule) ? '1' : '0');
  if (schedule_open !== undefined && /^\d{2}:\d{2}$/.test(schedule_open)) setSetting('schedule_open', schedule_open);
  if (schedule_close !== undefined && /^\d{2}:\d{2}$/.test(schedule_close)) setSetting('schedule_close', schedule_close);
  res.json({ ok: true });
});

// --- Reports ---
router.get('/reports/excel', requireAuth, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Tanggal wajib diisi' });

  const orders = db.prepare(`SELECT * FROM orders WHERE date(created_at) = ? AND status != 'dibatalkan' ORDER BY created_at ASC`).all(date);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Laporan ' + date);
  
  worksheet.columns = [
    { header: 'ID Pesanan', key: 'order_code', width: 20 },
    { header: 'Waktu', key: 'time', width: 15 },
    { header: 'Pelanggan', key: 'customer', width: 25 },
    { header: 'Kamar', key: 'room', width: 25 },
    { header: 'Total (Rp)', key: 'total', width: 15 },
    { header: 'Profit (Rp)', key: 'profit', width: 15 },
    { header: 'Metode Bayar', key: 'payment', width: 15 },
    { header: 'Status Pesanan', key: 'status', width: 15 },
  ];

  let totalOmzet = 0;
  let totalProfit = 0;

  for (const o of orders) {
    const items = db.prepare('SELECT SUM(qty * cost_snapshot) AS cost FROM order_items WHERE order_id = ?').get(o.id);
    const cost = items ? items.cost || 0 : 0;
    const profit = o.total - cost;

    totalOmzet += o.total;
    totalProfit += profit;

    worksheet.addRow({
      order_code: o.order_code,
      time: new Date(o.created_at).toLocaleTimeString('id-ID'),
      customer: o.customer_name,
      room: o.room,
      total: o.total,
      profit: profit,
      payment: o.payment_method.toUpperCase(),
      status: o.status
    });
  }

  worksheet.addRow({});
  worksheet.addRow({ room: 'TOTAL KESELURUHAN', total: totalOmzet, profit: totalProfit });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Laporan_AsramaFood_${date}.xlsx"`);
  
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/reports/pdf', requireAuth, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Tanggal wajib diisi' });

  const orders = db.prepare(`SELECT * FROM orders WHERE date(created_at) = ? AND status != 'dibatalkan' ORDER BY created_at ASC`).all(date);

  let totalOmzet = 0;
  let totalProfit = 0;

  const doc = new PDFDocument({ margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Laporan_AsramaFood_${date}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text('Laporan Harian AsramaFood', { align: 'center' });
  doc.fontSize(12).text(`Tanggal: ${date}`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(10);
  const tableTop = 100;
  let y = tableTop;

  // Header
  doc.font('Helvetica-Bold');
  doc.text('ID Pesanan', 30, y);
  doc.text('Pelanggan', 130, y);
  doc.text('Kamar', 250, y);
  doc.text('Omzet', 370, y);
  doc.text('Profit', 450, y);
  doc.text('Status', 510, y);
  y += 20;

  doc.font('Helvetica');
  for (const o of orders) {
    const items = db.prepare('SELECT SUM(qty * cost_snapshot) AS cost FROM order_items WHERE order_id = ?').get(o.id);
    const cost = items ? items.cost || 0 : 0;
    const profit = o.total - cost;

    totalOmzet += o.total;
    totalProfit += profit;

    doc.text(o.order_code, 30, y);
    doc.text(o.customer_name, 130, y, { width: 110, height: 15, lineBreak: false });
    doc.text(o.room, 250, y, { width: 110, height: 15, lineBreak: false });
    doc.text(o.total.toLocaleString('id-ID'), 370, y);
    doc.text(profit.toLocaleString('id-ID'), 450, y);
    doc.text(o.status, 510, y);

    y += 20;
    if (y > 700) {
      doc.addPage();
      y = 30;
    }
  }

  doc.moveDown();
  y += 10;
  doc.font('Helvetica-Bold');
  doc.text('TOTAL OMZET:', 30, y);
  doc.text('Rp ' + totalOmzet.toLocaleString('id-ID'), 150, y);
  y += 15;
  doc.text('TOTAL PROFIT:', 30, y);
  doc.text('Rp ' + totalProfit.toLocaleString('id-ID'), 150, y);

  doc.end();
});

// ---------------------------------------------------------------------------
// --- Update dari GitHub ----------------------------------------------------
// ---------------------------------------------------------------------------

const GITHUB_REPO = 'hudmail/AsramaFood';
const GITHUB_BRANCH = 'main';
const VERSION_FILE = path.join(__dirname, '..', 'VERSION');
const APP_ROOT = path.join(__dirname, '..');

// File/folder yang TIDAK boleh ditimpa saat update (data pengguna tetap aman)
const PRESERVE_PATHS = [
  'data',
  'public/uploads',
  '.env',
  'node_modules',
  'VERSION',       // ditulis terpisah setelah update selesai
  '.git',
];

function readCurrentVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
  } catch {
    return 'unknown';
  }
}

// Cek update: bandingkan SHA lokal vs SHA terbaru di GitHub
router.get('/update/check', requireOwner, async (req, res) => {
  try {
    const currentVersion = readCurrentVersion();

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AsramaFood-Updater',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Gagal mengambil info dari GitHub: ${response.status} — ${errText}` });
    }

    const data = await response.json();
    const latestSha = data.sha;
    const latestMessage = data.commit?.message || '';
    const latestDate = data.commit?.committer?.date || data.commit?.author?.date || '';

    res.json({
      current_version: currentVersion,
      latest_sha: latestSha,
      latest_message: latestMessage,
      latest_date: latestDate,
      has_update: currentVersion !== latestSha,
    });
  } catch (err) {
    console.error('[update/check] Error:', err);
    res.status(500).json({ error: 'Gagal mengecek pembaruan: ' + (err.message || 'Unknown error') });
  }
});

// Apply update: download tarball, extract, overwrite files, restart
router.post('/update/apply', requireOwner, async (req, res) => {
  const { execSync } = require('child_process');

  try {
    // 1. Ambil SHA terbaru dulu
    const checkResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/${GITHUB_BRANCH}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AsramaFood-Updater',
        },
      }
    );
    if (!checkResp.ok) {
      return res.status(502).json({ error: `Gagal mengambil info dari GitHub: ${checkResp.status}` });
    }
    const commitData = await checkResp.json();
    const latestSha = commitData.sha;

    const currentVersion = readCurrentVersion();
    if (currentVersion === latestSha) {
      return res.json({ ok: true, message: 'Sudah versi terbaru, tidak perlu update.' });
    }

    // 2. Buat backup sederhana (VERSION lama + timestamp)
    const backupDir = path.join(APP_ROOT, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `pre-update-${timestamp}.txt`);
    fs.writeFileSync(backupFile, `Update from ${currentVersion} to ${latestSha}\nTimestamp: ${new Date().toISOString()}\n`);

    // 3. Download tarball
    const tarballUrl = `https://api.github.com/repos/${GITHUB_REPO}/tarball/${GITHUB_BRANCH}`;
    const tarResp = await fetch(tarballUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AsramaFood-Updater',
      },
      redirect: 'follow',
    });

    if (!tarResp.ok) {
      return res.status(502).json({ error: `Gagal mengunduh update: ${tarResp.status}` });
    }

    // 4. Simpan tarball ke temp file
    const tmpDir = path.join(APP_ROOT, 'data', '_update_tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const tarballPath = path.join(tmpDir, 'update.tar.gz');
    const arrayBuffer = await tarResp.arrayBuffer();
    fs.writeFileSync(tarballPath, Buffer.from(arrayBuffer));

    // 5. Extract tarball
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`tar -xzf "${tarballPath}" -C "${extractDir}"`, { stdio: 'pipe' });

    // GitHub tarball extracts to a folder like "hudmail-AsramaFood-abc1234/"
    const extractedContents = fs.readdirSync(extractDir);
    const repoDir = extractedContents.find(d =>
      fs.statSync(path.join(extractDir, d)).isDirectory()
    );
    if (!repoDir) {
      throw new Error('Gagal mengekstrak update — folder repo tidak ditemukan');
    }
    const sourceDir = path.join(extractDir, repoDir);

    // 6. Salin file-file baru (kecuali yang di-preserve)
    function shouldPreserve(relativePath) {
      return PRESERVE_PATHS.some(p =>
        relativePath === p || relativePath.startsWith(p + '/')  || relativePath.startsWith(p + '\\')
      );
    }

    function copyRecursive(src, dest, relBase) {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relativePath = relBase ? `${relBase}/${entry.name}` : entry.name;

        if (shouldPreserve(relativePath)) continue;

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath, relativePath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyRecursive(sourceDir, APP_ROOT, '');

    // 7. Jalankan npm install jika package.json berubah
    try {
      const newPkg = fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf-8');
      const oldPkg = fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf-8');
      // Bandingkan dependencies saja
      const newDeps = JSON.parse(newPkg).dependencies || {};
      const oldDeps = JSON.parse(oldPkg).dependencies || {};
      if (JSON.stringify(newDeps) !== JSON.stringify(oldDeps)) {
        console.log('[update] package.json dependencies berubah, menjalankan npm install...');
        execSync('npm install --omit=dev', { cwd: APP_ROOT, stdio: 'pipe', timeout: 120000 });
      }
    } catch (npmErr) {
      console.warn('[update] npm install warning:', npmErr.message);
      // Lanjut saja, tidak fatal
    }

    // 8. Tulis VERSION baru
    fs.writeFileSync(VERSION_FILE, latestSha + '\n');

    // 9. Bersihkan temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }

    console.log(`[update] Berhasil update dari ${currentVersion.slice(0, 7)} ke ${latestSha.slice(0, 7)}`);

    // 10. Kirim response sebelum restart
    res.json({
      ok: true,
      message: `Update berhasil! Versi baru: ${latestSha.slice(0, 7)}. Server akan restart...`,
      new_version: latestSha,
    });

    // 11. Restart server setelah response terkirim
    setTimeout(() => {
      console.log('[update] Restarting server...');
      process.exit(0); // PM2/Docker/systemd akan restart otomatis
    }, 1500);

  } catch (err) {
    console.error('[update/apply] Error:', err);

    // Bersihkan temp files jika error
    const tmpDir = path.join(APP_ROOT, 'data', '_update_tmp');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    res.status(500).json({ error: 'Gagal menginstal pembaruan: ' + (err.message || 'Unknown error') });
  }
});

module.exports = router;
