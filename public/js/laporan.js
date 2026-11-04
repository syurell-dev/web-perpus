const state = {
  dari: '', sampai: '', status: '',
  activeTab: 'peminjaman',
  bukuData: []
};

// ================================================================
// HELPER: FUNGSI CETAK VIA IFRAME (ANTI-KONFLIK)
// ================================================================
function cetakDalamIframe(htmlContent, isLandscape = false) {
  const iframe = document.createElement('iframe');
  // Posisikan iframe di luar layar, tapi JANGAN 0x0 agar browser tetap merendernya
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px'; 
  iframe.style.top = '-9999px';
  iframe.style.width = '1024px'; 
  iframe.style.height = '768px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  
  // Load CSS print bawaan
  const cssLink = `<link rel="stylesheet" href="/css/print.css" media="print">`;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cetak Laporan</title>
      ${cssLink}
      <style>
        @page { 
          size: A4 ${isLandscape ? 'landscape' : 'portrait'}; 
          margin: ${isLandscape ? '0' : '1cm'}; 
        }
        body { margin: 0; padding: 0; background: #fff; }
        /* Paksa print-area tampil */
        #print-area { display: block !important; }
      </style>
    </head>
    <body>
      <!-- BUNGKUS DENGAN #print-area AGAR TIDAK DI-HIDE OLEH print.css -->
      <div id="print-area">
        ${htmlContent}
      </div>
    </body>
    </html>
  `);
  doc.close();

  // Beri waktu CSS termuat, lalu print
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 500);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatTanggal(str) {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${parseInt(d)} ${bulan[parseInt(m)-1]} ${y}`;
}

function formatRupiah(n) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}

// ================================================================
// 1. LOAD PEMINJAMAN
// ================================================================
async function loadPeminjaman() {
  const tbody = document.getElementById('tabel-laporan');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto"></i> Memuat data...</td></tr>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await apiGet('/laporan/peminjaman', {
      dari: state.dari, sampai: state.sampai, status: state.status
    });
    renderTabelPeminjaman(res.data);
    renderRekapPeminjaman(res.rekap);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500"><i data-lucide="x-circle" class="w-5 h-5 mx-auto mb-1"></i> ${err.message}</td></tr>`;
    if (window.lucide) lucide.createIcons();
  }
}

