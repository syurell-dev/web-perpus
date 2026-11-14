document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  try {
    const me = await apiGet('/auth/me');
    if (me.username) {
      document.getElementById('greeting').textContent = `Halo, ${me.nama || me.username}!`;
      document.getElementById('nav-username').textContent = me.nama || me.username;
    }
  } catch (e) { window.location.href = '/login.html'; return; }

  document.getElementById('btn-logout').addEventListener('click', async () => {
    if(confirm('Yakin ingin keluar?')) {
      await apiPost('/auth/logout', {});
      window.location.href = '/login.html';
    }
  });

  // --- LOAD STATISTIK & LEADERBOARD ---
  try {
    const res = await apiGet('/portal/stats');
    if (res.data.statsPribadi) {
      document.getElementById('stat-total').textContent = res.data.statsPribadi.totalPinjam;
      
      const listPinjaman = document.getElementById('list-pinjaman');
      const pinjaman = res.data.statsPribadi.pinjamanAktif;
      
      if (pinjaman.length === 0) {
        listPinjaman.innerHTML = `
          <div class="py-8 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <i data-lucide="check-circle" class="w-8 h-8 mb-2 text-emerald-400"></i>
            <span class="text-sm font-medium">Kamu tidak sedang meminjam buku fisik.</span>
          </div>`;
      } else {
        listPinjaman.innerHTML = pinjaman.map(p => {
          const telat = p.tanggal_jatuh < new Date().toISOString().split('T')[0];
          const borderColor = telat ? 'border-red-500' : 'border-emerald-500';
          const textColor = telat ? 'text-red-600' : 'text-slate-700';
          const bgBadge = telat ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600';
          
          return `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center border-l-4 ${borderColor} hover:shadow-md transition">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                  <i data-lucide="book" class="w-5 h-5 text-slate-400"></i>
                </div>
                <div>
                  <div class="font-bold text-slate-800 line-clamp-1">${escapeHtml(p.buku || 'Buku')}</div>
                  <div class="text-xs text-slate-500 mt-1 font-mono">${p.kode_pinjam}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Jatuh Tempo</div>
                <div class="text-sm font-bold ${textColor} ${bgBadge} px-2 py-1 rounded-md">${p.tanggal_jatuh}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    } else {
      document.getElementById('stat-total').textContent = '-';
      document.getElementById('list-pinjaman').innerHTML = `<div class="p-4 bg-white rounded-xl text-center text-sm text-slate-500">Akun Guru/Admin tidak memiliki data pinjaman siswa.</div>`;
    }

  } catch (err) { console.error(err); }

  // --- LOAD KATALOG BUKU DIGITAL ---
  try {
    const res = await apiGet('/digital');
    const listDigital = document.getElementById('list-digital');
    
    if (res.data.length === 0) {
      listDigital.innerHTML = `<div class="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm"><i data-lucide="book-x" class="w-10 h-10 mb-2 opacity-50"></i><span class="text-sm font-medium">Belum ada buku digital yang tersedia.</span></div>`;
    } else {
      // Render HTML Katalog dengan Canvas
      listDigital.innerHTML = res.data.map(b => `
        <a href="/reader.html?id=${b.id}" class="book-card bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group h-full transition-all hover:-translate-y-1 hover:shadow-xl">
          
          <div class="aspect-[3/4] bg-slate-100 relative overflow-hidden flex items-center justify-center">
            <!-- Canvas untuk Render PDF -->
            <canvas id="pdf-canvas-${b.id}" class="w-full h-full object-cover hidden"></canvas>
            
            <!-- Loading Spinner -->
            <div id="pdf-loading-${b.id}" class="absolute inset-0 flex items-center justify-center">
              <i data-lucide="loader" class="w-6 h-6 animate-spin text-emerald-500"></i>
            </div>

            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition pointer-events-none"></div>
            <div class="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm pointer-events-none z-10 flex items-center gap-1"><i data-lucide="file-text" class="w-3 h-3"></i> PDF</div>
            
            <div class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-emerald-600/90 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 flex items-center gap-1.5 pointer-events-none z-10 w-max">
              <i data-lucide="book-open" class="w-4 h-4"></i> Baca Buku
            </div>
          </div>
          
          <div class="p-4 flex-1 flex flex-col justify-between">
            <div class="font-bold text-slate-800 text-sm line-clamp-2 leading-snug group-hover:text-emerald-600 transition">${escapeHtml(b.judul)}</div>
            <div class="text-[11px] text-slate-500 mt-2 truncate flex items-center gap-1.5">
              <i data-lucide="pen-tool" class="w-3 h-3"></i> ${escapeHtml(b.penulis || 'Anonim')}
            </div>
          </div>
        </a>
      `).join('');
      
      if (window.lucide) lucide.createIcons();

      // Render PDF ke Canvas (Halaman 1)
      res.data.forEach(b => renderPdfThumb(b.id));
    }
  } catch (err) {
    console.error('Katalog Error:', err);
    document.getElementById('list-digital').innerHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center text-red-500 bg-red-50 rounded-2xl border border-red-100">
        <i data-lucide="alert-circle" class="w-10 h-10 mb-2"></i>
        <span class="text-sm font-medium">${err.message || 'Gagal memuat katalog.'}</span>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
});

// FUNGSI RENDER PDF KE CANVAS DENGAN FALLBACK & PAKSA NORMAL
// FUNGSI RENDER PDF YANG LEBIH STABIL (Anti-Gagal & Anti-Terbalik)
async function renderPdfThumb(id) {
  const canvas = document.getElementById(`pdf-canvas-${id}`);
  const loader = document.getElementById(`pdf-loading-${id}`);

  try {
    // 1. Ambil file PDF sebagai ArrayBuffer (lebih stabil dari cache)
    const response = await fetch(`/api/digital/file/${id}`);
    
    // Cek jika server malah mengembalikan halaman login (HTML/JSON)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('text/html')) {
      throw new Error('Sesi login habis atau file tidak ditemukan');
    }

    const arrayBuffer = await response.arrayBuffer();

    // 2. Muat PDF dari ArrayBuffer
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); 
    
    // 3. Render ke Canvas
    const context = canvas.getContext('2d');
    
    // Gunakan rotasi bawaan dari PDF (jika PDF tegak, hasilnya tegak)
    const viewport = page.getViewport({ scale: 2.0 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    // Hentikan render sebelumnya jika ada (mencegah error "Canvas in use")
    if (page._renderTask) page._renderTask.cancel();
    page._renderTask = page.render(renderContext);
    
    await page._renderTask.promise;
    
    // 4. Tampilkan
    canvas.classList.remove('hidden');
    if (loader) loader.style.display = 'none';
    
  } catch (err) {
    console.error(`Gagal render PDF ID ${id}:`, err);
    if (loader) {
      loader.innerHTML = `
        <div class="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-400">
          <i data-lucide="book" class="w-12 h-12 mb-2 text-slate-300"></i>
          <span class="text-[10px] font-medium px-4 text-center leading-tight">Preview tidak tersedia</span>
        </div>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}
