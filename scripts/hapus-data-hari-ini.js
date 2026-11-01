const db = require('../db');
const today = new Date().toLocaleDateString('en-CA');
db.prepare('DELETE FROM kunjungan WHERE tanggal = ?').run(today);
console.log(`✅ Semua data kunjungan tanggal ${today} berhasil dihapus!`);