// ================================================================
// scan.js — Final (match dengan scan.html wrapper)
// ================================================================

const state = { 
  bukuList: [], 
  processing: false, 
  isExtend: false, // <--- GANTI INI
  isPaket: false, 
  isNonton: false 
};

// ================================================================
// FULLSCREEN + EXIT
// ================================================================
async function masukFullscreen() {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch(e){}
}
function keluar() {
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  window.location.href = '/';
}
document.addEventListener('click', masukFullscreen, { once: true });
document.addEventListener('keydown', masukFullscreen, { once: true });

// ================================================================
// UTILITY
// ================================================================
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

let audioCtx = null;
function beep(freq = 900, dur = 0.1) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch(e){}
}
const beepOk   = () => beep(1000, 0.12);
const beepErr  = () => { beep(300, 0.25); setTimeout(() => beep(250, 0.25), 150); };
const beepWarn = () => beep(600, 0.15);
const beepBig  = () => { beepOk(); setTimeout(beepOk, 100); setTimeout(beepOk, 200); };

// ================================================================
// UI — semua pakai inline style (match dengan scan.html)
// ================================================================
// UI RENDER (Versi Anti-Crash)
function showStatus(text, sub, type = 'info', icon = 'book') {
  // 1. Cari elemen dengan aman
  const wrap = document.getElementById('status-icon-wrap') || document.getElementById('status-box');
  const textEl = document.getElementById('status-text') || document.getElementById('status-box');
  const subEl = document.getElementById('status-sub') || document.getElementById('status-box');

  // 2. Update Icon (jika wrap ada)
  if (wrap) {
    if (wrap.id === 'status-box') {
      wrap.className = `card p-8 text-center shadow-lg border-2 transition-all ${
        type === 'success' ? 'bg-green-50 border-green-300' : 
        type === 'error' ? 'bg-red-50 border-red-300' : 
        type === 'warn' ? 'bg-amber-50 border-amber-300' : 'bg-white'
      }`;
      if (wrap.innerHTML.includes('status-icon-wrap')) {
         // Biarkan jika ada inner icon
      }
    } else {
      wrap.className = type === 'info' ? '' : type;
      const iconMap = { info: 'book', success: 'check', error: 'alert', warn: 'alert', processing: 'loader' };
      const svgIcons = {
        book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        loader: '<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>'
      };
      wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:34px;height:34px;">${svgIcons[iconMap[type] || 'book']}</svg>`;
    }
  }

  // 3. Update Teks
  if (textEl) {
    textEl.textContent = text;
    textEl.style.color = type === 'success' ? '#047857' : type === 'error' ? '#b91c1c' : type === 'warn' ? '#b45309' : '#0f172a';
  }
  
  // 4. Update Sub-teks
  if (subEl && subEl.id === 'status-sub') {
    subEl.textContent = sub || '';
  }
}

function addLog(msg, type = 'info') {
  const colors = { info: '#475569', success: '#16a34a', error: '#dc2626', warn: '#d97706' };
  const t = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.createElement('div');
  el.style.cssText = `color: ${colors[type]}; padding: 6px 0; border-bottom: 1px solid #f1f5f9;`;
  el.innerHTML = `<span style="color: #94a3b8;">[${t}]</span> ${msg}`;
  if (window.lucide) lucide.createIcons();

  const log = document.getElementById('log');
  log.insertBefore(el, log.firstChild);
}