function renderTabelPeminjaman(list) {
  const tbody = document.getElementById('tabel-laporan');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400"><i data-lucide="inbox" class="w-5 h-5 mx-auto mb-1"></i> Tidak ada data di periode ini</td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const today = todayStr();
  tbody.innerHTML = list.map((p, i) => {
    const statusBadge = {
      'dipinjam':     '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Dipinjam</span>',
      'sebagian':     '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Sebagian</span>',
      'dikembalikan': '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Kembali</span>'
    }[p.status] || p.status;

    const telat = (p.status === 'dipinjam' || p.status === 'sebagian') && p.tanggal_jatuh < today;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-700">${escapeHtml(p.kode_pinjam)}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800">${escapeHtml(p.anggota_nama)}</div>
          <div class="text-xs text-slate-400">${escapeHtml(p.anggota_nis)} ${p.anggota_kelas ? '· ' + escapeHtml(p.anggota_kelas) : ''}</div>
        </td>
        <td class="px-4 py-3 text-slate-600 text-xs">${formatTanggal(p.tanggal_pinjam)}</td>
        <td class="px-4 py-3 text-xs ${telat ? 'text-red-600 font-medium' : 'text-slate-600'}">
          ${formatTanggal(p.tanggal_jatuh)}${telat ? ' (Terlambat)' : ''}
        </td>
        <td class="px-4 py-3 text-slate-600 text-xs max-w-xs">
          <div class="font-medium">${p.jumlah_buku} buku</div>
          <div class="text-slate-400 truncate" title="${escapeHtml(p.judul_buku || '')}">${escapeHtml(p.judul_buku || '-')}</div>
        </td>
        <td class="px-4 py-3 text-center">${statusBadge}</td>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRekapPeminjaman(r) {
  document.getElementById('rekap-transaksi').textContent = r.total_transaksi || 0;
  document.getElementById('rekap-buku').textContent = r.total_buku || 0;
  document.getElementById('rekap-terlambat').textContent = r.terlambat || 0;
}

// ================================================================
// 2. LOAD STATISTIK BUKU
// ================================================================
async function loadBukuStats() {
  const tbody = document.getElementById('tabel-buku-laporan');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto"></i> Memuat data...</td></tr>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await apiGet('/laporan/buku');
    state.bukuData = res.data;

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400"><i data-lucide="inbox" class="w-5 h-5 mx-auto mb-1"></i> Belum ada buku</td></tr>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = res.data.map((b, i) => `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-700">${escapeHtml(b.kode_buku)}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(b.judul)}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${escapeHtml(b.penulis) || '-'}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${escapeHtml(b.kategori) || '-'}</td>
        <td class="px-4 py-3 text-center text-slate-600">${b.stok_tersedia}/${b.stok_total}</td>
        <td class="px-4 py-3 text-center font-bold text-blue-600">${b.total_dipinjam}×</td>
        <td class="px-4 py-3 text-center font-medium text-amber-600">${b.sedang_dipinjam}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500"><i data-lucide="x-circle" class="w-5 h-5 mx-auto mb-1"></i> ${err.message}</td></tr>`;
    if (window.lucide) lucide.createIcons();
  }
}

// ================================================================
// 3. LOAD KUNJUNGAN (BUKU TAMU) - HANYA ADA SATU FUNGSI INI
// ================================================================
async function loadKunjungan() {
  const tbody = document.getElementById('tabel-kunjungan');
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto"></i> Memuat data...</td></tr>`;
  if (window.lucide) lucide.createIcons();

  const tujuan = document.getElementById('filter-tujuan').value;

  try {
    const res = await apiGet('/laporan/kunjungan', {
      dari: state.dari, sampai: state.sampai, tujuan, _t: Date.now()
    });

    document.getElementById('rekap-kunjungan-total').textContent = res.rekap.total;
    document.getElementById('rekap-kunjungan-baca').textContent = res.rekap.totalBaca;
    document.getElementById('rekap-kunjungan-pinjam').textContent = res.rekap.totalPinjam;
    
    const rekapNonton = document.getElementById('rekap-kunjungan-nonton');
    if (rekapNonton) rekapNonton.textContent = res.rekap.totalNonton || 0;

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400"><i data-lucide="inbox" class="w-5 h-5 mx-auto mb-1"></i> Tidak ada pengunjung di periode ini</td></tr>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = res.data.map((k, i) => {
      const tuj = (k.tujuan || '').trim().toLowerCase();
      
      let badge = '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Baca di Tempat</span>';
      if (tuj === 'pinjam') {
        badge = '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Pinjam Buku</span>';
      } else if (tuj === 'nonton') {
        badge = '<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">Nonton Film</span>';
      }

      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="px-4 py-3 text-slate-500">${i + 1}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${formatTanggal(k.tanggal)}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(k.nama)}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${escapeHtml(k.nis)}</td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(k.kelas) || '-'}</td>
        <td class="px-4 py-3 text-center text-slate-600 font-mono text-xs">${k.jam_masuk.split(' ')[1] || k.jam_masuk}</td>
        <td class="px-4 py-3 text-center">${badge}</td>
      </tr>
    `}).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-red-500"><i data-lucide="x-circle" class="w-5 h-5 mx-auto mb-1"></i> ${err.message}</td></tr>`;
    if (window.lucide) lucide.createIcons();
  }
}

// ================================================================
// 4. LOAD PAKET
// ================================================================
async function loadLaporanPaket() {
  const tbody = document.getElementById('tabel-paket');
  if(!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto"></i> Memuat data...</td></tr>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await apiGet('/laporan/paket');
    
    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400"><i data-lucide="inbox" class="w-5 h-5 mx-auto mb-1"></i> Belum ada data peminjaman buku kategori 'Paket'</td></tr>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = res.data.map((s, i) => {
      const sisa = s.total_pinjam - s.total_kembali;
      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="px-4 py-3 text-slate-500">${i + 1}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-700">${escapeHtml(s.nis)}</td>
          <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(s.nama)}</td>
          <td class="px-4 py-3 text-slate-600">${escapeHtml(s.kelas) || '-'}</td>
          <td class="px-4 py-3 text-center font-bold text-blue-600">${s.total_pinjam}</td>
          <td class="px-4 py-3 text-center font-bold ${sisa > 0 ? 'text-red-600' : 'text-slate-400'}">${sisa}</td>
          <td class="px-4 py-3 text-center">
            ${s.status_lengkap 
              ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">LENGKAP</span>' 
              : '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">BELUM LENGKAP</span>'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-red-500"><i data-lucide="x-circle" class="w-5 h-5 mx-auto mb-1"></i> ${err.message}</td></tr>`;
    if (window.lucide) lucide.createIcons();
  }
}

