const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/kiosk/scan — Catat kehadiran & ambil data
router.post('/scan', (req, res) => {
  try {
    const { nis } = req.body;
    if (!nis) return res.status(400).json({ status: 'error', message: 'Kartu tidak valid' });

    const anggota = db.prepare('SELECT id, nis, nama, kelas, jenis, status FROM anggota WHERE nis = ?').get(nis);
    if (!anggota) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });
    if (anggota.status !== 'aktif') return res.status(403).json({ status: 'error', message: 'Anggota nonaktif' });

    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toLocaleString('sv').replace('T', ' ');

    // 1. Catat Kunjungan (Buku Tamu)
    const kunjungan = db.prepare('SELECT id FROM kunjungan WHERE anggota_id = ? AND tanggal = ?').get(anggota.id, today);
    if (!kunjungan) {
      db.prepare('INSERT INTO kunjungan (anggota_id, tanggal, jam_masuk, tujuan) VALUES (?, ?, ?, ?)').run(anggota.id, today, now, 'baca');
    }

    // 2. Ambil Pinjaman Aktif
    const pinjamanAktif = db.prepare(`
      SELECT p.kode_pinjam, p.tanggal_jatuh, 
             (SELECT GROUP_CONCAT(b.judul, ', ') FROM peminjaman_detail pd JOIN buku b ON b.id = pd.buku_id WHERE pd.peminjaman_id = p.id) as buku
      FROM peminjaman p
      WHERE p.anggota_id = ? AND p.status IN ('dipinjam', 'sebagian')
    `).all(anggota.id);

    // 3. Cek Bebas Pustaka (Khusus Buku Paket)
    const paket = db.prepare(`
      SELECT SUM(pd.jumlah) AS total_pinjam,
             SUM(CASE WHEN pd.status = 'dikembalikan' THEN pd.jumlah ELSE 0 END) AS total_kembali
      FROM peminjaman_detail pd
      JOIN peminjaman p ON p.id = pd.peminjaman_id
      JOIN buku b ON b.id = pd.buku_id
      WHERE p.anggota_id = ? AND b.kategori = 'Paket'
    `).get(anggota.id);
    
    const sisaPaket = (paket.total_pinjam || 0) - (paket.total_kembali || 0);
    const bebasPustaka = sisaPaket === 0;

    res.json({
      status: 'ok',
      anggota,
      pinjamanAktif,
      bebasPustaka,
      sisaPaket,
      waktu: now.split(' ')[1]
    });

  } catch (err) {
    console.error('Kiosk Scan Error:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// GET /api/kiosk/buku — Cari stok buku
router.get('/buku', (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ status: 'ok', data: [] });

    const rows = db.prepare(`
      SELECT kode_buku, judul, penulis, kategori, stok_tersedia, lokasi_rak 
      FROM buku 
      WHERE judul LIKE ? OR penulis LIKE ? OR kode_buku LIKE ?
      LIMIT 10
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);

    res.json({ status: 'ok', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;