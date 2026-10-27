// ================================================================
// scripts/test-scenario.js — Alat Bantu Uji Coba (Time Travel)
// ================================================================
const db = require('../db');

const action = process.argv[2];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

if (action === 'perpanjang') {
  const p = db.prepare("SELECT * FROM peminjaman WHERE status IN ('dipinjam','sebagian') ORDER BY id DESC LIMIT 1").get();
  if (!p) {
    console.log('❌ Belum ada peminjaman aktif. Silakan buat 1 peminjaman dulu lewat menu Scan.');
    process.exit(1);
  }
  db.prepare('UPDATE peminjaman SET tanggal_jatuh = ? WHERE id = ?').run(todayStr(), p.id);
  console.log(`\n✅ SETUP BERHASIL!`);
  console.log(`Peminjaman ${p.kode_pinjam} sekarang diatur jatuh tempo HARI INI (${todayStr()}).`);
  console.log(`👉 Langkah tes: Buka menu Scan -> Scan Buku tersebut -> Scan Kartu Anggota.`);
  console.log(`   Ekspektasi: Pesan "1 diperpanjang" muncul, dan tanggal jatuh tempo bertambah 3 hari.`);
} 
else if (action === 'terlambat') {
  const p = db.prepare("SELECT * FROM peminjaman WHERE status IN ('dipinjam','sebagian') ORDER BY id DESC LIMIT 1").get();
  if (!p) {
    console.log('❌ Belum ada peminjaman aktif.');
    process.exit(1);
  }
  const yesterday = addDays(todayStr(), -1);
  db.prepare("UPDATE peminjaman SET tanggal_jatuh = ?, status = 'dipinjam' WHERE id = ?").run(yesterday, p.id);
  db.prepare("UPDATE anggota SET banned_until = NULL WHERE id = ?").run(p.anggota_id); // Reset sanksi lama
  
  console.log(`\n✅ SETUP BERHASIL!`);
  console.log(`Peminjaman ${p.kode_pinjam} sekarang diatur jatuh tempo KEMARIN (${yesterday}).`);
  console.log(`👉 Langkah tes: Buka menu Scan -> Scan Buku tersebut -> Scan Kartu Anggota.`);
  console.log(`   Ekspektasi: Buku kembali, muncul notifikasi sanksi 7 hari.`);
} 
else if (action === 'sanksi') {
  const a = db.prepare("SELECT * FROM anggota LIMIT 1").get();
  if (!a) {
    console.log('❌ Belum ada data anggota.');
    process.exit(1);
  }
  const banDate = addDays(todayStr(), 7);
  db.prepare('UPDATE anggota SET banned_until = ? WHERE id = ?').run(banDate, a.id);
  
  console.log(`\n✅ SETUP BERHASIL!`);
  console.log(`Anggota "${a.nama}" (NIS: ${a.nis}) sekarang sedang disanksi (banned) sampai ${banDate}.`);
  console.log(`👉 Langkah tes: Buka menu Scan -> Scan Buku APAPUN -> Scan Kartu Anggota "${a.nama}".`);
  console.log(`   Ekspektasi: Ditolak dengan pesan error "Siswa sedang dalam masa sanksi...".`);
}
else {
  console.log(`
=====================================================
   ALAT UJI COBA (TIME TRAVEL) - SISTEM PERPUS
=====================================================
Penggunaan:
  node scripts/test-scenario.js perpanjang
  node scripts/test-scenario.js terlambat
  node scripts/test-scenario.js sanksi
`);
}