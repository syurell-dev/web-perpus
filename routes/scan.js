const express = require('express');
const router = express.Router();
const db = require('../db');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// GET /api/scan/lookup/:kode — Deteksi otomatis buku/anggota
router.get('/lookup/:kode', (req, res) => {
  try {
    const rawKode = (req.params.kode || '').trim();
    const kode = rawKode.toUpperCase();

    if (!kode) return res.status(400).json({ status: 'error', message: 'Kode kosong' });

    let buku = db.prepare('SELECT * FROM buku WHERE UPPER(kode_buku) = ?').get(kode);
    if (buku) return res.json({ status: 'ok', tipe: 'buku', data: buku });

    if (/^\d{10,13}$/.test(kode)) {
      buku = db.prepare('SELECT * FROM buku WHERE isbn = ?').get(kode);
      if (buku) return res.json({ status: 'ok', tipe: 'buku', data: buku });
    }

    let nisKandidat = kode;
    if (/^200\d{10}$/.test(kode)) {
      nisKandidat = kode.substring(3, 12).replace(/^0+/, '') || '0';
    }

    let anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(nisKandidat);
    if (!anggota) anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(kode);
    if (!anggota) anggota = db.prepare('SELECT * FROM anggota WHERE UPPER(nis) = ?').get(nisKandidat.padStart(7, '0'));
    if (anggota) return res.json({ status: 'ok', tipe: 'anggota', data: anggota });

    res.status(404).json({ status: 'error', message: 'Kode tidak dikenali: ' + rawKode });
  } catch (err) {
    console.error('Scan lookup error:', err);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/scan/proses — Proses Peminjaman, Pengembalian, & Perpanjangan
router.post('/proses', (req, res) => {
  try {
        const { anggota_id, buku_list, force_return } = req.body;
    if (!anggota_id || !Array.isArray(buku_list) || !buku_list.length) {
      return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
    }

    const anggota = db.prepare('SELECT * FROM anggota WHERE id = ?').get(anggota_id);
    if (!anggota) return res.status(400).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    const today = todayStr();
    const lamaPinjam = parseInt((db.prepare('SELECT value FROM pengaturan WHERE key=?').get('lama_pinjam_default') || {}).value || '3', 10);
    const dendaPerHari = parseInt((db.prepare('SELECT value FROM pengaturan WHERE key=?').get('denda_per_hari') || {}).value || '500', 10);

    // CEK SANKSI DI AWAL
    if (anggota.banned_until && anggota.banned_until >= today) {
      return res.status(400).json({ status: 'error', message: `Siswa sedang dalam masa sanksi hingga ${anggota.banned_until}. Tidak bisa meminjam buku.` });
    }

    const items = [];
    for (const item of buku_list) {
      
            const detail = db.prepare(`
        SELECT pd.id AS detail_id, pd.jumlah, p.id AS peminjaman_id, p.tanggal_jatuh
        FROM peminjaman_detail pd
        JOIN peminjaman p ON p.id = pd.peminjaman_id
        WHERE pd.buku_id = ? AND pd.status = 'dipinjam' AND p.anggota_id = ?
        ORDER BY p.id DESC LIMIT 1
      `).get(item.buku_id, anggota_id);

      if (detail) {
        if (today === detail.tanggal_jatuh && !force_return) {
          // TEPAT DI HARI JATUH TEMPO & TIDAK PAKSA KEMBALI = PERPANJANG
          items.push({ action: 'perpanjang', detail_id: detail.detail_id, peminjaman_id: detail.peminjaman_id, buku_id: item.buku_id, jumlah: detail.jumlah });
        } else {
          // KEMBALIKAN BUKU (Lebih awal, terlambat, ATAU karena mode paksa kembali)
          items.push({ action: 'kembali', detail_id: detail.detail_id, peminjaman_id: detail.peminjaman_id, buku_id: item.buku_id, jumlah: item.jumlah, is_late: today > detail.tanggal_jatuh });
        }
      } else {
        // PINJAM BUKU BARU
        const otherBorrow = db.prepare(`SELECT id FROM peminjaman_detail WHERE buku_id = ? AND status = 'dipinjam'`).get(item.buku_id);
        if (otherBorrow) {
          return res.status(400).json({ status: 'error', message: `Buku sedang dipinjam oleh orang lain.` });
        }
        items.push({ action: 'pinjam', buku_id: item.buku_id, jumlah: item.jumlah });
      }
    } // ◄◄◄ INI KURUNG PENUTUP FOR LOOP YANG HILANG

    const perpanjangItems = items.filter(i => i.action === 'perpanjang');
    const kembaliItems = items.filter(i => i.action === 'kembali');
    const pinjamItems  = items.filter(i => i.action === 'pinjam');

    for (const item of pinjamItems) {
      const b = db.prepare('SELECT judul, stok_tersedia FROM buku WHERE id = ?').get(item.buku_id);
      if (!b) return res.status(400).json({ status: 'error', message: `Buku ID ${item.buku_id} tidak ditemukan` });
      if (b.stok_tersedia < item.jumlah) {
        return res.status(400).json({ status: 'error', message: `Stok "${b.judul}" tidak cukup (tersedia: ${b.stok_tersedia})` });
      }
    }

    const doProcess = db.transaction(() => {
      const hasil = { pengembalian: [], peminjaman: null, perpanjangan: [], sanksi: null };

      // 1. PROSES PERPANJANGAN (+3 HARI)
      for (const item of perpanjangItems) {
        const newDueDate = addDays(today, lamaPinjam);
        db.prepare(`UPDATE peminjaman SET tanggal_jatuh = ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(newDueDate, item.peminjaman_id);
        const buku = db.prepare('SELECT judul, kode_buku FROM buku WHERE id = ?').get(item.buku_id);
        hasil.perpanjangan.push({ ...buku, tanggal_jatuh_baru: newDueDate });
      }

      // 2. PROSES PENGEMBALIAN & SANKSI
      if (kembaliItems.length) {
        const updDetail = db.prepare(`UPDATE peminjaman_detail SET status='dikembalikan', tanggal_kembali=?, denda=? WHERE id=?`);
        const updStok = db.prepare(`UPDATE buku SET stok_tersedia = stok_tersedia + ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
        let kenaSanksi = false;

        for (const item of kembaliItems) {
          // Denda Rp0 (bisa disesuaikan lewat setting)
          const denda = 0; 
          updDetail.run(today, denda, item.detail_id);
          updStok.run(item.jumlah, item.buku_id);
          const buku = db.prepare('SELECT judul, kode_buku FROM buku WHERE id = ?').get(item.buku_id);
          hasil.pengembalian.push({ ...buku, denda, hari_terlambat: 0 });
          
          if (item.is_late) kenaSanksi = true;
        }

        if (kenaSanksi) {
          const bannedUntil = addDays(today, 7);
          db.prepare(`UPDATE anggota SET banned_until = ? WHERE id = ?`).run(bannedUntil, anggota_id);
          hasil.sanksi = bannedUntil;
        }

        const pids = [...new Set(kembaliItems.map(i => i.peminjaman_id))];
        for (const pid of pids) {
          const sisa = db.prepare(`SELECT COUNT(*) as n FROM peminjaman_detail WHERE peminjaman_id=? AND status='dipinjam'`).get(pid).n;
          const totalDenda = db.prepare(`SELECT COALESCE(SUM(denda),0) as t FROM peminjaman_detail WHERE peminjaman_id=?`).get(pid).t;
          if (sisa === 0) {
            db.prepare(`UPDATE peminjaman SET status='dikembalikan', tanggal_kembali=?, denda=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(today, totalDenda, pid);
          } else {
            db.prepare(`UPDATE peminjaman SET status='sebagian', denda=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(totalDenda, pid);
          }
        }
      }

      // 3. PROSES PEMINJAMAN BARU
      if (pinjamItems.length) {
        // Cek ulang ban jika sebelumnya ada pengembalian terlambat di transaksi yang sama
        const ag = db.prepare('SELECT banned_until FROM anggota WHERE id = ?').get(anggota_id);
        if (ag && ag.banned_until && ag.banned_until >= today) {
          throw new Error(`Tidak bisa meminjam buku baru karena baru saja mendapat sanksi hingga ${ag.banned_until}.`);
        }

        const tglJatuhStr = addDays(today, lamaPinjam);
        const ymd = today.replace(/-/g, '');
        const prefix = `PJ-${ymd}-`;
        const last = db.prepare(`SELECT kode_pinjam FROM peminjaman WHERE kode_pinjam LIKE ? ORDER BY id DESC LIMIT 1`).get(prefix + '%');
        const seq = last ? parseInt(last.kode_pinjam.replace(prefix, ''), 10) + 1 : 1;
        const kodePinjam = prefix + String(seq).padStart(3, '0');

        const info = db.prepare(`
          INSERT INTO peminjaman (kode_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh, status, catatan)
          VALUES (?, ?, ?, ?, 'dipinjam', 'Auto-scan')
        `).run(kodePinjam, anggota_id, today, tglJatuhStr);

        const pid = info.lastInsertRowid;
        const insDetail = db.prepare(`INSERT INTO peminjaman_detail (peminjaman_id, buku_id, jumlah, status) VALUES (?, ?, ?, 'dipinjam')`);
        const updStok = db.prepare(`UPDATE buku SET stok_tersedia = stok_tersedia - ?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);

        const bukuInfo = [];
        for (const item of pinjamItems) {
          insDetail.run(pid, item.buku_id, item.jumlah);
          updStok.run(item.jumlah, item.buku_id);
          const b = db.prepare('SELECT judul, kode_buku FROM buku WHERE id = ?').get(item.buku_id);
          bukuInfo.push(b);
        }
        hasil.peminjaman = { id: pid, kode_pinjam: kodePinjam, tanggal_pinjam: today, tanggal_jatuh: tglJatuhStr, buku: bukuInfo };
      }
      return hasil;
    });

    const hasil = doProcess();
    let msg = `Selesai: ${hasil.pengembalian.length} kembali, ${hasil.perpanjangan.length} diperpanjang, ${hasil.peminjaman ? hasil.peminjaman.buku.length : 0} pinjam`;
    if (hasil.sanksi) msg += ` (Sanksi 7 hari aktif)`;

    res.json({
      status: 'ok',
      message: msg,
      anggota: { id: anggota.id, nama: anggota.nama, nis: anggota.nis, kelas: anggota.kelas },
      ...hasil
    });

  } catch (err) {
    console.error('POST /scan/proses error:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Terjadi kesalahan pada server' });
  }
});

// POST /api/scan/tamu — Catat Masuk (Tanpa Scan Keluar)
router.post('/tamu', (req, res) => {
  try {
    const { anggota_id, tujuan = 'baca' } = req.body;
    if (!anggota_id) return res.status(400).json({ status: 'error', message: 'Anggota tidak valid' });

    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toLocaleString('sv').replace('T', ' ');

    const kunjunganHariIni = db.prepare(`SELECT id, tujuan FROM kunjungan WHERE anggota_id = ? AND tanggal = ?`).get(anggota_id, today);
    const anggota = db.prepare('SELECT nama, nis, kelas FROM anggota WHERE id = ?').get(anggota_id);

    if (kunjunganHariIni) {
      if (tujuan === 'pinjam' && kunjunganHariIni.tujuan !== 'pinjam') {
        db.prepare('UPDATE kunjungan SET tujuan = ? WHERE id = ?').run('pinjam', kunjunganHariIni.id);
      }
      res.json({ status: 'ok', tipe: 'sudah', anggota, waktu: now.split(' ')[1] });
    } else {
      db.prepare('INSERT INTO kunjungan (anggota_id, tanggal, jam_masuk, tujuan) VALUES (?, ?, ?, ?)').run(anggota_id, today, now, tujuan);
      res.json({ status: 'ok', tipe: 'masuk', tujuan, anggota, waktu: now.split(' ')[1] });
    }
  } catch (err) {
    console.error('[scan/tamu]', err.message);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;