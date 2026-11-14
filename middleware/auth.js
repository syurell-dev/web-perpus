// ================================================================
// middleware/auth.js — Session + rate limit + CSRF + Role Check
// ================================================================
const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 jam
const sessions = new Map();                // sessionId → { userId, username, role, anggota_id, mustChangePw, expiresAt }

// Rate limit login: IP → { count, blockedUntil }
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 5 * 60 * 1000; // 5 menit

function createSession(user) {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, {
    userId: user.id,
    username: user.username,
    role: user.role || 'admin',
        nama: user.nama || user.username, // <--- TAMBAHKAN INI
    anggota_id: user.anggota_id,
    mustChangePw: user.must_change_pw === 1,
    expiresAt: Date.now() + SESSION_TTL_MS,
    createdAt: Date.now(),
    lastSeenAt: Date.now()
  });
  return id;
}

function destroySession(id) { sessions.delete(id); }

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (!match) return null;
  const session = sessions.get(match[1]);
  if (!session) return null;
  if (Date.now() > session.expiresAt) { sessions.delete(match[1]); return null; }
  // SECURITY: Idle timeout check (M1)
  if (Date.now() - session.lastSeenAt > SESSION_TTL_MS) {
    sessions.delete(match[1]);
    return null;
  }
  session.lastSeenAt = Date.now();
  session._id = match[1];
  return session;
}

function setSessionCookie(res, id) {
  res.setHeader('Set-Cookie',
    `sid=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}

// ================================================================
// Rate limit
// ================================================================
function checkRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) return true;
  if (rec.blockedUntil && now < rec.blockedUntil) return false;
  if (rec.blockedUntil && now >= rec.blockedUntil) { loginAttempts.delete(ip); return true; }
  return true;
}

function recordFail(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) { rec.blockedUntil = now + BLOCK_MS; rec.count = 0; }
  loginAttempts.set(ip, rec);
}

function resetAttempts(ip) { loginAttempts.delete(ip); }

// ================================================================
// CSRF — verifikasi Origin untuk non-GET
// ================================================================
function checkCSRF(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const ok = (origin && origin.endsWith('://' + host)) ||
             (referer && referer.includes('://' + host + '/'));
  if (!ok) return res.status(403).json({ status: 'error', message: 'CSRF check failed' });
  next();
}

// ================================================================
// Middleware Utama
// ================================================================
function requireAuth(req, res, next) {
  const session = getSession(req);

  if (!session) {
    // Gunakan req.originalUrl agar mendeteksi '/api/...' dengan benar
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ status: 'error', message: 'Belum login' });
    }
    return res.redirect('/login.html');
  }

  // Wajib ganti password dulu
  if (session.mustChangePw && req.originalUrl !== '/api/auth/change-password' &&
      req.originalUrl !== '/api/auth/logout' && req.originalUrl !== '/login.html') {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ status: 'error', message: 'Harus ganti password dulu', mustChangePw: true });
    }
    return res.redirect('/login.html?change=1');
  }

  req.user = session;

    // Redirect jika Siswa/Guru mencoba akses Dashboard/Admin UI (selain portal)
  // PENTING: Gunakan req.originalUrl dan pastikan BUKAN panggilan API
  // BLOKIR ROLE KIOSK: Hanya boleh akses kiosk.html dan API kiosk
  if (session.role === 'kiosk') {
    const allowedPaths = ['/kiosk.html', '/api/kiosk', '/api/auth/logout', '/api/auth/me'];
    const isAllowed = allowedPaths.some(p => req.originalUrl.startsWith(p));
    if (!isAllowed) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ status: 'error', message: 'Akses ditolak. Ini akun Kiosk.' });
      }
      return res.redirect('/kiosk.html');
    }
    req.user = session;
    return next();
  }

  // Redirect jika Siswa/Guru mencoba akses Dashboard/Admin UI (selain portal)
  if (session.role !== 'admin' && req.method === 'GET' && !req.originalUrl.startsWith('/api/')) {
    
    const adminPages = ['/', '/index.html', '/dashboard.html', '/buku.html', '/anggota.html', 
                        '/peminjaman.html', '/laporan.html', '/pengaturan.html', '/scan.html', '/buku-digital.html'];
    
    // Pisahkan query string jika ada (misal: /?search=)
    const currentPath = req.originalUrl.split('?')[0];

    if (adminPages.includes(currentPath)) {
      return res.redirect('/portal.html');
    }
  }

  next();
}

// Middleware khusus API: Mencegah Siswa/Guru memanipulasi data via API
// SECURITY: Role check helper (C1)
function requireRole(...roles) {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session || !roles.includes(session.role)) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }
    req.user = session;
    next();
  };
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || session.role !== 'admin') {
    return res.status(403).json({ status: 'error', message: 'Akses ditolak. Hanya untuk Admin.' });
  }
  req.user = session;
  next();
}

// SECURITY: Cleanup expired sessions (M1)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastSeenAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  createSession, destroySession, getSession,
  setSessionCookie, clearSessionCookie,
  checkRateLimit, recordFail, resetAttempts,
  checkCSRF, requireAuth, requireAdmin, requireRole
};