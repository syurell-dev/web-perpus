// ================================================================
// routes/anggota.js — CRUD Anggota + Import CSV
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

// ================================================================
// GET /api/anggota — List dengan pagination, search, filter
// ================================================================
router.get('/', (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const jenis  = (req.query.jenis || '').trim();
    const kelas  = (req.query.kelas || '').trim();
    const status = (req.query.status || '').trim();

    const where = [];
    const params = {};

    if (search) {
      where.push('(nis LIKE @search OR nama LIKE @search OR kelas LIKE @search)');
      params.search = `%${search}%`;
    }
    if (jenis) { where.push('jenis = @jenis');   params.jenis = jenis; }
    if (kelas) { where.push('kelas = @kelas');   params.kelas = kelas; }
    if (status){ where.push('status = @status'); params.status = status; }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as n FROM anggota ${whereSQL}`).get(params).n;

    const rows = db.prepare(`
      SELECT * FROM anggota
      ${whereSQL}
      ORDER BY jenis ASC, kelas ASC, nama ASC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    const kelasList = db.prepare(`
      SELECT DISTINCT kelas FROM anggota
      WHERE kelas IS NOT NULL AND kelas != ''
      ORDER BY kelas ASC
    `).all().map(r => r.kelas);

    res.json({
      status: 'ok',
      data: rows,
      pagination: { page, limit, total, total_page: Math.ceil(total / limit) },
      kelas_list: kelasList
    });
  } catch (err) {
    console.error('[GET /anggota error]', err.message, err.stack);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// GET /api/anggota/export — Download CSV semua anggota
// ================================================================
router.get('/export', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, status, tanggal_aktif_sampai
      FROM anggota ORDER BY jenis, kelas, nama
    `).all();

    const header = 'nis,nama,jenis,kelas,jenis_kelamin,no_hp,alamat,status,tanggal_aktif_sampai';
    const escapeCSV = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [header];
    for (const r of rows) {
      lines.push([r.nis, r.nama, r.jenis, r.kelas, r.jenis_kelamin, r.no_hp, r.alamat, r.status, r.tanggal_aktif_sampai || '']
        .map(escapeCSV).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="anggota_${Date.now()}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// GET /api/anggota/:id — Detail
// ================================================================
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM anggota WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });
    res.json({ status: 'ok', data: row });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// POST /api/anggota — Tambah
// ================================================================
router.post('/', (req, res) => {
  try {
    const { nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, tanggal_aktif_sampai } = req.body;

    if (!nis || !String(nis).trim()) return res.status(400).json({ status: 'error', message: 'NIS wajib diisi' });
    if (!nama || !String(nama).trim()) return res.status(400).json({ status: 'error', message: 'Nama wajib diisi' });

    const dup = db.prepare('SELECT id FROM anggota WHERE nis = ?').get(String(nis).trim());
    if (dup) return res.status(400).json({ status: 'error', message: `NIS "${nis}" sudah terdaftar` });

    const info = db.prepare(`
      INSERT INTO anggota (nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, tanggal_aktif_sampai)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(nis).trim(),
      String(nama).trim(),
      jenis || 'siswa',
      kelas || null,
      jenis_kelamin || null,
      no_hp || null,
      alamat || null,
      tanggal_aktif_sampai || null
    );

    const created = db.prepare('SELECT * FROM anggota WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ status: 'ok', message: 'Anggota berhasil ditambahkan', data: created });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// PUT /api/anggota/:id — Update
// ================================================================
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM anggota WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    const { nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, status, tanggal_aktif_sampai } = req.body;

    const newNis = (nis !== undefined ? String(nis).trim() : existing.nis);
    if (!newNis) return res.status(400).json({ status: 'error', message: 'NIS wajib diisi' });

    const dup = db.prepare('SELECT id FROM anggota WHERE nis = ? AND id != ?').get(newNis, id);
    if (dup) return res.status(400).json({ status: 'error', message: `NIS "${newNis}" sudah dipakai anggota lain` });

    db.prepare(`
      UPDATE anggota SET
        nis = ?, nama = ?, jenis = ?, kelas = ?,
        jenis_kelamin = ?, no_hp = ?, alamat = ?, status = ?,
        tanggal_aktif_sampai = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newNis,
      (nama !== undefined ? String(nama).trim() : existing.nama),
      jenis ?? existing.jenis,
      kelas ?? existing.kelas,
      jenis_kelamin ?? existing.jenis_kelamin,
      no_hp ?? existing.no_hp,
      alamat ?? existing.alamat,
      status ?? existing.status,
      tanggal_aktif_sampai !== undefined ? (tanggal_aktif_sampai || null) : existing.tanggal_aktif_sampai,
      id
    );

    const updated = db.prepare('SELECT * FROM anggota WHERE id = ?').get(id);
    res.json({ status: 'ok', message: 'Anggota berhasil diupdate', data: updated });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// DELETE /api/anggota/:id
// ================================================================
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM anggota WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    const aktif = db.prepare(`
      SELECT COUNT(*) as n FROM peminjaman
      WHERE anggota_id = ? AND status IN ('dipinjam', 'sebagian')
    `).get(id).n;

    if (aktif > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Tidak bisa dihapus, masih ada ${aktif} peminjaman aktif`
      });
    }

    db.prepare('DELETE FROM anggota WHERE id = ?').run(id);
    res.json({ status: 'ok', message: 'Anggota berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// POST /api/anggota/import — Smart Merge (INSERT / UPDATE / SKIP)
// ================================================================
router.post('/import', (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada baris untuk di-import' });
    }
    if (rows.length > 20000) {
      return res.status(400).json({ status: 'error', message: 'Maksimal 20.000 baris per import' });
    }

    const check = db.prepare('SELECT * FROM anggota WHERE nis = ?');

    const insert = db.prepare(`
      INSERT INTO anggota (nis, nama, jenis, kelas, jenis_kelamin, no_hp, alamat, tanggal_aktif_sampai)
      VALUES (@nis, @nama, @jenis, @kelas, @jenis_kelamin, @no_hp, @alamat, @tanggal_aktif_sampai)
    `);

    // Update HANYA field yang berasal dari Excel (jangan sentuh no_hp, alamat, status, dll.)
    const update = db.prepare(`
      UPDATE anggota SET
        nama = @nama,
        jenis = @jenis,
        kelas = @kelas,
        jenis_kelamin = @jenis_kelamin,
        updated_at = CURRENT_TIMESTAMP
      WHERE nis = @nis
    `);

    const hasil = { sukses: 0, diperbarui: 0, duplikat: 0, gagal: 0, errors: [] };
    const perubahan = []; // log detail untuk audit

    const insertMany = db.transaction((data) => {
      data.forEach((r, idx) => {
        const nis  = (r.nis  || '').toString().trim();
        const nama = (r.nama || '').toString().trim();

        if (!nis || !nama) {
          hasil.gagal++;
          hasil.errors.push(`Baris ${idx + 2}: NIS/nama kosong`);
          return;
        }

        const existing = check.get(nis);

        if (existing) {
          // Cek field per field
          const beda = [];
          const namaBaru  = nama;
          const jenisBaru = r.jenis || 'siswa';
          const kelasBaru = r.kelas || null;
          const jkBaru    = r.jenis_kelamin || null;

          if ((existing.nama || '') !== namaBaru) beda.push('nama');
          if ((existing.jenis || 'siswa') !== jenisBaru) beda.push('jenis');
          if ((existing.kelas || '') !== (kelasBaru || '')) beda.push('kelas');
          if ((existing.jenis_kelamin || '') !== (jkBaru || '')) beda.push('jenis_kelamin');

          if (beda.length === 0) {
            // Duplikat sejati — semua field sama
            hasil.duplikat++;
            return;
          }

          // Ada field yang berbeda → UPDATE
          try {
            update.run({
              nis,
              nama: namaBaru,
              jenis: jenisBaru,
              kelas: kelasBaru,
              jenis_kelamin: jkBaru
            });
            hasil.diperbarui++;
            perubahan.push({
              nis,
              nama: namaBaru,
              field: beda,
              lama: {
                nama: existing.nama,
                jenis: existing.jenis,
                kelas: existing.kelas,
                jenis_kelamin: existing.jenis_kelamin
              }
            });
          } catch (e) {
            hasil.gagal++;
            hasil.errors.push(`Baris ${idx + 2} (${nis}): ${e.message}`);
          }
        } else {
          // NIS belum ada → INSERT baru
          try {
            insert.run({
              nis,
              nama,
              jenis: r.jenis || 'siswa',
              kelas: r.kelas || null,
              jenis_kelamin: r.jenis_kelamin || null,
              no_hp: r.no_hp || null,
              alamat: r.alamat || null,
              tanggal_aktif_sampai: r.tanggal_aktif_sampai || null
            });
            hasil.sukses++;
          } catch (e) {
            hasil.gagal++;
            hasil.errors.push(`Baris ${idx + 2} (${nis}): ${e.message}`);
          }
        }
      });
    });

    insertMany(rows);

    res.json({
      status: 'ok',
      message: `Import: ${hasil.sukses} baru, ${hasil.diperbarui || 0} diperbarui, ${hasil.duplikat} sama, ${hasil.gagal} gagal`,
      hasil,
      perubahan_sample: perubahan.slice(0, 10) // kirim 10 contoh perubahan untuk ditampilkan
    });
  } catch (err) {
    console.error('[POST /anggota/import error]', err.message, err.stack);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// POST /api/anggota/:id/reset-password — Reset password ke NIS awal
// ================================================================
router.post('/:id/reset-password', (req, res) => {
  try {
    const id = req.params.id;
    
    // Ambil data anggota untuk mendapatkan NIS
    const anggota = db.prepare('SELECT nis, nama FROM anggota WHERE id = ?').get(id);
    if (!anggota) return res.status(404).json({ status: 'error', message: 'Anggota tidak ditemukan' });

    // Cek apakah anggota ini punya akun login
    const user = db.prepare('SELECT id FROM users WHERE anggota_id = ?').get(id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Akun login belum dibuat. Siswa belum pernah login.' });
    }

    // Hash NIS sebagai password baru
    const { hash, salt } = db.hashPassword(anggota.nis);

    // Update password & paksa ganti password saat login
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ?, must_change_pw = 1 
      WHERE id = ?
    `).run(hash, salt, user.id);

    res.json({ 
      status: 'ok', 
      message: `Password ${anggota.nama} berhasil direset menjadi NIS (${anggota.nis}).` 
    });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;