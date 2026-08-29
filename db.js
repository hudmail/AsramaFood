const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // bawaan Node.js, tanpa native build
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'asrama-food.sqlite'));
db.exec('PRAGMA journal_mode = WAL;');
// foreign key constraints sudah aktif secara default di node:sqlite

// Helper transaksi sederhana (node:sqlite belum punya db.transaction() bawaan seperti better-sqlite3)
db.transaction = function makeTransaction(fn) {
  return function runInTransaction(...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        /* ignore rollback failure */
      }
      throw err;
    }
  };
};

db.exec(`
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'kasir', -- owner | kasir
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  cost_price INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0,
  is_available INTEGER DEFAULT 1,
  image_emoji TEXT DEFAULT '🍽️',
  image TEXT,
  allow_egg INTEGER DEFAULT 0, -- 1 = pelanggan bisa pilih +Telur
  allow_ice INTEGER DEFAULT 0, -- 1 = pelanggan bisa pilih Es/Dingin (khusus minuman)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  room TEXT NOT NULL,
  whatsapp TEXT,
  note TEXT DEFAULT '',
  method TEXT NOT NULL DEFAULT 'antar', -- antar | ambil
  delivery_fee INTEGER DEFAULT 0,
  subtotal INTEGER NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | diproses | siap | diantar | selesai | dibatalkan
  payment_method TEXT NOT NULL DEFAULT 'qris', -- qris | cod
  payment_status TEXT NOT NULL DEFAULT 'menunggu_pembayaran', -- menunggu_pembayaran | menunggu_konfirmasi | dibayar | ditolak
  payment_proof TEXT, -- data URI foto bukti transfer dari pelanggan
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  cost_snapshot INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL,
  subtotal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// --- migrasi ringan untuk database lama yang belum punya kolom pembayaran atau gambar ---
const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
if (!orderColumns.includes('payment_method')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'qris'`);
}
if (!orderColumns.includes('payment_status')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'menunggu_pembayaran'`);
}
if (!orderColumns.includes('payment_proof')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_proof TEXT`);
}
if (!orderColumns.includes('paid_at')) {
  db.exec(`ALTER TABLE orders ADD COLUMN paid_at TEXT`);
}

const menuColumns = db.prepare("PRAGMA table_info(menu_items)").all().map((c) => c.name);
if (!menuColumns.includes('image')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN image TEXT`);
}
if (!menuColumns.includes('cost_price')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN cost_price INTEGER DEFAULT 0`);
}
if (!menuColumns.includes('discount_price')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN discount_price INTEGER`);
}
if (!menuColumns.includes('is_discount')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN is_discount INTEGER NOT NULL DEFAULT 0`);
}
if (!menuColumns.includes('sold_count')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN sold_count INTEGER NOT NULL DEFAULT 0`);
}
if (!menuColumns.includes('allow_egg')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN allow_egg INTEGER NOT NULL DEFAULT 0`);
}
if (!menuColumns.includes('allow_ice')) {
  db.exec(`ALTER TABLE menu_items ADD COLUMN allow_ice INTEGER NOT NULL DEFAULT 0`);
}
const orderItemColumns = db.prepare("PRAGMA table_info(order_items)").all().map((c) => c.name);
if (!orderItemColumns.includes('cost_snapshot')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN cost_snapshot INTEGER NOT NULL DEFAULT 0`);
}

// --- auto seed on first run ---
const userCount = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
if (userCount === 0) {
  const defaultPass = process.env.ADMIN_DEFAULT_PASSWORD || 'ganti-password-ini';
  const hash = bcrypt.hashSync(defaultPass, 10);
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('owner', hash, 'owner');
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('kasir', hash, 'kasir');
  console.log(`[seed] Akun admin dibuat -> owner/kasir, password default: "${defaultPass}"`);
}

const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
if (catCount === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
  const cats = ['Makanan', 'Minuman', 'Snack'];
  cats.forEach((name, i) => insertCat.run(name, i));

  const catRows = db.prepare('SELECT id, name FROM categories').all();
  const catId = (name) => catRows.find((c) => c.name === name).id;

  const insertItem = db.prepare(`
    INSERT INTO menu_items (category_id, name, description, price, cost_price, stock, is_available, image_emoji, image)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const sample = [
    ['Makanan', 'Nasi Goreng', 'Nasi goreng telur + kerupuk', 15000, 10000, 20, '🍛'],
    ['Makanan', 'Mie Goreng', 'Mie goreng spesial', 13000, 8000, 20, '🍜'],
    ['Makanan', 'Ayam Geprek', 'Ayam geprek sambal + nasi', 17000, 12000, 15, '🍗'],
    ['Minuman', 'Es Teh Manis', 'Teh manis dingin', 5000, 2000, 30, '🧊'],
    ['Minuman', 'Es Jeruk', 'Jeruk peras segar', 6000, 3000, 30, '🍊'],
    ['Snack', 'Pisang Goreng', 'Pisang goreng crispy (5 pcs)', 8000, 5000, 10, '🍌'],
  ];
  sample.forEach(([cat, name, desc, price, cost_price, stock, emoji]) => {
    insertItem.run(catId(cat), name, desc, price, cost_price, stock, emoji, null);
  });
  console.log('[seed] Kategori & menu contoh dibuat');
}

const defaultSettings = {
  store_name: 'AsramaFood',
  is_open: '1',
  delivery_fee: '2000',
  open_hours: '07:00 - 21:00',
  qris_image: '',
  available_buildings: 'Gedung 2',
  allow_qris: '1',
  allow_cod: '1',
  egg_price: '3000',           // harga tambah telur (khusus kategori Makanan)
  drink_temp_cold_price: '1000', // surcharge minuman dingin (khusus kategori Minuman)
  egg_stock: '0',              // stok telur saat ini (0 = habis / tidak dicatat)
  ice_stock: '0',              // stok es batu saat ini (0 = habis / tidak tersedia)
  auto_schedule: '0',          // 1 = buka/tutup otomatis sesuai jadwal
  schedule_open: '07:00',      // jam buka otomatis (HH:MM)
  schedule_close: '21:00',     // jam tutup otomatis (HH:MM)
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
Object.entries(defaultSettings).forEach(([k, v]) => insertSetting.run(k, v));

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

/**
 * Mengembalikan status buka/tutup toko yang efektif.
 *
 * - Jika auto_schedule = '0' → gunakan nilai manual is_open.
 * - Jika auto_schedule = '1' → bandingkan jam sekarang (local time) dengan
 *   schedule_open & schedule_close. Mendukung jadwal yang melewati tengah malam
 *   (misal buka 22:00, tutup 02:00).
 */
function isStoreOpen() {
  const autoSchedule = getSetting('auto_schedule', '0') === '1';
  if (!autoSchedule) {
    return getSetting('is_open', '1') === '1';
  }

  const scheduleOpen  = getSetting('schedule_open',  '07:00');
  const scheduleClose = getSetting('schedule_close', '21:00');

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH,  openM]  = scheduleOpen.split(':').map(Number);
  const [closeH, closeM] = scheduleClose.split(':').map(Number);
  const openMinutes  = openH  * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes > openMinutes) {
    // Jadwal normal: buka & tutup di hari yang sama (misal 07:00 – 21:00)
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    // Jadwal melewati tengah malam (misal 22:00 – 02:00)
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
}

module.exports = { db, getSetting, setSetting, isStoreOpen };
