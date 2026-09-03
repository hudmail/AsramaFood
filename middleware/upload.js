const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Multer untuk file publik (gambar menu, QRIS) — disimpan di public/uploads/
// ---------------------------------------------------------------------------
const publicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Multer untuk file privat (bukti bayar pelanggan) — disimpan di data/uploads/proofs/
// (di luar public/, tidak bisa diakses langsung oleh browser)
const privateStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../data/uploads/proofs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filter: hanya terima file gambar — menangkal upload .html/.svg berisi script (stored-XSS)
const imageFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('File yang diupload harus berupa gambar'));
  }
  cb(null, true);
};

const uploadPublic = multer({
  storage: publicStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});

const uploadPrivate = multer({
  storage: privateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});

// Bungkus upload.single agar error dari multer (file terlalu besar, tipe salah)
// dikembalikan sebagai JSON 400, bukan nyangkut ke error handler generik (500).
function wrapUpload(multerInstance, fieldName) {
  const mw = multerInstance.single(fieldName);
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

/**
 * uploadPublicOne(fieldName) — untuk gambar menu & QRIS (dapat diakses publik)
 * uploadPrivateOne(fieldName) — untuk bukti bayar pelanggan (auth-protected)
 */
function uploadPublicOne(fieldName) {
  return wrapUpload(uploadPublic, fieldName);
}
function uploadPrivateOne(fieldName) {
  return wrapUpload(uploadPrivate, fieldName);
}

module.exports = { uploadPublicOne, uploadPrivateOne };
