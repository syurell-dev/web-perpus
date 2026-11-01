const fs = require('fs');
const path = require('path');
const db = require('../db');

console.log("=== 🕵️‍♂️ OTOPSI TOTAL FITUR NONTON ===\n");

// 1. CEK DATABASE (Apa isi aslinya?)
console.log("📁 [1] CEK DATABASE (5 Data Terakhir):");
try {
  const rows = db.prepare(`
    SELECT k.id, k.tanggal, k.tujuan, a.nama 
    FROM kunjungan k
    JOIN anggota a ON a.id = k.anggota_id
    ORDER BY k.id DESC LIMIT 5
  `).all();

  if (rows.length === 0) {
    console.log("   ❌ Belum ada data kunjungan di database.");
  } else {
    rows.forEach(r => {
      // Cek tipe data dan string persisnya
      const tujuanRaw = JSON.stringify(r.tujuan); 
      console.log(`   - ${r.nama} | Tujuan di DB: ${tujuanRaw}`);
    });
  }
} catch (err) {
  console.log("   ❌ Gagal query DB:", err.message);
}

// 2. CEK FILE LAPORAN.JS (Apakah kodenya sudah benar?)
console.log("\n📄 [2] CEK KODE public/js/laporan.js:");
const laporanPath = path.join(__dirname, '..', 'public', 'js', 'laporan.js');
if (!fs.existsSync(laporanPath)) {
  console.log("   ❌ File laporan.js tidak ditemukan!");
} else {
  const content = fs.readFileSync(laporanPath, 'utf8');
  
  if (content.includes("=== 'nonton'") || content.includes("=== \"nonton\"")) {
    console.log("   ✅ Kode 'nonton' DITEMUKAN di laporan.js.");
    if (content.includes("trim().toLowerCase()")) {
      console.log("   ✅ Fungsi trim().toLowerCase() juga ditemukan (Anti-typo).");
    } else {
      console.log("   ⚠️ Fungsi trim().toLowerCase() TIDAK ditemukan, mungkin rawan typo.");
    }
  } else {
    console.log("   ❌ Kode 'nonton' TIDAK DITEMUKAN di laporan.js! Ini penyebab utamanya.");
  }

  // Cek apakah masih ada kode lama
  if (content.includes("? '<span class=\"px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold\">Pinjam Buku</span>' : '<span class=\"px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold\">Baca di Tempat</span>'")) {
     console.log("   ❌ TERDETEKSI KODE LAMA! Logika di laporan.js masih menggunakan if/else lama (hanya pinjam & baca).");
  }
}

// 3. CEK ROUTES/LAPORAN.JS (Apakah rekap backend benar?)
console.log("\n📄 [3] CEK KODE routes/laporan.js:");
const routeLaporanPath = path.join(__dirname, '..', 'routes', 'laporan.js');
if (fs.existsSync(routeLaporanPath)) {
  const content = fs.readFileSync(routeLaporanPath, 'utf8');
  if (content.includes("totalNonton")) {
    console.log("   ✅ Kode rekap 'totalNonton' DITEMUKAN di backend.");
  } else {
    console.log("   ❌ Kode rekap 'totalNonton' TIDAK DITEMUKAN di backend (routes/laporan.js).");
  }
}

console.log("\n=== KESIMPULAN ===");
console.log("Jika DB tertulis 'nonton' tapi UI menampilkan 'Baca', berarti file laporan.js belum tersimpan atau cache browser.");
console.log("Silakan screenshot hasil terminal ini dan kirimkan ke saya.");