function renderList() {
  const box = document.getElementById('list-box');
  const content = document.getElementById('list-content');

  if (state.bukuList.length === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  document.getElementById('list-count').textContent = state.bukuList.length + ' buku';

  content.innerHTML = state.bukuList.map((b, i) => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px;
                background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px;">
      <div style="width: 32px; height: 32px; border-radius: 50%; background: #059669;
                  color: #fff; display: flex; align-items: center; justify-content: center;
                  font-weight: 700; font-size: 0.875rem; flex-shrink: 0;">${i + 1}</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500; color: #1e293b; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis;">${escapeHtml(b.judul)}</div>
        <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">${escapeHtml(b.kode_buku)}</div>
      </div>
      <button data-action="hapusBuku" data-id="${b.id}"
        style="color: #ef4444; background: none; border: none; cursor: pointer;
               padding: 8px; border-radius: 8px;">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function hapusBuku(id) {
  state.bukuList = state.bukuList.filter(b => b.id !== id);
  renderList();
  addLog('<i data-lucide="trash-2"></i> Hapus 1 buku dari list', 'warn');
  document.getElementById('scan-input').focus();
}

// ================================================================
// PROCESS SCAN
// ================================================================
async function processScan(kode) {
  try {
    const res = await apiGet('/scan/lookup/' + encodeURIComponent(kode));

    if (res.tipe === 'buku') {
      const existing = state.bukuList.find(b => b.id === res.data.id);
      if (existing) {
        beepWarn(); showStatus('Sudah Discan', res.data.judul, 'warn'); return;
      }
      state.bukuList.push({ id: res.data.id, kode_buku: res.data.kode_buku, judul: res.data.judul });
      beepOk();
      showStatus('Buku Ditambah', res.data.judul, 'success');
      addLog('<i data-lucide="book"></i> + ' + escapeHtml(res.data.judul), 'success');
      renderList();
      
    } else if (res.tipe === 'anggota') {
      // DETEKSI NIAT: Jika ada buku di keranjang = Pinjam. Jika kosong = Baca.
      if (state.bukuList.length > 0) {
        await prosesSemua(res.data, 'pinjam'); 
              } else {
          const niat = state.isNonton ? 'nonton' : 'baca';
          await prosesTamu(res.data, niat); // Cek apakah mode nonton aktif
        }
    }
  } catch (err) {
    beepErr();
    showStatus('Tidak Dikenali', err.message, 'error');
  }
}

// ================================================================
// PROSES SEMUA (kembali + pinjam)
// ================================================================
async function prosesSemua(anggota, tujuan = 'pinjam') {
  try {
    showStatus('Memproses...', anggota.nama, 'info', '<i data-lucide="loader"></i>');
    addLog('👤 ' + escapeHtml(anggota.nama) + ' (' + anggota.nis + ') — proses ' + state.bukuList.length + ' buku', 'info');

        const payload = {
      anggota_id: anggota.id,
      buku_list: state.bukuList.map(b => ({ buku_id: b.id, jumlah: 1 })),
            is_extend: state.isExtend,
      is_paket: state.isPaket // <--- TAMBAHKAN INI
    };

    const res = await apiPost('/scan/proses', payload);

    beepBig();
    const totalKembali = res.pengembalian ? res.pengembalian.length : 0;
    const totalPinjam  = res.peminjaman ? res.peminjaman.buku.length : 0;

    showStatus('SELESAI', `${totalKembali} kembali · ${totalPinjam} pinjam`, 'success', '<i data-lucide="check-circle"></i>');
    addLog(`<i data-lucide="check-circle"></i> Selesai — ${totalKembali} kembali, ${totalPinjam} pinjam`, 'success');

    tampilkanSukses(anggota, res);

    // Catat ke Buku Tamu sebagai 'pinjam'
    await apiPost('/scan/tamu', { anggota_id: anggota.id, tujuan: 'pinjam' });

          state.bukuList = [];
      state.forceReturn = false;
      state.isPaket = false;
      
      const btnK = document.getElementById('btn-mode-kembalikan');
      if (btnK) { btnK.style.background = '#fff'; btnK.style.borderColor = '#cbd5e1'; btnK.style.color = '#475569'; }
      const btnP = document.getElementById('btn-mode-paket');
      if (btnP) { btnP.style.background = '#f8fafc'; btnP.style.borderColor = '#cbd5e1'; btnP.style.color = '#475569'; }
    
    const toggleUI = document.getElementById('toggle-force-return');
    if (toggleUI) toggleUI.checked = false;
    
    const labelUI = document.getElementById('label-force-return');
    if (labelUI) {
      labelUI.style.background = '#f1f5f9';
      labelUI.style.color = '#475569';
    }
    
    renderList();

    setTimeout(() => {
      document.getElementById('modal-sukses').style.display = 'none';
      showStatus('Siap Scan Buku', 'Scan buku untuk peminjaman/pengembalian berikutnya', 'info', '<i data-lucide="book-open"></i>');
    }, 3000);

  } catch (err) {
    beepErr();
    showStatus('Gagal', err.message, 'error', '<i data-lucide="x-circle"></i>');
    addLog('<i data-lucide="x-circle"></i> ' + err.message, 'error');
  }
}

// ================================================================
// MODAL SUKSES
// ================================================================
function tampilkanSukses(anggota, res) {
  document.getElementById('sukses-sub').textContent =
    `${anggota.nama} · ${anggota.nis}${anggota.kelas ? ' · ' + anggota.kelas : ''}`;

  let html = '';

  if (res.pengembalian && res.pengembalian.length) {
    html += `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 12px;">
        <div style="font-weight: 700; color: #15803d; font-size: 0.875rem; margin-bottom: 8px;">
          <i data-lucide="download"></i> Dikembalikan (${res.pengembalian.length})
        </div>
        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem;">
          ${res.pengembalian.map(b => `
            <li style="display: flex; justify-content: space-between;">
              <span>📗 ${escapeHtml(b.judul)}</span>
              ${b.denda > 0
                ? `<span style="color: #dc2626; font-size: 0.75rem;">Denda Rp ${b.denda.toLocaleString('id-ID')}</span>`
                : '<span style="color: #16a34a; font-size: 0.75rem;">✓</span>'}
            </li>
          `).join('')}
        </ul>
      </div>`;
  }

  if (res.peminjaman && res.peminjaman.buku.length) {
    html += `
      <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 12px;">
        <div style="font-weight: 700; color: #1e40af; font-size: 0.875rem; margin-bottom: 8px;">
          <i data-lucide="upload"></i> Dipinjam (${res.peminjaman.buku.length})
        </div>
        <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem;">
          ${res.peminjaman.buku.map(b => `<li>📘 ${escapeHtml(b.judul)}</li>`).join('')}
        </ul>
        <div style="font-size: 0.75rem; color: #2563eb; margin-top: 8px; padding-top: 8px; border-top: 1px solid #93c5fd;">
          Kode: <b>${escapeHtml(res.peminjaman.kode_pinjam)}</b> ·
          Jatuh tempo: <b>${res.peminjaman.tanggal_jatuh}</b>
        </div>
      </div>`;
  }

  document.getElementById('sukses-detail').innerHTML = html;
  document.getElementById('modal-sukses').style.display = 'flex';
  if (window.lucide) lucide.createIcons();
}

// ================================================================
// FUNGSI BARU: PROSES BUKU TAMU (OTOMATIS)
// ================================================================
async function prosesTamu(anggota, tujuan = 'baca') {
  console.log("🚀 Mengirim ke backend dengan tujuan:", tujuan);
  try {
    const res = await apiPost('/scan/tamu', { anggota_id: anggota.id, tujuan });
    
    // 1. TENTUKAN TEKS TUJUAN
    let teksTujuan = 'BACA DI TEMPAT';
    if (tujuan === 'pinjam') teksTujuan = 'MEMINJAM BUKU';
    if (tujuan === 'nonton') teksTujuan = 'NONTON FILM'; // <--- INI YANG BIKIN BISA "NONTON FILM"

    if (res.tipe === 'masuk') {
      beepOk(); setTimeout(beepOk, 150);
      
      // 2. UPDATE UI SECARA LANGSUNG (TANPA showStatus)
      document.getElementById('status-box').className = `card p-8 text-center shadow-lg border-2 transition-all bg-green-50 border-green-300`;
      document.getElementById('status-icon-wrap').className = 'success';
      document.getElementById('status-icon-wrap').innerHTML = `<svg class="w-16 h-16 mx-auto text-green-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
      
      document.getElementById('status-text').className = `text-3xl font-bold mt-4`;
      document.getElementById('status-text').style.color = '#047857';
      document.getElementById('status-text').textContent = res.anggota.nama.toUpperCase();
      
      document.getElementById('status-sub').innerHTML = `
        <div class="text-lg mt-2 font-medium">Selamat Datang!</div>
        <div class="text-sm mt-2 text-slate-500 font-semibold uppercase">${teksTujuan}</div>
        <div class="text-sm mt-1 text-slate-500">Jam ${res.waktu}</div>
      `;
      addLog(`📥 Masuk: ${res.anggota.nama} (${teksTujuan})`, 'success');

    } else if (res.tipe === 'sudah') {
      beepWarn(); 
      document.getElementById('status-box').className = `card p-8 text-center shadow-lg border-2 transition-all bg-blue-50 border-blue-300`;
      document.getElementById('status-icon-wrap').className = 'processing';
      document.getElementById('status-icon-wrap').innerHTML = `<svg class="w-16 h-16 mx-auto text-blue-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
      
      document.getElementById('status-text').className = `text-3xl font-bold mt-4`;
      document.getElementById('status-text').style.color = '#1d4ed8';
      document.getElementById('status-text').textContent = res.anggota.nama.toUpperCase();
      
      document.getElementById('status-sub').innerHTML = `
        <div class="text-lg mt-2 font-medium">Anda sudah tercatat hari ini.</div>
        <div class="text-sm mt-1 text-slate-500">Silakan nikmati fasilitas perpustakaan.</div>
      `;
      addLog(`ℹ️ ${res.anggota.nama} sudah discan hari ini`, 'info');
    }

    // 3. RESET STATE SETELAH 3 DETIK
    setTimeout(() => { 
      state.isNonton = false;
      const btnNonton = document.getElementById('btn-mode-nonton');
      if (btnNonton) {
        btnNonton.style.background = '#f8fafc'; 
        btnNonton.style.borderColor = '#cbd5e1'; 
        btnNonton.style.color = '#475569';
      }
      showStatus('Siap Scan', 'Scan Buku untuk pinjam, atau Kartu untuk baca', 'info'); 
    }, 3000);

  } catch (err) {
    console.error(err);
    beepErr(); 
    showStatus('Gagal', err.message, 'error');
  }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  if (window.lucide) lucide.createIcons();

    // --- TOMBOL PERPANJANG ---
  const btnPerpanjang = document.getElementById('btn-mode-perpanjang');
  if (btnPerpanjang) {
    btnPerpanjang.addEventListener('click', () => {
      state.isExtend = !state.isExtend;
      if (state.isExtend) {
        btnPerpanjang.style.background = '#fef3c7'; // Kuning
        btnPerpanjang.style.borderColor = '#fcd34d';
        btnPerpanjang.style.color = '#b45309';
        addLog('Mode: Perpanjang Buku Aktif', 'warn');
      } else {
        btnPerpanjang.style.background = '#fff';
        btnPerpanjang.style.borderColor = '#cbd5e1';
        btnPerpanjang.style.color = '#475569';
        addLog('Mode: Normal (Kembalikan)', 'info');
      }
    });
  }

        const btnNonton = document.getElementById('btn-mode-nonton');
  if (btnNonton) {
    btnNonton.addEventListener('click', () => {
      console.log("Tombol Nonton BERHASIL DIKLIK!"); // <--- TAMBAHKAN INI
      state.isNonton = !state.isNonton;
      if (state.isNonton) {
        btnNonton.style.background = '#f3e8ff'; // Ungu
        btnNonton.style.borderColor = '#d8b4fe';
        btnNonton.style.color = '#7e22ce';
        addLog('Mode: Nonton Film Aktif', 'warn');
      } else {
        btnNonton.style.background = '#f8fafc';
        btnNonton.style.borderColor = '#cbd5e1';
        btnNonton.style.color = '#475569';
        addLog('Mode: Normal', 'info');
      }
    });
  }

  // --- LOGIKA TOMBOL PAKET ---
  const btnPaket = document.getElementById('btn-mode-paket');
  if (btnPaket) {
    btnPaket.addEventListener('click', () => {
      state.isPaket = !state.isPaket;
      if (state.isPaket) {
        btnPaket.style.background = '#dbeafe';
        btnPaket.style.borderColor = '#93c5fd';
        btnPaket.style.color = '#1d4ed8';
        addLog('Mode: Paket Tahunan Aktif', 'warn');
      } else {
        btnPaket.style.background = '#f8fafc';
        btnPaket.style.borderColor = '#cbd5e1';
        btnPaket.style.color = '#475569';
        addLog('Mode: Reguler', 'info');
      }
    });
  }

  // --- END PATCH ---
  const input = document.getElementById('scan-input');

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const kode = input.value.trim();
      input.value = '';
      if (!kode || state.processing) return;
      state.processing = true;
      try { await processScan(kode); }
      finally { state.processing = false; input.focus(); }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('button, select, a, input')) input.focus();
  });
  setInterval(() => { if (document.activeElement.tagName === 'BODY') input.focus(); }, 1000);

  document.getElementById('btn-exit').addEventListener('click', keluar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.fullscreenElement) keluar(); });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    document.getElementById('log').innerHTML = '';
  if (window.lucide) lucide.createIcons();

    input.focus();
  });

  setTimeout(() => input.focus(), 200);
  addLog('🚀 Mode Scan siap — scan buku dulu, lalu kartu', 'success');
});

window.hapusBuku = hapusBuku;