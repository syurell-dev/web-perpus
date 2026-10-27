// ================================================================
// scripts/test-otomatis.js — Uji Coba Otomatis (Fixed Timezone)
// ================================================================
const express = require('express');
const db = require('../db');
const scanRouter = require('../routes/scan');
const peminjamanRouter = require('../routes/peminjaman');

const app = express();
app.use(express.json());
app.use('/api/scan', scanRouter);
app.use('/api/peminjaman', peminjamanRouter);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  
  console.log('====================================================');
  console.log('🚀 MEMULAI UJI OTOMATIS SISTEM PERPUSTAKAAN');
  console.log('====================================================\n');

  // --- Helper Tanggal (PAKAI WAKTU LOKAL, SAMA SEPERTI SERVER) ---
  const todayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  
  const addDays = (dateStr, days) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const reqApi = async (method, path, body = null) => {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(baseUrl + path, options);
    return { status: res.status, data: await res.json() };
  };

  let passCount = 0;
  let failCount = 0;
  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passCount++;
    } else {
      console.log(`❌ [FAIL] ${testName} -> ${details}`);
      failCount++;
    }
  };

  // --- Simpan Setting Asli ---
  const oldLamaPinjam = db.prepare("SELECT value FROM pengaturan WHERE key = 'lama_pinjam_default'").get()?.value || '7';
  const oldDenda = db.prepare("SELECT value FROM pengaturan WHERE key = 'denda_per_hari'").get()?.value || '500';

  // --- Data Dummy ---
  const testNis = 'TEST-999';
  const testBukuKode = 'TEST-BK-01';
  let testAnggotaId, testBukuId;

  try {
    // 1. SETUP DATA
    console.log('⏳ Menyiapkan data uji (Anggota & Buku)...');
    // Paksa setting ke 3 hari & denda 0 untuk pengujian
    db.prepare("UPDATE pengaturan SET value = '3' WHERE key = 'lama_pinjam_default'").run();
    db.prepare("UPDATE pengaturan SET value = '0' WHERE key = 'denda_per_hari'").run();

    db.prepare('DELETE FROM anggota WHERE nis = ?').run(testNis);
    db.prepare('DELETE FROM buku WHERE kode_buku = ?').run(testBukuKode);

    const infoA = db.prepare(`INSERT INTO anggota (nis, nama, jenis, status) VALUES (?, ?, 'siswa', 'aktif')`).run(testNis, 'Siswa Test');
    testAnggotaId = infoA.lastInsertRowid;

    const infoB = db.prepare(`INSERT INTO buku (kode_buku, judul, stok_total, stok_tersedia) VALUES (?, ?, 5, 5)`).run(testBukuKode, 'Buku Test Otomatis');
    testBukuId = infoB.lastInsertRowid;
    console.log('✅ Data uji siap.\n');

    // ================================================================
    // SKENARIO 1: PEMINJAMAN NORMAL
    // ================================================================
    console.log('▶️  Skenario 1: Peminjaman Normal (Jatuh tempo +3 hari)');
    const payloadPinjam = { anggota_id: testAnggotaId, buku_list: [{ buku_id: testBukuId, jumlah: 1 }] };
    const res1 = await reqApi('POST', '/api/scan/proses', payloadPinjam);
    
    assert(res1.status === 200, 'API merespon 200 OK', JSON.stringify(res1.data));
    assert(res1.data.peminjaman && res1.data.peminjaman.buku.length === 1, 'Buku berhasil dipinjam');
    const pinjamanId = res1.data.peminjaman.id;

    // ================================================================
    // SKENARIO 2: PERPANJANGAN (HARI KE-3)
    // ================================================================
    console.log('\n▶️  Skenario 2: Perpanjangan Otomatis (Scan tepat di hari jatuh tempo)');
    // Time Travel: Set jatuh tempo jadi HARI INI
    db.prepare('UPDATE peminjaman SET tanggal_jatuh = ? WHERE id = ?').run(todayStr(), pinjamanId);
    
    const res2 = await reqApi('POST', '/api/scan/proses', payloadPinjam);
    assert(res2.status === 200, 'API merespon 200 OK', JSON.stringify(res2.data));
    assert(res2.data.perpanjangan && res2.data.perpanjangan.length === 1, 'Buku berhasil diperpanjang');
    
    const p2 = db.prepare('SELECT tanggal_jatuh FROM peminjaman WHERE id = ?').get(pinjamanId);
    assert(p2.tanggal_jatuh === addDays(todayStr(), 3), 'Tanggal jatuh tempo bertambah 3 hari', `Ekspektasi: ${addDays(todayStr(), 3)}, Aktual: ${p2.tanggal_jatuh}`);

    // ================================================================
    // SKENARIO 3: TERLAMBAT & SANKSI (DENDA 0)
    // ================================================================
    console.log('\n▶️  Skenario 3: Pengembalian Terlambat (Sanksi 7 Hari)');
    // Time Travel: Set jatuh tempo jadi KEMARIN
    db.prepare('UPDATE peminjaman SET tanggal_jatuh = ? WHERE id = ?').run(addDays(todayStr(), -1), pinjamanId);
    
    const res3 = await reqApi('POST', '/api/scan/proses', payloadPinjam);
    assert(res3.status === 200, 'API merespon 200 OK', JSON.stringify(res3.data));
    assert(res3.data.pengembalian && res3.data.pengembalian.length === 1, 'Buku berhasil dikembalikan');
    
    const cekSanksi = db.prepare('SELECT banned_until FROM anggota WHERE id = ?').get(testAnggotaId);
    assert(cekSanksi.banned_until === addDays(todayStr(), 7), 'Anggota mendapat sanksi 7 hari', `Ekspektasi: ${addDays(todayStr(), 7)}, Aktual: ${cekSanksi.banned_until}`);

    // ================================================================
    // SKENARIO 4: DITOLAK KARENA SANKSI
    // ================================================================
    console.log('\n▶️  Skenario 4: Peminjaman Ditolak (Karena Sanksi Aktif)');
    const res4 = await reqApi('POST', '/api/scan/proses', payloadPinjam);
    assert(res4.status === 400, 'API menolak dengan status 400', JSON.stringify(res4.data));
    assert(res4.data.message.includes('sanksi'), 'Pesan error menyebutkan sanksi');

    // ================================================================
    // SKENARIO 5: SANKSI HABIS
    // ================================================================
    console.log('\n▶️  Skenario 5: Peminjaman Sukses (Sanksi Sudah Habis)');
    // Time Travel: Set banned_until jadi KEMARIN
    db.prepare('UPDATE anggota SET banned_until = ? WHERE id = ?').run(addDays(todayStr(), -1), testAnggotaId);
    
    const res5 = await reqApi('POST', '/api/scan/proses', payloadPinjam);
    assert(res5.status === 200, 'API merespon 200 OK (Bisa pinjam lagi)', JSON.stringify(res5.data));
    assert(res5.data.peminjaman && res5.data.peminjaman.buku.length === 1, 'Buku berhasil dipinjam setelah sanksi habis');

  } catch (err) {
    console.error('\n❌ Terjadi Error Sistem:', err);
  } finally {
    // ================================================================
    // CLEANUP (Kembalikan setting asli & hapus data dummy)
    // ================================================================
    console.log('\n⏳ Membersihkan data & mengembalikan setting asli...');
    
    db.prepare("UPDATE pengaturan SET value = ? WHERE key = 'lama_pinjam_default'").run(oldLamaPinjam);
    db.prepare("UPDATE pengaturan SET value = ? WHERE key = 'denda_per_hari'").run(oldDenda);

    db.prepare('DELETE FROM peminjaman_detail WHERE peminjaman_id IN (SELECT id FROM peminjaman WHERE anggota_id = ?)').run(testAnggotaId);
    db.prepare('DELETE FROM peminjaman WHERE anggota_id = ?').run(testAnggotaId);
    db.prepare('DELETE FROM anggota WHERE id = ?').run(testAnggotaId);
    db.prepare('DELETE FROM buku WHERE id = ?').run(testBukuId);

    console.log('\n====================================================');
    console.log(`📊 HASIL AKHIR: ${passCount} PASS, ${failCount} FAIL`);
    console.log('====================================================');
    
    server.close();
    process.exit(failCount > 0 ? 1 : 0);
  }
});