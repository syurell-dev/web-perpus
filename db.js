// ================================================================
// db.js — Koneksi & Inisialisasi Database SQLite
// ================================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'perpus.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

console.log(`📦 Database: ${DB_PATH}`);

// ================================================================
// SCHEMA
// ================================================================
db.exec(`
  -- ============ TABEL BUKU ============
  CREATE TABLE IF NOT EXISTS buku (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_buku       TEXT UNIQUE,
    judul           TEXT NOT NULL,
    penulis         TEXT,
    penerbit        TEXT,
    tahun_terbit    INTEGER,
    isbn            TEXT,
    kategori        TEXT,
    stok_total      INTEGER NOT NULL DEFAULT 0,
    stok_tersedia   INTEGER NOT NULL DEFAULT 0,
    lokasi_rak      TEXT,
    cover_url       TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_buku_judul    ON buku(judul);
  CREATE INDEX IF NOT EXISTS idx_buku_penulis  ON buku(penulis);
  CREATE INDEX IF NOT EXISTS idx_buku_kategori ON buku(kategori);
  CREATE INDEX IF NOT EXISTS idx_buku_kode     ON buku(kode_buku);

  -- ============ TABEL ANGGOTA ============
  CREATE TABLE IF NOT EXISTS anggota (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nis             TEXT UNIQUE NOT NULL,
    nama            TEXT NOT NULL,
    jenis           TEXT NOT NULL DEFAULT 'siswa',  -- siswa / guru / staf
    kelas           TEXT,
    jenis_kelamin   TEXT,                            -- L / P
    no_hp           TEXT,
    alamat          TEXT,
    status          TEXT NOT NULL DEFAULT 'aktif',   -- aktif / nonaktif
    tanggal_aktif_sampai DATE,                       -- BARU: Masa aktif (opsional)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_anggota_nis   ON anggota(nis);
  CREATE INDEX IF NOT EXISTS idx_anggota_nama  ON anggota(nama);
  CREATE INDEX IF NOT EXISTS idx_anggota_kelas ON anggota(kelas);

  -- ============ TABEL PEMINJAMAN (header) ============
  CREATE TABLE IF NOT EXISTS peminjaman (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_pinjam       TEXT UNIQUE NOT NULL,
    anggota_id        INTEGER NOT NULL,
    tanggal_pinjam    DATE NOT NULL,
    tanggal_jatuh     DATE NOT NULL,
    tanggal_kembali   DATE,
    status            TEXT NOT NULL DEFAULT 'dipinjam', -- dipinjam / dikembalikan / sebagian
    denda             INTEGER NOT NULL DEFAULT 0,
    catatan           TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE RESTRICT
  );

  -- ============ TABEL KUNJUNGAN (BUKU TAMU) ============
  CREATE TABLE IF NOT EXISTS kunjungan (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id  INTEGER NOT NULL,
    tanggal     DATE NOT NULL,
    jam_masuk   DATETIME NOT NULL,
    tujuan      TEXT DEFAULT 'baca',
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_kunjungan_tgl ON kunjungan(tanggal);

  CREATE INDEX IF NOT EXISTS idx_pinjam_anggota ON peminjaman(anggota_id);
  CREATE INDEX IF NOT EXISTS idx_pinjam_status  ON peminjaman(status);
  CREATE INDEX IF NOT EXISTS idx_pinjam_tgl     ON peminjaman(tanggal_pinjam);

  -- ============ TABEL PEMINJAMAN DETAIL (per buku) ============
  CREATE TABLE IF NOT EXISTS peminjaman_detail (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    peminjaman_id   INTEGER NOT NULL,
    buku_id         INTEGER NOT NULL,
    jumlah          INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'dipinjam',
    tanggal_kembali DATE,
    denda           INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id) ON DELETE CASCADE,
    FOREIGN KEY (buku_id)      REFERENCES buku(id)      ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_detail_pinjam ON peminjaman_detail(peminjaman_id);
  CREATE INDEX IF NOT EXISTS idx_detail_buku   ON peminjaman_detail(buku_id);

  -- ============ TABEL PENGATURAN ============
  CREATE TABLE IF NOT EXISTS pengaturan (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    keterangan  TEXT
  );

  -- ============ TABEL USERS ============
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NOT NULL,
    must_change_pw  INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login      DATETIME
  );
`);

