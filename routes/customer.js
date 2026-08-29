const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, getSetting, setSetting, isStoreOpen, appEvents } = require('../db');

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
// Batasi ukuran (5MB) dan hanya terima gambar - lihat catatan yang sama di routes/admin.js
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

const orderRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Terlalu banyak pesanan, silakan coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function todayCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Kode pesanan tetap dimulai dengan tanggal (biar gampang dibaca admin),
// tapi bagian akhirnya diacak (bukan nomor urut 0001, 0002, ...) supaya
// pelanggan lain tidak bisa menebak/mengiterasi kode pesanan orang lain
// dan melihat data pribadinya (nama, no. WhatsApp, bukti transfer, dst).
function randomSuffix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I biar tidak rancu
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function nextOrderCode() {
  const ymd = todayCode();
  const prefix = `AF-${ymd}-`;
  // coba beberapa kali kalau (sangat jarang) terjadi tabrakan kode acak
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${prefix}${randomSuffix()}`;
    const exists = db.prepare('SELECT 1 FROM orders WHERE order_code = ?').get(code);
    if (!exists) return code;
  }
  // fallback super jarang: tambahkan timestamp biar pasti unik
  return `${prefix}${randomSuffix()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

router.get('/settings/public', (req, res) => {
  res.json({
    store_name: getSetting('store_name', 'AsramaFood'),
    is_open: isStoreOpen(),
    delivery_fee: parseInt(getSetting('delivery_fee', '0'), 10),
    open_hours: getSetting('open_hours', ''),
    qris_image: getSetting('qris_image', ''),
    available_buildings: getSetting('available_buildings', 'Gedung 2'),
    allow_qris: getSetting('allow_qris', '1') === '1',
    allow_cod: getSetting('allow_cod', '1') === '1',
    egg_price: parseInt(getSetting('egg_price', '3000'), 10),
    drink_temp_cold_price: parseInt(getSetting('drink_temp_cold_price', '1000'), 10),
    egg_stock: parseInt(getSetting('egg_stock', '0'), 10),
    ice_stock: parseInt(getSetting('ice_stock', '0'), 10),
  });
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM categories ORDER BY sort_order, name').all();
  res.json(rows);
});

router.get('/menu', (req, res) => {
  const { search = '', category = '' } = req.query;
  let sql = `
    SELECT m.id, m.name, m.description, m.price, m.discount_price, m.is_discount, m.stock, m.is_available, m.image_emoji, m.image, m.sold_count, m.allow_egg, m.allow_ice,
           c.id AS category_id, c.name AS category_name
    FROM menu_items m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE m.is_available = 1
  `;
  const params = [];
  if (search) {
    sql += ' AND m.name LIKE ?';
    params.push(`%${search}%`);
  }
  if (category) {
    sql += ' AND c.id = ?';
    params.push(category);
  }
  sql += ' ORDER BY c.sort_order, m.name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Menu terlaris: diurutkan dari jumlah terjual (sold_count) terbanyak.
// sold_count bertambah tiap kali menu itu berhasil dipesan (lihat POST /orders).
router.get('/menu/terlaris', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 6, 20);
  const rows = db
    .prepare(
      `SELECT m.id, m.name, m.description, m.price, m.discount_price, m.is_discount, m.stock, m.is_available, m.image_emoji, m.image, m.sold_count, m.allow_egg, m.allow_ice,
              c.id AS category_id, c.name AS category_name
       FROM menu_items m
       LEFT JOIN categories c ON c.id = m.category_id
       WHERE m.is_available = 1 AND m.sold_count > 0
       ORDER BY m.sold_count DESC, m.name
       LIMIT ?`
    )
    .all(limit);
  res.json(rows);
});

router.post('/orders', orderRateLimit, (req, res) => {
  const { customer_name, room, whatsapp, note, method, payment_method = 'qris', items } = req.body || {};

  if (!customer_name || !room || !method || !whatsapp || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Data pesanan tidak lengkap (Nama, WhatsApp, dll wajib diisi)' });
  }
  if (!['antar', 'ambil'].includes(method)) {
    return res.status(400).json({ error: 'Metode pengambilan tidak valid' });
  }
  if (!['qris', 'cod'].includes(payment_method)) {
    return res.status(400).json({ error: 'Metode pembayaran tidak valid' });
  }
  if (payment_method === 'cod' && method !== 'antar') {
    return res.status(400).json({ error: 'COD hanya tersedia untuk pesanan antar' });
  }
  if (payment_method === 'qris' && getSetting('allow_qris', '1') !== '1') {
    return res.status(400).json({ error: 'Metode pembayaran QRIS sedang tidak tersedia' });
  }
  if (payment_method === 'cod' && getSetting('allow_cod', '1') !== '1') {
    return res.status(400).json({ error: 'Metode pembayaran COD sedang tidak tersedia' });
  }
  if (!isStoreOpen()) {
    return res.status(400).json({ error: 'Toko sedang tutup, coba lagi nanti' });
  }

  const tx = db.transaction(() => {
    let subtotal = 0;
    const resolvedItems = [];

    const eggPrice = parseInt(getSetting('egg_price', '3000'), 10);
    const drinkColdPrice = parseInt(getSetting('drink_temp_cold_price', '1000'), 10);
    const currentEggStock = parseInt(getSetting('egg_stock', '0'), 10);
    const currentIceStock = parseInt(getSetting('ice_stock', '0'), 10);
    let totalEggsNeeded = 0; // akumulasi telur yang dibutuhkan seluruh item order ini
    let totalIceNeeded = 0;  // akumulasi es batu yang dibutuhkan seluruh item order ini

    for (const it of items) {
      const menuItem = db.prepare('SELECT m.*, c.name AS category_name FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id WHERE m.id = ? AND m.is_available = 1').get(it.menu_item_id);
      if (!menuItem) throw new Error(`Menu tidak ditemukan atau tidak tersedia`);
      const qty = parseInt(it.qty, 10);
      if (!qty || qty < 1) throw new Error(`Jumlah tidak valid untuk ${menuItem.name}`);
      if (menuItem.stock < qty) throw new Error(`Stok ${menuItem.name} tidak cukup (sisa ${menuItem.stock})`);

      // Kalau menu sedang diskon, pelanggan dikenai harga diskon, bukan harga normal.
      const effectivePrice = menuItem.is_discount && menuItem.discount_price ? menuItem.discount_price : menuItem.price;

      // --- Hitung harga opsi tambahan ---
      const catName = (menuItem.category_name || '').toLowerCase();
      const isMinuman = catName === 'minuman';

      let addonPrice = 0;
      const addonLabels = [];

      // Opsi +Telur: hanya kalau item punya allow_egg = 1 (dikonfigurasi per menu di admin)
      if (menuItem.allow_egg && it.add_egg) {
        // Hitung kebutuhan telur (1 telur per qty item)
        totalEggsNeeded += qty;
        addonPrice += eggPrice;
        addonLabels.push(`+Telur (+Rp ${eggPrice.toLocaleString('id-ID')})`);
      }

      // Opsi Panas/Dingin (hanya untuk minuman yang allow_ice = 1)
      if (isMinuman && menuItem.allow_ice && it.temp) {
        if (it.temp === 'dingin') {
          // Hitung kebutuhan es batu (1 porsi per qty item)
          totalIceNeeded += qty;
          addonPrice += drinkColdPrice;
          addonLabels.push(`Es/Dingin (+Rp ${drinkColdPrice.toLocaleString('id-ID')})`);
        } else {
          addonLabels.push('Panas');
        }
      }

      const unitPrice = effectivePrice + addonPrice;
      const lineSubtotal = unitPrice * qty;
      subtotal += lineSubtotal;

      // Nama snapshot mencakup opsi yang dipilih agar admin bisa melihatnya
      const nameSnapshot = addonLabels.length > 0
        ? `${menuItem.name} [${addonLabels.join(', ')}]`
        : menuItem.name;

      resolvedItems.push({ menuItem, qty, lineSubtotal, effectivePrice: unitPrice, nameSnapshot });
    }

    // Validasi stok telur setelah semua item dihitung
    if (totalEggsNeeded > 0 && currentEggStock < totalEggsNeeded) {
      const sisaStok = currentEggStock <= 0 ? 'habis' : `sisa ${currentEggStock} butir`;
      throw new Error(`Stok telur tidak cukup (${sisaStok}), tidak bisa tambah telur untuk semua item`);
    }

    // Validasi stok es batu setelah semua item dihitung
    if (totalIceNeeded > 0 && currentIceStock < totalIceNeeded) {
      const sisaStok = currentIceStock <= 0 ? 'habis' : `sisa ${currentIceStock} porsi`;
      throw new Error(`Stok es batu tidak cukup (${sisaStok}), tidak bisa pesan minuman dingin untuk semua item`);
    }

    const deliveryFee = method === 'antar' ? parseInt(getSetting('delivery_fee', '0'), 10) : 0;
    const total = subtotal + deliveryFee;
    const orderCode = nextOrderCode();

    const orderResult = db
      .prepare(
        `INSERT INTO orders (order_code, customer_name, room, whatsapp, note, method, payment_method, delivery_fee, subtotal, total, status, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(orderCode, customer_name, room, whatsapp || '', note || '', method, payment_method, deliveryFee, subtotal, total, 'menunggu_pembayaran');

    const orderId = orderResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, cost_snapshot, qty, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const decrementStock = db.prepare('UPDATE menu_items SET stock = stock - ? WHERE id = ?');
    const incrementSold = db.prepare('UPDATE menu_items SET sold_count = sold_count + ? WHERE id = ?');

    for (const { menuItem, qty, lineSubtotal, effectivePrice, nameSnapshot } of resolvedItems) {
      insertItem.run(orderId, menuItem.id, nameSnapshot, effectivePrice, menuItem.cost_price || 0, qty, lineSubtotal);
      decrementStock.run(qty, menuItem.id);
      incrementSold.run(qty, menuItem.id);
    }

    // Kurangi stok telur global sesuai total telur yang dipesan
    if (totalEggsNeeded > 0) {
      setSetting('egg_stock', Math.max(0, currentEggStock - totalEggsNeeded));
    }

    // Kurangi stok es batu global sesuai total es yang dipesan
    if (totalIceNeeded > 0) {
      setSetting('ice_stock', Math.max(0, currentIceStock - totalIceNeeded));
    }

    return { orderId, orderCode, total };
  });

  try {
    const result = tx();
    // Beritahu dashboard admin via SSE
    appEvents.emit('new_order', {
      order_code: result.orderCode,
      customer_name: customer_name,
      total: result.total
    });
    res.status(201).json({ order_code: result.orderCode, total: result.total });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Gagal membuat pesanan' });
  }
});

router.get('/orders/:code', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_code = ?').get(req.params.code);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

router.post('/orders/:code/bukti-bayar', uploadOne('proof_image'), (req, res) => {
  const { code } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE order_code = ?').get(code);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.status === 'dibatalkan') {
    return res.status(400).json({ error: 'Pesanan ini sudah dibatalkan' });
  }
  if (order.payment_status === 'dibayar') {
    return res.status(400).json({ error: 'Pesanan ini sudah dikonfirmasi terbayar' });
  }

  const proof_image = req.file ? `/uploads/${req.file.filename}` : req.body.proof_image;
  if (!proof_image) return res.status(400).json({ error: 'Bukti transfer wajib disertakan' });

  if (req.file && order.payment_proof && order.payment_proof.startsWith('/uploads/') && order.payment_proof !== proof_image) {
    fs.unlink(path.join(__dirname, '../public', order.payment_proof), () => {});
  }

  db.prepare(`UPDATE orders SET payment_proof = ?, payment_status = 'menunggu_konfirmasi', updated_at = datetime('now') WHERE id = ?`).run(proof_image, order.id);

  appEvents.emit('payment_uploaded', {
    order_code: order.order_code,
    customer_name: order.customer_name
  });

  res.json({ ok: true });
});

module.exports = router;
