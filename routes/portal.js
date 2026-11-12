const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/portal/stats — Statistik pribadi
router.get('/stats', (req, res) => {
  try {
    const anggota_id = req.user.anggota_id;

    let statsPribadi = null;
    if (anggota_id) {
      const pinjamanAktif = db.prepare(`
        SELECT p.id, p.kode_pinjam, p.tanggal_pinjam, p.tanggal_jatuh, 
               (SELECT GROUP_CONCAT(b.judul, ', ') FROM peminjaman_detail pd JOIN buku b ON b.id = pd.buku_id WHERE pd.peminjaman_id = p.id) as buku
        FROM peminjaman p
        WHERE p.anggota_id = ? AND p.status IN ('dipinjam', 'sebagian')
      `).all(anggota_id);

      const totalPinjam = db.prepare(`
        SELECT COUNT(*) as n FROM peminjaman WHERE anggota_id = ?
      `).get(anggota_id).n;

      statsPribadi = { pinjamanAktif, totalPinjam };
    }

    res.json({ status: 'ok', data: { statsPribadi } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;