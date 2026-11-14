// ================================================================
// routes/auth.js — Login / Logout / Change Password (Multi-Role)
// ================================================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

function verifyPassword(password, hash, salt) {
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(test, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  if (!auth.checkRateLimit(ip)) {
    return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username/NIS dan password wajib diisi' });
  }

  const uname = String(username).trim();
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);

  // JIKA USER TIDAK DITEMUKAN, CEK APAKAH INI NIS ANGGOTA (AUTO-REGISTER)
  if (!user) {
    const anggota = db.prepare('SELECT * FROM anggota WHERE nis = ?').get(uname);
    if (anggota) {
      // Buatkan akun otomatis. Password default = NIS.
      const { hash, salt } = db.hashPassword(uname); // password = nis
      const role = anggota.jenis === 'siswa' ? 'siswa' : 'guru';
      
      db.prepare(`
        INSERT INTO users (username, password_hash, password_salt, must_change_pw, role, anggota_id)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(uname, hash, salt, role, anggota.id);

      user = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
    }
  }

  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    auth.recordFail(ip);
    return res.status(401).json({ status: 'error', message: 'Username/NIS atau password salah' });
  }

  // Hanya cek tabel anggota jika role-nya siswa atau guru
  if (user.role === 'siswa' || user.role === 'guru') {
    const anggota = db.prepare('SELECT nama, status FROM anggota WHERE id = ?').get(user.anggota_id);
    if (!anggota || anggota.status !== 'aktif') {
      return res.status(403).json({ status: 'error', message: 'Akun dinonaktifkan. Hubungi petugas.' });
    }
    user.nama = anggota.nama;
  }

  auth.resetAttempts(ip);
  const sid = auth.createSession(user);
  auth.setSessionCookie(res, sid);

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  res.json({
    status: 'ok',
    message: 'Login berhasil',
    mustChangePw: user.must_change_pw === 1,
    username: user.username,
    role: user.role
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const session = auth.getSession(req);
  if (session) auth.destroySession(session._id);
  auth.clearSessionCookie(res);
  res.json({ status: 'ok', message: 'Logout berhasil' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const session = auth.getSession(req);
  if (!session) return res.status(401).json({ status: 'error', message: 'Belum login' });
  res.json({ 
    status: 'ok', 
    username: session.username, 
    nama: session.nama, // <--- TAMBAHKAN INI
    role: session.role,
    mustChangePw: session.mustChangePw 
  });
});

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  const session = auth.getSession(req);
  if (!session) return res.status(401).json({ status: 'error', message: 'Belum login' });

  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password) {
    return res.status(400).json({ status: 'error', message: 'Password lama & baru wajib diisi' });
  }
  if (String(new_password).length < 8) {
    return res.status(400).json({ status: 'error', message: 'Password baru minimal 8 karakter' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!user || !verifyPassword(old_password, user.password_hash, user.password_salt)) {
    return res.status(401).json({ status: 'error', message: 'Password lama salah' });
  }

  const { hash, salt } = db.hashPassword(new_password);
  db.prepare(`
    UPDATE users SET password_hash = ?, password_salt = ?, must_change_pw = 0 WHERE id = ?
  `).run(hash, salt, session.userId);

  session.mustChangePw = false;

  // SECURITY: Hapus file password setelah admin menggantinya
  const fs = require('fs');
  const path = require('path');
  const pwPath = path.join(__dirname, '..', 'database', 'password-admin-first-login.txt');
  if (fs.existsSync(pwPath)) {
    fs.unlinkSync(pwPath);
  }

  res.json({ status: 'ok', message: 'Password berhasil diubah' });
});

module.exports = router;