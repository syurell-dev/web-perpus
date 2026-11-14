const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// SECURITY: Validasi magic bytes PDF (M3)
function isPdf(filePath) {
  const buf = Buffer.alloc(5);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  return buf.toString('ascii') === '%PDF-';
}

// Pastikan folder upload ada saat server start
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'buku');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('📁 Folder uploads/buku berhasil dibuat');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Hanya izinkan file PDF
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF yang diperbolehkan!'));
    }
  }
});

// GET /api/digital — List semua buku digital
router.get('/', (req, res) => {
  try {
    // Gunakan file_url
    const rows = db.prepare('SELECT * FROM buku_digital ORDER BY id DESC').all();
    res.json({ status: 'ok', data: rows });
  } catch (err) {
    console.error('GET Digital Error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// GET /api/digital/file/:id — Stream file PDF
router.get('/file/:id', (req, res) => {
  try {
    // Gunakan file_url
    const buku = db.prepare('SELECT file_url FROM buku_digital WHERE id = ?').get(req.params.id);
    if (!buku) return res.status(404).json({ status: 'error', message: 'Buku tidak ditemukan' });

    const filePath = path.join(__dirname, '..', 'public', buku.file_url);
    if (!fs.existsSync(filePath)) return res.status(404).json({ status: 'error', message: 'File fisik tidak ditemukan' });

    // SECURITY: Attachment headers (M3)
    const filename = path.basename(buku.file_url);
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// POST /api/digital — Upload buku baru (Khusus Admin)
router.post('/', (req, res) => {
  upload.single('file_pdf')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ status: 'error', message: `Upload gagal: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ status: 'error', message: `Server Error: ${err.message}` });
    }

    try {
      const { judul, penulis, kategori, deskripsi } = req.body;
      if (!req.file) return res.status(400).json({ status: 'error', message: 'File PDF wajib diupload' });
      if (!judul) return res.status(400).json({ status: 'error', message: 'Judul wajib diisi' });

      // SECURITY: Cek magic bytes (M3)
      if (!isPdf(req.file.path)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ status: 'error', message: 'File bukan PDF valid' });
      }

      // Gunakan file_url
      const file_url = '/uploads/buku/' + req.file.filename;

      db.prepare(`
        INSERT INTO buku_digital (judul, penulis, kategori, deskripsi, file_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(judul, penulis || null, kategori || null, deskripsi || null, file_url);

      res.status(201).json({ status: 'ok', message: 'Buku digital berhasil diupload' });
    } catch (err) {
      console.error('Upload Error:', err);
      res.status(500).json({ status: 'error', message: `Gagal menyimpan data ke database: ${err.message}` });
    }
  });
});

// DELETE /api/digital/:id — Hapus buku (Khusus Admin)
router.delete('/:id', (req, res) => {
  try {
    // Gunakan file_url
    const buku = db.prepare('SELECT file_url FROM buku_digital WHERE id = ?').get(req.params.id);
    if (!buku) return res.status(404).json({ status: 'error', message: 'Buku tidak ditemukan' });

    if (buku.file_url) {
      const filePath = path.join(__dirname, '..', 'public', buku.file_url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.error(`⚠️ Gagal hapus file fisik (mungkin terkunci): ${fileErr.message}`);
        }
      }
    }

    db.prepare('DELETE FROM buku_digital WHERE id = ?').run(req.params.id);
    
    res.json({ status: 'ok', message: 'Buku berhasil dihapus' });
  } catch (err) {
    console.error('DELETE Digital Error:', err);
    res.status(500).json({ status: 'error', message: `Server Error: ${err.message}` });
  }
});

module.exports = router;