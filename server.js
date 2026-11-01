const express = require('express');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const auth = require('./middleware/auth');

// Routes
const authRouter       = require('./routes/auth');
const bukuRouter       = require('./routes/buku');
const anggotaRouter    = require('./routes/anggota');
const peminjamanRouter = require('./routes/peminjaman');
const laporanRouter    = require('./routes/laporan');
const pengaturanRouter = require('./routes/pengaturan');
const scanRouter       = require('./routes/scan');
const pengingatRouter  = require('./routes/pengingat');
const digitalRouter    = require('./routes/digital'); // Rute Baru
const portalRouter     = require('./routes/portal');

const app = express();

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.set('trust proxy', false);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PUBLIC_WHITELIST = ['/login.html', '/css/', '/js/', '/img/', '/vendor/'];
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) return next();
  return express.static(path.join(__dirname, 'public'))(req, res, next);
});

app.use(auth.checkCSRF);
app.use('/api/auth', authRouter);

// Rute API Publik (Wajib Login, tapi Siswa/Guru boleh akses)
app.use('/api/digital', auth.requireAuth, digitalRouter);
app.use('/api/portal', auth.requireAuth, portalRouter);

// Rute API Admin (Hanya Admin yang bisa akses API ini)
app.use('/api/buku',       auth.requireAdmin, bukuRouter);
app.use('/api/anggota',    auth.requireAdmin, anggotaRouter);
app.use('/api/peminjaman', auth.requireAdmin, peminjamanRouter);
app.use('/api/laporan',    auth.requireAdmin, laporanRouter);
app.use('/api/pengaturan', auth.requireAdmin, pengaturanRouter);
app.use('/api/scan',       auth.requireAdmin, scanRouter);
app.use('/api/pengingat',  auth.requireAdmin, pengingatRouter);

// Middleware Auth HTML (Memblokir akses /portal.html jika belum login)
app.use((req, res, next) => {
  if (req.path === '/login.html') return next();
  if (PUBLIC_WHITELIST.some(p => req.path.startsWith(p))) return next();
  return auth.requireAuth(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Server perpus jalan' });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message, err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// ================================================================
// CRON JOB — Auto Nonaktif Anggota
// ================================================================
function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function checkMasaAktifAnggota() {
  try {
    const today = getTodayStr();
    const info = db.prepare(`
      UPDATE anggota
      SET status = 'nonaktif', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'aktif'
        AND tanggal_aktif_sampai IS NOT NULL
        AND tanggal_aktif_sampai != ''
        AND tanggal_aktif_sampai < ?
    `).run(today);
    
    if (info.changes > 0) {
      console.log(`⏰ [CRON] ${info.changes} anggota dinonaktifkan otomatis karena masa aktif habis.`);
    }
  } catch (err) {
    console.error('❌ [CRON] Gagal update masa aktif:', err.message);
  }
}
checkMasaAktifAnggota();
setInterval(checkMasaAktifAnggota, 60 * 60 * 1000);

app.listen(PORT, HOST, () => {
  console.log('====================================');
  console.log(`✅ Server jalan di http://${HOST}:${PORT}`);
  console.log('====================================');
});