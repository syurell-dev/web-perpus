const db = require('../db');
const crypto = require('crypto');

function hashPassword(password, salt = null) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

const username = 'kiosk';
const password = 'kiosk123'; // GANTI dengan password yang aman

// Hapus user lama jika ada
db.prepare('DELETE FROM users WHERE username = ?').run(username);

// Buat user baru dengan role 'kiosk' & must_change_pw = 0
const { hash, salt } = hashPassword(password);
db.prepare(`INSERT INTO users (username, password_hash, password_salt, role, must_change_pw) 
  VALUES (?, ?, ?, 'kiosk', 1)`).run(username, hash, salt);

console.log('✅ User kiosk berhasil dibuat ulang!');
console.log(`👤 Username: ${username}`);
console.log(`🔑 Password: ${password}`);