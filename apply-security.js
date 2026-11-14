const fs = require('fs');
const path = require('path');

console.log('🚀 Memulai patch keamanan otomatis...\n');

function editFile(filePath, search, replace, useRegex = false, insertBefore = false, insertAfter = false) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ File tidak ditemukan: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let newContent = content;

  if (useRegex) {
    newContent = content.replace(search, replace);
  } else {
    if (insertBefore) {
      newContent = content.replace(search, replace + '\n' + search);
    } else if (insertAfter) {
      newContent = content.replace(search, search + '\n' + replace);
    } else {
      newContent = content.replace(search, replace);
    }
  }

  if (newContent !== content) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✅ Berhasil update: ${filePath}`);
  } else {
    // console.log(`ℹ️ Tidak ada perubahan (mungkin sudah dipatch): ${filePath}`);
  }
}

// ============================================================================
// TASK C1 - Auth Guard & Rate Limit Kiosk
// ============================================================================
editFile('middleware/auth.js', 
  'function requireAdmin(req, res, next) {', 
  `// SECURITY: Role check helper (C1)\nfunction requireRole(...roles) {\n  return (req, res, next) => {\n    const session = getSession(req);\n    if (!session || !roles.includes(session.role)) {\n      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });\n    }\n    req.user = session;\n    next();\n  };\n}\n\nfunction requireAdmin(req, res, next) {`,
  false, true
);

editFile('middleware/auth.js',
  'requireAdmin\n};',
  'requireAdmin,\n  requireRole\n};'
);

editFile('routes/kiosk.js',
  "router.post('/scan', (req, res) => {\n  try {",
  `router.post('/scan', (req, res) => {\n  // SECURITY: Rate limit per session (C1)\n  const sessionId = req.user._id;\n  const now = Date.now();\n  const userAttempts = scanAttempts.get(sessionId) || [];\n  const validAttempts = userAttempts.filter(t => now - t < 60000);\n  \n  if (validAttempts.length >= 30) {\n    return res.status(429).json({ status: 'error', message: 'Terlalu banyak scan. Tunggu sebentar.' });\n  }\n  validAttempts.push(now);\n  scanAttempts.set(sessionId, validAttempts);\n\n  try {`
);

editFile('routes/kiosk.js',
  "const db = require('../db');",
  "const db = require('../db');\n\n// SECURITY: Rate limit map (C1)\nconst scanAttempts = new Map();"
);

editFile('server.js',
  "app.use('/api/kiosk', kioskRouter);",
  "// SECURITY: Protect kiosk routes (C1)\napp.use('/api/kiosk', auth.requireAuth, auth.requireRole('kiosk'), kioskRouter);"
);

// ============================================================================
// TASK H1 & H3 - Escape HTML & Hapus Inline Onclick
// ============================================================================
editFile('public/kiosk.html',
  '<button onclick="openModal(\'pinjaman\')"',
  '<button data-modal="pinjaman"'
);
editFile('public/kiosk.html',
  '<button onclick="openModal(\'buku\')"',
  '<button data-modal="buku"'
);
editFile('public/kiosk.html',
  '<button onclick="openModal(\'bebas\')"',
  '<button data-modal="bebas"'
);
editFile('public/kiosk.html',
  '<button onclick="closeModal()"',
  '<button data-modal-close'
);

editFile('public/kiosk.html',
  "let inactivityTimer;",
  `// SECURITY: Escape HTML (H1)\nconst escapeHtml = (s) => String(s ?? '')\n  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')\n  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');\n\n// SECURITY: Event delegation (H3)\ndocument.querySelectorAll('[data-modal]').forEach(btn =>\n  btn.addEventListener('click', () => openModal(btn.dataset.modal))\n);\ndocument.querySelectorAll('[data-modal-close]').forEach(btn =>\n  btn.addEventListener('click', () => closeModal())\n);\n\nlet inactivityTimer;`
);

editFile('public/kiosk.html', '${b.buku}', '${escapeHtml(b.buku)}', false);
editFile('public/kiosk.html', '${b.tanggal_jatuh}', '${escapeHtml(b.tanggal_jatuh)}', false);
editFile('public/kiosk.html', '${b.judul}', '${escapeHtml(b.judul)}', false);
editFile('public/kiosk.html', '${b.penulis}', '${escapeHtml(b.penulis)}', false);
editFile('public/kiosk.html', '${b.lokasi_rak}', '${escapeHtml(b.lokasi_rak)}', false);

editFile('public/buku-digital.html',
  '<button onclick="hapusBuku(${b.id})"',
  '<button data-action="hapus" data-id="${b.id}"'
);
editFile('public/buku-digital.html',
  'window.hapusBuku = async (id) => {',
  'async function hapusBuku(id) {'
);
editFile('public/buku-digital.html',
  '      } catch (err) {\n        alert(err.message);\n      }\n    };\n  });',
  '      } catch (err) {\n        alert(err.message);\n      }\n    }\n\n    tbody.addEventListener(\'click\', (e) => {\n      const btn = e.target.closest(\'[data-action="hapus"]\');\n      if (btn) hapusBuku(Number(btn.dataset.id));\n    });\n  });'
);

// ============================================================================
// TASK H2 - Ubah GET ke POST (Perpanjang Domain)
// ============================================================================
editFile('routes/pengingat.js',
  "router.get('/domain/perpanjang', (req, res) => {",
  "router.post('/domain/perpanjang', (req, res) => {"
);
editFile('public/js/pengaturan.js',
  "method: 'GET',\n      credentials: 'same-origin',",
  "method: 'POST',\n      credentials: 'same-origin',"
);
editFile('public/js/pengingat-domain.js',
  "method: 'GET',                     // GET → tidak dicek CSRF middleware Anda",
  "method: 'POST',"
);

