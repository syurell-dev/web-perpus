const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/portal/stats — Statistik pribadi & Leaderboard
router.get('/stats', (req, res) => {
  try {
    const anggota_id = req.user.anggota_id; // Didapat dari session login

    let statsPribadi = null;
    if (anggota_id) {
      // Pinjaman Aktif
      const pinjamanAktif = db.prepare(`
        SELECT p.id, p.kode_pinjam, p.tanggal_pinjam, p.tanggal_jatuh, 
               (SELECT GROUP_CONCAT(b.judul, ', ') FROM peminjaman_detail pd JOIN buku b ON b.id = pd.buku_id WHERE pd.peminjaman_id = p.id) as buku
        FROM peminjaman p
        WHERE p.anggota_id = ? AND p.status IN ('dipinjam', 'sebagian')
      `).all(anggota_id);

      // Total Pernah Pinjam
      const totalPinjam = db.prepare(`
        SELECT COUNT(*) as n FROM peminjaman WHERE anggota_id = ?
      `).get(anggota_id).n;

      statsPribadi = { pinjamanAktif, totalPinjam };
    }

    // Leaderboard (Top 5 Peminjam Terbanyak)
    const leaderboard = db.prepare(`
      SELECT a.nama, a.kelas, COUNT(p.id) as total_buku
      FROM peminjaman p
      JOIN anggota a ON a.id = p.anggota_id
      GROUP BY a.id
      ORDER BY total_buku DESC
      LIMIT 5
    `).all();

    res.json({ status: 'ok', data: { statsPribadi, leaderboard } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;