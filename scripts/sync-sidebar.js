// ================================================================
// scripts/sync-sidebar.js — Sinkronisasi Sidebar Admin Otomatis (Lucide)
// ================================================================
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const EXCLUDE_FILES = ['login.html', 'portal.html', 'reader.html', 'barcode-buku.html'];

function getSidebarTemplate(activeMenu) {
  const isActive = (menu) => activeMenu === menu ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-800 text-slate-300';

  return `<aside class="w-60 bg-slate-900 text-slate-100 flex-shrink-0 flex flex-col">
      <div class="p-5 border-b border-slate-700">
        <div class="flex items-center gap-2">
          <img src="/img/logo.png" alt="Logo" style="width:42px;height:42px;object-fit:contain;background:#fff;border-radius:10px;padding:4px;flex-shrink:0;">
          <div style="display:flex;flex-direction:column;">
            <div class="font-bold text-sm">SMPN 1 Taman</div>
            <div class="text-xs text-slate-400">Sidoarjo</div>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-3 space-y-1 text-sm">
        <a href="/" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('dashboard')}">
          <i data-lucide="layout-dashboard" class="w-5 h-5"></i> <span>Dashboard</span>
        </a>
        <a href="/buku.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('buku')}">
          <i data-lucide="book" class="w-5 h-5"></i> <span>Buku</span>
        </a>
        <a href="/anggota.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('anggota')}">
          <i data-lucide="users" class="w-5 h-5"></i> <span>Anggota</span>
        </a>
        <a href="/peminjaman.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('peminjaman')}">
          <i data-lucide="refresh-cw" class="w-5 h-5"></i> <span>Peminjaman</span>
        </a>
        <a href="/scan.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('scan')}">
          <i data-lucide="scan-line" class="w-5 h-5"></i> <span>Scan Mode</span>
        </a>
        <a href="/buku-digital.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('digital')}">
          <i data-lucide="tablet" class="w-5 h-5"></i> <span>Buku Digital</span>
        </a>
        <a href="/laporan.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('laporan')}">
          <i data-lucide="bar-chart-3" class="w-5 h-5"></i> <span>Laporan</span>
        </a>
        <a href="/pengaturan.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('pengaturan')}">
          <i data-lucide="settings" class="w-5 h-5"></i> <span>Pengaturan</span>
        </a>
      </nav>

      <div class="p-4 border-t border-slate-700">
        <button id="btn-logout-admin" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition mb-4 border border-red-500/20">
          <i data-lucide="log-out" class="w-4 h-4"></i> Logout
        </button>
        <div class="text-center text-xs text-slate-500 app-version-text">v1.3.5</div>
      </div>
      
      <script>
        // Script otomatis untuk tombol Logout Admin
        document.getElementById('btn-logout-admin')?.addEventListener('click', async () => {
          if (confirm('Yakin ingin keluar dari Dashboard Admin?')) {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login.html';
            } catch (err) {
              alert('Gagal logout, silakan coba lagi.');
            }
          }
        });
      </script>
    </aside>`;
}

function sync() {
  console.log('🔄 Memulai sinkronisasi sidebar (SVG Lucide)...\n');

  const files = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html') && !EXCLUDE_FILES.includes(f));

  files.forEach(file => {
    const filePath = path.join(PUBLIC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');

    let activeMenu = '';
    if (file === 'index.html' || file === 'dashboard.html') activeMenu = 'dashboard';
    else if (file === 'buku.html') activeMenu = 'buku';
    else if (file === 'anggota.html') activeMenu = 'anggota';
    else if (file === 'peminjaman.html') activeMenu = 'peminjaman';
    else if (file === 'scan.html') activeMenu = 'scan';
    else if (file === 'buku-digital.html') activeMenu = 'digital';
    else if (file === 'laporan.html') activeMenu = 'laporan';
    else if (file === 'pengaturan.html') activeMenu = 'pengaturan';

    const newSidebar = getSidebarTemplate(activeMenu);

    const regex = /<aside[^>]*>[\s\S]*?<\/aside>/i;

    if (regex.test(content)) {
      content = content.replace(regex, newSidebar);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${file}`);
    } else {
      console.log(`⚠️  Skip: ${file} (Tidak ada tag <aside>)`);
    }
  });

  console.log('\n🎉 Selesai! Sidebar di semua halaman admin sudah disamakan dengan ikon Lucide.');
}

sync();