// ============================================================================
// TASK M1 - Session TTL (Idle Timeout)
// ============================================================================
editFile('middleware/auth.js',
  "expiresAt: Date.now() + SESSION_TTL_MS",
  "expiresAt: Date.now() + SESSION_TTL_MS,\n    createdAt: Date.now(),\n    lastSeenAt: Date.now()"
);
editFile('middleware/auth.js',
  "session._id = match[1];",
  "// SECURITY: Idle timeout check (M1)\n  if (Date.now() - session.lastSeenAt > SESSION_TTL_MS) {\n    sessions.delete(match[1]);\n    return null;\n  }\n  session.lastSeenAt = Date.now();\n  session._id = match[1];"
);
editFile('middleware/auth.js',
  "module.exports = {",
  "// SECURITY: Cleanup expired sessions (M1)\nsetInterval(() => {\n  const now = Date.now();\n  for (const [id, session] of sessions.entries()) {\n    if (now - session.lastSeenAt > SESSION_TTL_MS) {\n      sessions.delete(id);\n    }\n  }\n}, 60 * 60 * 1000);\n\nmodule.exports = {"
);

// ============================================================================
// TASK M2 & M5 - Trust Proxy & Security Headers
// ============================================================================
editFile('server.js',
  "app.set('trust proxy', false);",
  "app.set('trust proxy', 'loopback, linklocal, uniquelocal'); // SECURITY: Safe trust proxy (M2)"
);

editFile('server.js',
  "app.use(express.json({ limit: '10mb' }));",
  `// SECURITY: Security headers (M5)\napp.disable('x-powered-by');\napp.use((req, res, next) => {\n  res.setHeader('X-Content-Type-Options', 'nosniff');\n  if (req.path !== '/kiosk.html') {\n    res.setHeader('X-Frame-Options', 'DENY');\n  } else {\n    res.setHeader('X-Frame-Options', 'SAMEORIGIN');\n  }\n  res.setHeader('Referrer-Policy', 'same-origin');\n  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');\n  next();\n});\n\napp.use(express.json({ limit: '10mb' }));`
);

// ============================================================================
// TASK M3 - Magic Bytes PDF
// ============================================================================
editFile('routes/digital.js',
  "const fs = require('fs');",
  `const fs = require('fs');\n\n// SECURITY: Validasi magic bytes PDF (M3)\nfunction isPdf(filePath) {\n  const buf = Buffer.alloc(5);\n  const fd = fs.openSync(filePath, 'r');\n  fs.readSync(fd, buf, 0, 5, 0);\n  fs.closeSync(fd);\n  return buf.toString('ascii') === '%PDF-';\n}`
);
editFile('routes/digital.js',
  "res.sendFile(filePath);",
  `// SECURITY: Attachment headers (M3)\n    const filename = path.basename(buku.file_url);\n    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');\n    res.setHeader('X-Content-Type-Options', 'nosniff');\n    res.setHeader('Content-Type', 'application/pdf');\n    res.sendFile(filePath);`
);
editFile('routes/digital.js',
  "if (!judul) return res.status(400).json({ status: 'error', message: 'Judul wajib diisi' });",
  "if (!judul) return res.status(400).json({ status: 'error', message: 'Judul wajib diisi' });\n\n      // SECURITY: Cek magic bytes (M3)\n      if (!isPdf(req.file.path)) {\n        fs.unlinkSync(req.file.path);\n        return res.status(400).json({ status: 'error', message: 'File bukan PDF valid' });\n      }"
);

// ============================================================================
// TASK M7 - Guard Production
// ============================================================================
editFile('scripts/test-otomatis.js',
  "const express = require('express');",
  "// SECURITY: Guard production (M7)\nif (process.env.NODE_ENV === 'production') {\n  console.error('❌ Tidak boleh dijalankan di production. Set NODE_ENV != production.');\n  process.exit(1);\n}\n\nconst express = require('express');"
);

// ============================================================================
// TASK M8 - Password Admin ke File
// ============================================================================
editFile('db.js',
  "console.log(`\\n🔐 AKUN ADMIN DIBUAT\\nUsername: admin\\nPassword: ${randomPassword}\\n`);",
  `// SECURITY: Write to file instead of console (M8)\n  const pwPath = path.join(__dirname, 'database', 'password-admin-first-login.txt');\n  fs.writeFileSync(pwPath, randomPassword, { mode: 0o600 });\n  console.log(\`\\n📄 Password admin ditulis ke: \${pwPath}\`);\n  console.log(\`   Buka file tersebut, catat password, lalu HAPUS file tersebut setelah login pertama.\\n\`);`
);

// ============================================================================
// TASK L3 - Satukan escapeHtml
// ============================================================================
function removeFunction(filePath, funcName) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  const regex = new RegExp(`function ${funcName}\\\\(.*?\\\\{([\\\\s\\\\S]*?)\\\\n\\\\}`, 'g');
  let newContent = content.replace(regex, '');
  if (newContent !== content) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`✅ Menghapus ${funcName} duplikat di: ${filePath}`);
  }
}

removeFunction('public/js/laporan.js', 'escapeHtml');
removeFunction('public/js/portal.js', 'escapeHtml');
removeFunction('public/barcode-buku.html', 'escapeHtml');

console.log('\n🎉 SEMUA PATCH KEAMANAN SELESAI DITERAPKAN!');
console.log('⚠️  PENTING: Periksa kembali hasilnya dengan "git diff", lalu jalankan "npm start" untuk mengetes.');