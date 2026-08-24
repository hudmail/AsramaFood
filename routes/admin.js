const express = require('express');
const bcrypt = require('bcryptjs');
const { db, getSetting, setSetting } = require('../db');
const { requireAuth, requireOwner, loginRateLimit } = require('../middleware/auth');

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
      items.forEach((it) => {
        if (it.menu_item_id) restoreStock.run(it.qty, it.menu_item_id);
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

router.post('/menu', requireAuth, (req, res) => {
  const { name, description = '', price, cost_price = 0, stock = 0, category_id = null, image = null, is_available = 1 } = req.body || {};
  if (!name || !price) return res.status(400).json({ error: 'Nama & harga wajib diisi' });
  if (image && !String(image).startsWith('data:image/')) return res.status(400).json({ error: 'Gambar tidak valid' });
  if (image && image.length > 2.5 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran gambar terlalu besar (maksimal 2MB)' });

  const result = db
    .prepare(
      `INSERT INTO menu_items (category_id, name, description, price, cost_price, stock, is_available, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(category_id, name, description, price, cost_price, stock, is_available ? 1 : 0, image);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/menu/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Menu tidak ditemukan' });

  const {
    name = existing.name,
    description = existing.description,
    price = existing.price,
    cost_price = existing.cost_price,
    stock = existing.stock,
    category_id = existing.category_id,
    image = existing.image,
    is_available = existing.is_available,
  } = req.body || {};

  if (req.body.image !== undefined) {
    if (req.body.image && !String(req.body.image).startsWith('data:image/')) return res.status(400).json({ error: 'Gambar tidak valid' });
    if (req.body.image && req.body.image.length > 2.5 * 1024 * 1024) return res.status(400).json({ error: 'Ukuran gambar terlalu besar (maksimal 2MB)' });
  }

  db.prepare(
    `UPDATE menu_items SET name = ?, description = ?, price = ?, cost_price = ?, stock = ?, category_id = ?, image = ?, is_available = ?
     WHERE id = ?`
  ).run(name, description, price, cost_price, stock, category_id, image, is_available ? 1 : 0, req.params.id);

  res.json({ ok: true });
});

// Hapus menu bersifat destruktif (data lama di riwayat pesanan tetap aman lewat snapshot,
// tapi menu itu sendiri hilang) -> dibatasi untuk owner saja.
router.delete('/menu/:id', requireOwner, (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
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
  });
});

// Pengaturan toko (jam buka, ongkir, metode pembayaran, gambar QRIS, dll)
// adalah keputusan level pemilik usaha -> dibatasi untuk owner saja.
router.put('/settings', requireOwner, (req, res) => {
  const { store_name, is_open, delivery_fee, open_hours, qris_image, available_buildings, allow_qris, allow_cod } = req.body || {};
  if (qris_image !== undefined && qris_image !== '' && !String(qris_image).startsWith('data:image/')) {
    return res.status(400).json({ error: 'Gambar QRIS tidak valid' });
  }
  if (store_name !== undefined) setSetting('store_name', store_name);
  if (is_open !== undefined) setSetting('is_open', is_open ? '1' : '0');
  if (delivery_fee !== undefined) setSetting('delivery_fee', delivery_fee);
  if (open_hours !== undefined) setSetting('open_hours', open_hours);
  if (qris_image !== undefined) setSetting('qris_image', qris_image);
  if (available_buildings !== undefined) setSetting('available_buildings', available_buildings);
  if (allow_qris !== undefined) setSetting('allow_qris', allow_qris ? '1' : '0');
  if (allow_cod !== undefined) setSetting('allow_cod', allow_cod ? '1' : '0');
  res.json({ ok: true });
});

module.exports = router;