console.log('✅ Schema database siap');

// ================================================================
// MIGRASI OTOMATIS: Tambah kolom tanggal_aktif_sampai jika belum ada
// ================================================================
try {
  const tableInfo = db.prepare("PRAGMA table_info(anggota)").all();
  const hasColumn = tableInfo.some(c => c.name === 'tanggal_aktif_sampai');
  if (!hasColumn) {
    db.exec("ALTER TABLE anggota ADD COLUMN tanggal_aktif_sampai DATE");
    console.log("✅ Migrasi: Kolom tanggal_aktif_sampai berhasil ditambahkan");
  }
} catch (err) {
  console.error("❌ Gagal migrasi tanggal_aktif_sampai:", err.message);
}

// ================================================================
// SEED DATA DEFAULT
// ================================================================
const pengaturanDefault = [
  ['denda_per_hari',       '500',  'Denda keterlambatan per hari (Rp)'],
  ['lama_pinjam_default',  '7',    'Lama peminjaman default (hari)'],
  ['max_buku_per_pinjam',  '3',    'Maksimal buku per transaksi'],
  ['nama_perpustakaan',    'Perpustakaan Sekolah', 'Nama perpustakaan'],
  ['domain_expired_at',    '',     'Masa aktif domain/sistem perpustakaan (YYYY-MM-DD, kosong = belum diatur)'],
];

const insertPengaturan = db.prepare(`INSERT OR IGNORE INTO pengaturan (key, value, keterangan) VALUES (?, ?, ?)`);
pengaturanDefault.forEach(p => insertPengaturan.run(...p));

// (Seed buku & anggota biarkan saja seperti aslinya agar tidak kepanjangan, 
// karena kita hanya butuh perubahan pada skema & migrasi)
const countBuku = db.prepare('SELECT COUNT(*) as n FROM buku').get().n;
if (countBuku === 0) {
  const seedBuku = db.prepare(`
    INSERT INTO buku (kode_buku, judul, penulis, penerbit, tahun_terbit, kategori, stok_total, stok_tersedia, lokasi_rak)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const contohBuku = [
    ['BK-001', 'Laskar Pelangi', 'Andrea Hirata', 'Bentang Pustaka', 2005, 'Novel', 5, 5, 'A-01'],
    ['BK-002', 'Bumi Manusia', 'Pramoedya Ananta Toer', 'Hasta Mitra', 1980, 'Novel', 3, 3, 'A-02'],
  ];
  const insertMany = db.transaction((rows) => {
    for (const row of rows) seedBuku.run(...row);
  });
  insertMany(contohBuku);
}

const countAnggota = db.prepare('SELECT COUNT(*) as n FROM anggota').get().n;
if (countAnggota === 0) {
  const insertAnggota = db.prepare(`
    INSERT INTO anggota (nis, nama, jenis, kelas, jenis_kelamin, no_hp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const contohAnggota = [
    ['2024001', 'Ahmad Fauzi',        'siswa', 'X-IPA-1', 'L', '081234567001'],
    ['2024002', 'Siti Nurhaliza',     'siswa', 'X-IPA-1', 'P', '081234567002'],
    ['G001',    'Pak Bambang, S.Pd',  'guru',  null,      'L', '081234567010'],
  ];
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insertAnggota.run(...row);
  });
  insertMany(contohAnggota);
}

const crypto = require('crypto');
function hashPassword(password, salt = null) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

const countUsers = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
if (countUsers === 0) {
  const randomPassword = crypto.randomBytes(9).toString('base64url');
  const { hash, salt } = hashPassword(randomPassword);
  db.prepare(`
    INSERT INTO users (username, password_hash, password_salt, must_change_pw)
    VALUES (?, ?, ?, 1)
  `).run('admin', hash, salt);
  console.log(`\n🔐 AKUN ADMIN DIBUAT\nUsername: admin\nPassword: ${randomPassword}\n`);
}

module.exports = Object.assign(db, { hashPassword });
module.exports = db;