const express = require('express');
const { db, getSetting } = require('../db');

const router = express.Router();

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
    is_open: getSetting('is_open', '1') === '1',
    delivery_fee: parseInt(getSetting('delivery_fee', '0'), 10),
    open_hours: getSetting('open_hours', ''),
    qris_image: getSetting('qris_image', ''),
    available_buildings: getSetting('available_buildings', 'Gedung 2'),
    allow_qris: getSetting('allow_qris', '1') === '1',
    allow_cod: getSetting('allow_cod', '1') === '1',
  });
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM categories ORDER BY sort_order, name').all();
  res.json(rows);
});

router.get('/menu', (req, res) => {
  const { search = '', category = '' } = req.query;
  let sql = `
    SELECT m.id, m.name, m.description, m.price, m.stock, m.is_available, m.image_emoji, m.image,
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

router.post('/orders', (req, res) => {
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
  if (getSetting('is_open', '1') !== '1') {
    return res.status(400).json({ error: 'Toko sedang tutup, coba lagi nanti' });
  }

  const tx = db.transaction(() => {
    let subtotal = 0;
    const resolvedItems = [];

    for (const it of items) {
      const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND is_available = 1').get(it.menu_item_id);
      if (!menuItem) throw new Error(`Menu tidak ditemukan atau tidak tersedia`);
      const qty = parseInt(it.qty, 10);
      if (!qty || qty < 1) throw new Error(`Jumlah tidak valid untuk ${menuItem.name}`);
      if (menuItem.stock < qty) throw new Error(`Stok ${menuItem.name} tidak cukup (sisa ${menuItem.stock})`);

      const lineSubtotal = menuItem.price * qty;
      subtotal += lineSubtotal;
      resolvedItems.push({ menuItem, qty, lineSubtotal });
    }

    const deliveryFee = method === 'antar' ? parseInt(getSetting('delivery_fee', '0'), 10) : 0;
    const total = subtotal + deliveryFee;
    const orderCode = nextOrderCode();

    const orderResult = db
      .prepare(
        `INSERT INTO orders (order_code, customer_name, room, whatsapp, note, method, payment_method, delivery_fee, subtotal, total, status, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(orderCode, customer_name, room, whatsapp || '', note || '', method, payment_method, deliveryFee, subtotal, total, payment_method === 'cod' ? 'menunggu_pembayaran' : 'menunggu_pembayaran');

    const orderId = orderResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, name_snapshot, price_snapshot, cost_snapshot, qty, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const decrementStock = db.prepare('UPDATE menu_items SET stock = stock - ? WHERE id = ?');

    for (const { menuItem, qty, lineSubtotal } of resolvedItems) {
      insertItem.run(orderId, menuItem.id, menuItem.name, menuItem.price, menuItem.cost_price || 0, qty, lineSubtotal);
      decrementStock.run(qty, menuItem.id);
    }

    return { orderId, orderCode, total };
  });

  try {
    const result = tx();
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

router.post('/orders/:code/bukti-bayar', (req, res) => {
  const { proof_image } = req.body || {};
  if (!proof_image || !proof_image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Bukti transfer harus berupa gambar' });
  }
  // batas kasar ~4MB base64 supaya tidak membengkakkan database
  if (proof_image.length > 5.5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Ukuran gambar terlalu besar, coba kompres dulu' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE order_code = ?').get(req.params.code);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.status === 'dibatalkan') {
    return res.status(400).json({ error: 'Pesanan ini sudah dibatalkan' });
  }
  if (order.payment_status === 'dibayar') {
    return res.status(400).json({ error: 'Pesanan ini sudah dikonfirmasi terbayar' });
  }

  db.prepare(
    `UPDATE orders SET payment_proof = ?, payment_status = 'menunggu_konfirmasi', updated_at = datetime('now') WHERE id = ?`
  ).run(proof_image, order.id);

  res.json({ ok: true });
});

module.exports = router;