// ================================================================
// 5. EXPORT & PRINT
// ================================================================
function exportKunjunganCSV() {
  const tujuan = document.getElementById('filter-tujuan').value;
  window.location.href = `/api/laporan/export-kunjungan?dari=${state.dari}&sampai=${state.sampai}&tujuan=${tujuan}`;
  toast('Mengunduh CSV...', 'info');
}

function exportPeminjamanCSV() {
  window.location.href = `/api/laporan/export-peminjaman?dari=${state.dari}&sampai=${state.sampai}`;
  toast('Mengunduh CSV...', 'info');
}

function exportBukuCSV() {
  if (!state.bukuData.length) return toast('Belum ada data', 'warning');
  const header = 'kode_buku,judul,penulis,kategori,stok_total,stok_tersedia,total_dipinjam,sedang_dipinjam';
  const esc = (v) => { if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const lines = [header];
  state.bukuData.forEach(b => lines.push([b.kode_buku, b.judul, b.penulis, b.kategori, b.stok_total, b.stok_tersedia, b.total_dipinjam, b.sedang_dipinjam].map(esc).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `statistik_buku_${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  toast('CSV ter-download', 'success');
}

function getPrintHeader(judul) {
  return `
    <div class="print-header" style="font-family: 'Times New Roman', Times, serif;">
      <h1 style="font-family: 'Times New Roman', Times, serif; font-size: 16pt; margin: 0; text-transform: uppercase;">SMP NEGERI 1 TAMAN</h1>
      <h2 style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin: 5pt 0 0 0; font-weight: normal; text-transform: uppercase;">PERPUSTAKAAN SEKOLAH</h2>
      <div class="meta" style="font-size: 12pt; margin-top: 10pt; font-weight: bold; font-family: 'Times New Roman', Times, serif;">
        ${judul}
      </div>
      <div class="meta" style="font-family: 'Times New Roman', Times, serif;">
        Periode: ${formatTanggal(state.dari)} s.d. ${formatTanggal(state.sampai)}
      </div>
    </div>
  `;
}

async function printLaporan() {
  try {
    const res = await apiGet('/laporan/peminjaman', { dari: state.dari, sampai: state.sampai, status: state.status });
    
    const rowsHTML = res.data.map((p, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td class="mono">${escapeHtml(p.kode_pinjam)}</td>
        <td>${escapeHtml(p.anggota_nama)}<br><small class="mono">${escapeHtml(p.anggota_nis)}</small></td>
        <td class="text-center">${formatTanggal(p.tanggal_pinjam)}</td>
        <td class="text-center">${formatTanggal(p.tanggal_jatuh)}</td>
        <td class="text-center">${p.jumlah_buku}</td>
        <td class="text-center">${p.status}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <div class="print-page" style="font-family: 'Times New Roman', Times, serif;">
        ${getPrintHeader('LAPORAN PEMINJAMAN BUKU')}
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 15%;">Kode</th>
              <th style="width: 22%;">Anggota</th>
              <th style="width: 12%; text-align: center;">Tgl Pinjam</th>
              <th style="width: 12%; text-align: center;">Jatuh Tempo</th>
              <th style="width: 8%; text-align: center;">Buku</th>
              <th style="width: 14%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHTML || '<tr><td colspan="7" class="text-center">Tidak ada data</td></tr>'}</tbody>
        </table>
        <div class="print-summary">
          <div class="row"><span>Total Transaksi:</span> <strong>${res.rekap.total_transaksi}</strong></div>
          <div class="row"><span>Total Buku Dipinjam:</span> <strong>${res.rekap.total_buku}</strong></div>
          <div class="row"><span>Total Terlambat:</span> <strong>${res.rekap.terlambat}</strong></div>
        </div>
        <div class="print-signature right">
          <div class="date">Sidoarjo, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
          <div>Petugas Perpustakaan</div>
          <br><br><br>
          <div class="line">( ............................................ )</div>
        </div>
      </div>
    `;

    cetakDalamIframe(htmlContent); // <-- Panggil fungsi iframe
  } catch (err) { toast(err.message, 'error'); }
}

async function printKunjungan() {
  try {
    const tujuan = document.getElementById('filter-tujuan').value;
    const res = await apiGet('/laporan/kunjungan', { dari: state.dari, sampai: state.sampai, tujuan });
    
    const rowsHTML = res.data.map((k, i) => {
      const tuj = (k.tujuan || '').trim().toLowerCase();
      let teks = 'Baca';
      if (tuj === 'pinjam') teks = 'Pinjam';
      if (tuj === 'nonton') teks = 'Nonton';

      return `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td class="text-center">${formatTanggal(k.tanggal)}</td>
        <td>${escapeHtml(k.nama)}</td>
        <td class="mono">${escapeHtml(k.nis)}</td>
        <td class="text-center">${escapeHtml(k.kelas) || '-'}</td>
        <td class="text-center">${k.jam_masuk.split(' ')[1] || k.jam_masuk}</td>
        <td class="text-center">${teks}</td>
      </tr>
    `}).join('');

    const htmlContent = `
      <div class="print-page" style="font-family: 'Times New Roman', Times, serif;">
        ${getPrintHeader('LAPORAN BUKU TAMU')}
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 15%; text-align: center;">Tanggal</th>
              <th style="width: 30%;">Nama</th>
              <th style="width: 15%;">NIS</th>
              <th style="width: 10%; text-align: center;">Kelas</th>
              <th style="width: 10%; text-align: center;">Jam</th>
              <th style="width: 15%; text-align: center;">Tujuan</th>
            </tr>
          </thead>
          <tbody>${rowsHTML || '<tr><td colspan="7" class="text-center">Tidak ada data</td></tr>'}</tbody>
        </table>
        <div class="print-summary">
          <div class="row"><span>Total Pengunjung:</span> <strong>${res.rekap.total}</strong></div>
          <div class="row"><span>Baca di Tempat:</span> <strong>${res.rekap.totalBaca}</strong></div>
          <div class="row"><span>Nonton Film:</span> <strong>${res.rekap.totalNonton || 0}</strong></div>
          <div class="row total"><span>Peminjaman:</span> <strong>${res.rekap.totalPinjam}</strong></div>
        </div>
        <div class="print-signature right">
          <div class="date">Sidoarjo, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
          <div>Petugas Perpustakaan</div>
          <br><br><br>
          <div class="line">( ............................................ )</div>
        </div>
      </div>
    `;

    cetakDalamIframe(htmlContent); // <-- Panggil fungsi iframe
  } catch (err) { toast(err.message, 'error'); }
}

async function printLaporanPaket() {
  try {
    const res = await apiGet('/laporan/paket');
    if (!res.data.length) return toast('Tidak ada data untuk dicetak', 'warning');
    
    let pagesHTML = '';

    for (let i = 0; i < res.data.length; i += 2) {
      const s1 = res.data[i];
      const s2 = res.data[i + 1];

      const renderIjazah = (s) => {
        if (!s) return ''; 
        const isLengkap = s.status_lengkap;
        const teksStatus = isLengkap ? 'LENGKAP' : 'BELUM LENGKAP';
        const warnaStatus = isLengkap ? '#059669' : '#dc2626';
        const sisa = s.total_pinjam - s.total_kembali;
        
        return `
          <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="text-align: center; border-bottom: 1.5pt double #000; padding-bottom: 4pt; margin-bottom: 10pt;">
              <h1 style="font-size: 14pt; margin: 0; text-transform: uppercase; font-weight: bold;">SMP NEGERI 1 TAMAN</h1>
              <h2 style="font-size: 11pt; margin: 2pt 0 0 0; font-weight: normal;">PERPUSTAKAAN SEKOLAH</h2>
            </div>
            <h2 style="font-size: 12pt; margin-bottom: 12pt; text-align: center; text-decoration: underline;">SURAT KETERANGAN BEBAS PUSTAKA</h2>
            <p style="font-size: 10pt; margin-bottom: 10pt; line-height: 1.4;">
              Yang bertanda tangan di bawah ini, Kepala Perpustakaan SMP Negeri 1 Taman, menerangkan dengan sesungguhnya bahwa:
            </p>
            <div style="font-size: 10pt; margin-left: 10pt; margin-bottom: 12pt; line-height: 1.6;">
              <div style="display: grid; grid-template-columns: 140px 10px 1fr; margin-bottom: 2px;"><div>Nama</div><div>:</div><div><strong>${escapeHtml(s.nama)}</strong></div></div>
              <div style="display: grid; grid-template-columns: 140px 10px 1fr; margin-bottom: 2px;"><div>NIS</div><div>:</div><div>${escapeHtml(s.nis)}</div></div>
              <div style="display: grid; grid-template-columns: 140px 10px 1fr; margin-bottom: 2px;"><div>Kelas</div><div>:</div><div>${escapeHtml(s.kelas) || '-'}</div></div>
              <div style="display: grid; grid-template-columns: 140px 10px 1fr; margin-bottom: 2px;"><div>Total Buku Paket</div><div>:</div><div>${s.total_pinjam} Buku</div></div>
              ${!isLengkap ? `<div style="display: grid; grid-template-columns: 140px 10px 1fr; margin-bottom: 2px;"><div>Kekurangan</div><div>:</div><div><strong style="color: red;">${sisa} Buku belum dikembalikan</strong></div></div>` : ''}
            </div>
            <p style="font-size: 10pt; margin-bottom: 15pt;">Berdasarkan data sistem perpustakaan, siswa tersebut dinyatakan:</p>
            <div style="text-align: center; margin: 10pt 0 20pt 0;">
              <h1 style="font-size: 24pt; color: ${warnaStatus}; margin: 0; font-weight: bold; letter-spacing: 1px; border: 3px solid ${warnaStatus}; padding: 8pt 20pt; display: inline-block; transform: rotate(-3deg); font-family: Arial, sans-serif; white-space: nowrap;">${teksStatus}</h1>
            </div>
            <p style="font-size: 10pt; margin-bottom: 15pt; text-align: center;">dalam menyelesaikan peminjaman dan pengembalian seluruh buku paket.</p>
            ${!isLengkap && s.buku_belum_kembali ? `
              <div style="margin: 0 auto 10pt auto; border: 1px dashed #666; padding: 6pt 10pt; background: #fafafa; text-align: left; width: 85%; font-size: 9pt;">
                <strong style="display: block; margin-bottom: 3pt; text-align: center;">Lampiran: Buku Paket Belum Kembali</strong>
                <ul style="margin: 0; padding-left: 15pt; line-height: 1.3;">${s.buku_belum_kembali.split(', ').map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
              </div>
            ` : ''}
            <div style="text-align: right; font-size: 10pt; margin-top: auto; padding-right: 15pt;">
              <div>Sidoarjo, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
              <div>Kepala Perpustakaan</div>
              <br><br>
              <div style="display: inline-block; border-bottom: 1pt solid #000; min-width: 140pt; text-align: center; padding-bottom: 2pt;">( ............................................ )</div>
            </div>
          </div>
        `;
      };

      pagesHTML += `
        <div class="ijazah-page">
          <div class="ijazah-half left">${renderIjazah(s1)}</div>
          <div class="ijazah-half">${renderIjazah(s2)}</div>
        </div>
      `;
    }
    
    // Tambahkan CSS Ijazah ke dalam htmlContent
    const ijazahStyles = `
      <style>
        .ijazah-page { width: 29.7cm; height: 21cm; display: flex; page-break-after: always; }
        .ijazah-half { width: 50%; height: 100%; padding: 1cm 1.5cm; display: flex; flex-direction: column; position: relative; font-family: 'Times New Roman', Times, serif; }
        .ijazah-half.left { border-right: 1.5px dashed #bbb; }
      </style>
      ${pagesHTML}
    `;

    cetakDalamIframe(ijazahStyles, true); // <--- PENTING: TRUE = Landscape
    
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ================================================================
// 6. TAB SWITCH & INIT
// ================================================================
function switchTab(tab) {
  state.activeTab = tab;
  
  const btnP = document.getElementById('tab-peminjaman');
  const btnB = document.getElementById('tab-buku');
  const btnK = document.getElementById('tab-kunjungan');
  const btnPaket = document.getElementById('tab-paket');
  
  const viewP = document.getElementById('view-peminjaman');
  const viewB = document.getElementById('view-buku');
  const viewK = document.getElementById('view-kunjungan');
  const viewPaket = document.getElementById('view-paket');

  const baseClass = 'flex items-center gap-2 px-4 py-2 font-medium border-b-2 -mb-px rounded-none transition-colors';
  
  [btnP, btnB, btnK, btnPaket].forEach(btn => {
    if (btn) btn.className = `${baseClass} text-slate-500 hover:text-slate-800 border-transparent`;
  });
  [viewP, viewB, viewK, viewPaket].forEach(view => {
    if (view) view.classList.add('hidden');
  });

  if (tab === 'peminjaman') {
    if (btnP) btnP.className = `${baseClass} text-blue-600 border-blue-600`;
    if (viewP) viewP.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'block';
  } else if (tab === 'buku') {
    if (btnB) btnB.className = `${baseClass} text-blue-600 border-blue-600`;
    if (viewB) viewB.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'none';
    if (!state.bukuData.length) loadBukuStats();
  } else if (tab === 'kunjungan') {
    if (btnK) btnK.className = `${baseClass} text-blue-600 border-blue-600`;
    if (viewK) viewK.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'none';
    loadKunjungan();
  } else if (tab === 'paket') {
    if (btnPaket) btnPaket.className = `${baseClass} text-blue-600 border-blue-600`;
    if (viewPaket) viewPaket.classList.remove('hidden');
    document.getElementById('wrap-filter-status').style.display = 'none';
    loadLaporanPaket();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const today = todayStr();
  state.dari = addDaysStr(today, -30);
  state.sampai = today;
  
  const fDari = document.getElementById('filter-dari');
  const fSampai = document.getElementById('filter-sampai');
  if (fDari) fDari.value = state.dari;
  if (fSampai) fSampai.value = state.sampai;

  const tabP = document.getElementById('tab-peminjaman');
  const tabB = document.getElementById('tab-buku');
  const tabK = document.getElementById('tab-kunjungan');
  const tabPaket = document.getElementById('tab-paket');

  if (tabP) tabP.addEventListener('click', () => switchTab('peminjaman'));
  if (tabB) tabB.addEventListener('click', () => switchTab('buku'));
  if (tabK) tabK.addEventListener('click', () => switchTab('kunjungan'));
  if (tabPaket) tabPaket.addEventListener('click', () => switchTab('paket'));

  const btnTerapkan = document.getElementById('btn-terapkan');
  if (btnTerapkan) {
    btnTerapkan.addEventListener('click', () => {
      state.dari = fDari.value || todayStr();
      state.sampai = fSampai.value || todayStr();
      state.status = document.getElementById('filter-status').value;
      
      if (state.activeTab === 'peminjaman') loadPeminjaman();
      else if (state.activeTab === 'kunjungan') loadKunjungan();
    });
  }

  const setPreset = (days) => {
    state.sampai = todayStr();
    state.dari = days === 0 ? state.sampai : addDaysStr(state.sampai, -days);
    if(fDari) fDari.value = state.dari;
    if(fSampai) fSampai.value = state.sampai;
    if (state.activeTab === 'peminjaman') loadPeminjaman(); else loadKunjungan();
  };

  const btnHari = document.getElementById('btn-preset-hari');
  const btnMinggu = document.getElementById('btn-preset-minggu');
  const btnBulan = document.getElementById('btn-preset-bulan');

  if (btnHari) btnHari.addEventListener('click', () => setPreset(0));
  if (btnMinggu) btnMinggu.addEventListener('click', () => setPreset(6));
  if (btnBulan) btnBulan.addEventListener('click', () => setPreset(29));

  const filterTujuan = document.getElementById('filter-tujuan');
  if (filterTujuan) filterTujuan.addEventListener('change', loadKunjungan);

  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  bindClick('btn-export-csv', exportPeminjamanCSV);
  bindClick('btn-print-laporan', printLaporan);
  bindClick('btn-export-buku-csv', exportBukuCSV);
  bindClick('btn-export-kunjungan', exportKunjunganCSV);
  bindClick('btn-print-kunjungan', printKunjungan);
  bindClick('btn-print-paket', printLaporanPaket);

  loadPeminjaman();
});