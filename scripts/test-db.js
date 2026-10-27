// Quick DB sanity check (for development)
const db = require('../db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(r => r.name).join(', '));

function cols(t) { return db.prepare('PRAGMA table_info(' + t + ')').all().map(c => c.name); }
console.log('anggota    :', cols('anggota').join(', '));
console.log('buku       :', cols('buku').join(', '));
console.log('peminjaman :', cols('peminjaman').join(', '));
console.log('buku_digital:', cols('buku_digital').join(', '));
console.log('film       :', cols('film').join(', '));

const settings = db.prepare("SELECT key, value FROM pengaturan").all();
console.log('Settings:', settings.map(s => s.key + '=' + s.value).join(', '));

const countAnggota = db.prepare("SELECT COUNT(*) as n FROM anggota").get().n;
console.log('Anggota count:', countAnggota);
const countFilm = db.prepare("SELECT COUNT(*) as n FROM film").get().n;
console.log('Film count:', countFilm);
const countDigital = db.prepare("SELECT COUNT(*) as n FROM buku_digital").get().n;
console.log('Buku digital count:', countDigital);