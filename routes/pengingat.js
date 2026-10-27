// ================================================================
// routes/pengingat.js — Pengingat Perpanjangan Masa Aktif Domain
// ================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');

// ================================================================
// KONSTANTA
// ================================================================
const RENEWAL_WINDOW_DAYS   = 120;   // reminder muncul 120 hari sebelum expired
const RENEWAL_DURATION_DAYS = 365;   // durasi perpanjangan = 1 tahun
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ================================================================
// HELPER
// ================================================================
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function isValidDateStr(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !isNaN(d.getTime());
}

function diffDays(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00').getTime();
  const b = new Date(toStr   + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

function addDaysStr(baseStr, days) {
  const d = new Date(baseStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getDomainExpiryRaw() {
  const row = db.prepare("SELECT value FROM pengaturan WHERE key = 'domain_expired_at'").get();
  if (!row) return '';
  const v = String(row.value || '').trim();
  return isValidDateStr(v) ? v : '';
}

function setDomainExpiry(value) {
  db.prepare(`
    INSERT INTO pengaturan (key, value, keterangan)
    VALUES ('domain_expired_at', ?, 'Masa aktif domain/sistem perpustakaan (YYYY-MM-DD, kosong = belum diatur)')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(value);
}

// state: unset | ok | warning | expired
function computeState(expiredAt) {
  if (!expiredAt) {
    return { state: 'unset', sisa_hari: null, expired_at: '' };
  }
  const today = todayStr();
  const sisa = diffDays(today, expiredAt); // expired - today
  let state;
  if (sisa < 0) state = 'expired';
  else if (sisa <= RENEWAL_WINDOW_DAYS) state = 'warning';
  else state = 'ok';
  return { state, sisa_hari: sisa, expired_at: expiredAt };
}

// ================================================================
// GET /api/pengingat/domain — status masa aktif domain
// ================================================================
router.get('/domain', (req, res) => {
  try {
    const expiredAt = getDomainExpiryRaw();
    const info = computeState(expiredAt);
    res.json({
      status: 'ok',                                    // envelope API
      today: todayStr(),
      renewal_window_days:   RENEWAL_WINDOW_DAYS,
      renewal_duration_days: RENEWAL_DURATION_DAYS,
      state: info.state,                               // unset | ok | warning | expired
      sisa_hari: info.sisa_hari,
      expired_at: info.expired_at,
      can_renew: info.state === 'warning' || info.state === 'expired'
    });
  } catch (err) {
    console.error('GET /pengingat/domain error:', err);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

// ================================================================
// GET /api/pengingat/domain/perpanjang
// Sengaja GET (bukan POST) agar tidak perlu menyentuh middleware CSRF.
// Perpanjang RENEWAL_DURATION_DAYS (365) hari:
//   - state 'warning'  → base = expired_at (extend dari tanggal lama)
//   - state 'expired'  → base = today
//   - state 'unset'    → base = today (setup awal)
//   - state 'ok'       → DITOLAK (belum masuk window 120 hari)
// ================================================================
router.get('/domain/perpanjang', (req, res) => {
  try {
    const current = getDomainExpiryRaw();
    const info = computeState(current);

    // Business rule: renewal hanya boleh di dalam window atau saat expired
    if (info.state === 'ok') {
      return res.status(400).json({
        status: 'error',
        message: `Perpanjangan baru bisa dilakukan maksimal ${RENEWAL_WINDOW_DAYS} hari sebelum expired. Sisa ${info.sisa_hari} hari lagi.`,
        state: info.state,
        sisa_hari: info.sisa_hari,
        expired_at: info.expired_at
      });
    }

    const today = todayStr();
    // base: kalau masih warning → extend dari tanggal expired lama
    // kalau expired / unset → mulai dari hari ini
    const base = (info.state === 'warning') ? current : today;
    const newDate = addDaysStr(base, RENEWAL_DURATION_DAYS);

    setDomainExpiry(newDate);
    const newInfo = computeState(newDate);

    res.json({
      status: 'ok',
      message: `Masa aktif diperpanjang ${RENEWAL_DURATION_DAYS} hari sampai ${newDate}`,
      state: newInfo.state,
      sisa_hari: newInfo.sisa_hari,
      expired_at: newInfo.expired_at,
      can_renew: newInfo.state === 'warning' || newInfo.state === 'expired'
    });
  } catch (err) {
    console.error('GET /pengingat/domain/perpanjang error:', err);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;