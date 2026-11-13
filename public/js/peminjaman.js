// ================================================================
// peminjaman.js — Logika halaman Peminjaman (tanpa denda)
// ================================================================

const state = {
  page: 1, limit: 20,
  search: '', status: '',
  total_page: 1,
  detailId: null,
  hapusId: null,
  bukuRowSeq: 0,
  settings: { maxBuku: 3, lamaPinjam: 7 }
};

// ================================================================
// UTILITY
// ================================================================
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatTanggal(str) {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${parseInt(d)} ${bulan[parseInt(m)-1]} ${y}`;
}

async function loadSettings() {
  try {
    const res = await apiGet('/pengaturan');
    const map = {};
    (res.data || []).forEach(p => { map[p.key] = p.value; });
    state.settings.maxBuku = parseInt(map.max_buku_per_pinjam || '3', 10);
    state.settings.lamaPinjam = parseInt(map.lama_pinjam_default || '7', 10);
    document.getElementById('info-max-buku').textContent = `Maks: ${state.settings.maxBuku} buku`;
  } catch (e) { /* pakai default */ }
}

// ================================================================
// LOAD LIST
// ================================================================
async function loadPeminjaman() {
  const tbody = document.getElementById('tabel-body');
  tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400"><i data-lucide="loader"></i> Memuat data...</td></tr>`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await apiGet('/peminjaman', {
      page: state.page, limit: state.limit,
      search: state.search, status: state.status
    });
    renderTabel(res.data);
    renderPagination(res.pagination);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-red-500"><i data-lucide="x-circle"></i> ${err.message}</td></tr>`;
    if (window.lucide) lucide.createIcons();
  }
}

function renderTabel(list) {
  const tbody = document.getElementById('tabel-body');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-slate-400"><i data-lucide="inbox"></i> Tidak ada data peminjaman</td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const startNo = (state.page - 1) * state.limit + 1;

  tbody.innerHTML = list.map((p, i) => {
    const statusBadge = {
      'dipinjam':      '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Dipinjam</span>',
      'sebagian':      '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Sebagian</span>',
      'dikembalikan':  '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Kembali</span>'
    }[p.status] || p.status;

    const telatBadge = p.is_terlambat
      ? '<span class="ml-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700"><i data-lucide="alert-triangle"></i> Telat</span>'
      : '';

    const bukuInfo = `${p.buku_belum_kembali}/${p.total_buku}`;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${p.is_terlambat ? 'bg-red-50/50' : ''}"
          data-action="bukaDetail" data-id="${p.id}">
        <td class="px-4 py-3 text-slate-500">${startNo + i}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-700 font-medium">${escapeHtml(p.kode_pinjam)}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800">${escapeHtml(p.anggota_nama) || '-'}</div>
          <div class="text-xs text-slate-400">${escapeHtml(p.anggota_nis) || ''} ${p.anggota_kelas ? '· ' + escapeHtml(p.anggota_kelas) : ''}</div>
        </td>
        <td class="px-4 py-3 text-slate-600 text-xs">${formatTanggal(p.tanggal_pinjam)}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">
          ${formatTanggal(p.tanggal_jatuh)}
          ${p.is_terlambat ? '<div class="text-red-600 text-xs mt-0.5"><i data-lucide="alert-triangle"></i> Terlambat</div>' : ''}
        </td>
        <td class="px-4 py-3 text-center text-slate-600 font-medium">${bukuInfo}</td>
        <td class="px-4 py-3 text-center">${statusBadge}${telatBadge}</td>
        <td class="px-4 py-3 text-center" data-stop>
          <div class="flex gap-1 justify-center">
            <button data-action="bukaDetail" data-id="${p.id}" title="Detail"
              class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"><i data-lucide="eye"></i></button>
            <button data-action="konfirmasiHapus" data-id="${p.id}" data-str="${escapeHtml(p.kode_pinjam)}" title="Hapus"
              class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(p) {
  state.total_page = p.total_page;
  const start = (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.total);

  document.getElementById('info-page').textContent =
    p.total === 0 ? 'Tidak ada data' :
    `Menampilkan ${start}–${end} dari ${p.total} peminjaman`;

  const btn = (label, targetPage, disabled = false, active = false) => `
    <button ${disabled ? 'disabled' : ''} data-action="gotoPage" data-id="${targetPage}"
      class="px-3 py-1.5 rounded text-sm border ${
        active ? 'bg-blue-600 text-white border-blue-600'
        : disabled ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
      }">${label}</button>
  `;

  document.getElementById('pagination').innerHTML =
    btn('«', p.page - 1, p.page <= 1) +
    btn(String(p.page), p.page, false, true) +
    btn('»', p.page + 1, p.page >= p.total_page);
}

function gotoPage(p) {
  if (p < 1 || p > state.total_page) return;
  state.page = p;
  loadPeminjaman();
}

// ================================================================
// AUTOCOMPLETE — GENERIC
// ================================================================
function setupAutocomplete(inputEl, listEl, fetchFn, onSelect, minChars = 2) {
  let timer = null;

  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    const q = inputEl.value.trim();
    if (q.length < minChars) { listEl.classList.add('hidden'); return; }

    timer = setTimeout(async () => {
      try {
        const results = await fetchFn(q);
        if (!results.length) {
          listEl.innerHTML = '<div class="autocomplete-item text-slate-400">Tidak ada hasil</div>';
          if (window.lucide) lucide.createIcons();
          listEl.classList.remove('hidden');
          return;
        }
        listEl.innerHTML = results.map((r, i) =>
          `<div class="autocomplete-item" data-idx="${i}">${r.html}</div>`
        ).join('');
        listEl.classList.remove('hidden');
        listEl.querySelectorAll('.autocomplete-item').forEach((el, idx) => {
          el.addEventListener('click', () => {
            onSelect(results[idx]);
            listEl.classList.add('hidden');
          });
        });
      } catch (e) {
        listEl.classList.add('hidden');
      }
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.parentElement.contains(e.target)) listEl.classList.add('hidden');
  });
}

// ================================================================
// MODAL PEMINJAMAN BARU
// ================================================================
function openModalPinjam() {
  document.getElementById('modal-pinjam').classList.remove('hidden');
  document.getElementById('form-pinjam').reset();
  document.getElementById('anggota-id').value = '';
  document.getElementById('anggota-search').value = '';
  document.getElementById('anggota-info').classList.add('hidden');
  document.getElementById('tanggal-pinjam').value = todayStr();
  updateJatuhTempo();
  document.getElementById('buku-rows').innerHTML = '';
  if (window.lucide) lucide.createIcons();

  state.bukuRowSeq = 0;
  tambahBarisBuku();
}

function closeModalPinjam() {
  document.getElementById('modal-pinjam').classList.add('hidden');
}

function updateJatuhTempo() {
  const tgl = document.getElementById('tanggal-pinjam').value || todayStr();
  const jatuh = addDays(tgl, state.settings.lamaPinjam);
  document.getElementById('tanggal-jatuh').value = formatTanggal(jatuh) + ` (${state.settings.lamaPinjam} hari)`;
}

function tambahBarisBuku() {
  state.bukuRowSeq++;
  const seq = state.bukuRowSeq;
  const rows = document.getElementById('buku-rows');

  const div = document.createElement('div');
  div.className = 'flex gap-2 items-start';
  div.dataset.rowId = seq;
  div.innerHTML = `
    <div class="flex-1 relative">
      <input type="text" class="buku-search w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Ketik judul / kode buku..." autocomplete="off">
      <input type="hidden" class="buku-id">
      <div class="autocomplete-list hidden"></div>
      <div class="buku-info hidden mt-1 text-xs text-slate-500"></div>
    </div>
    <input type="number" class="buku-jumlah w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" value="1" min="1">
    <button type="button" class="btn-hapus-row px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg" title="Hapus">✕</button>
  `;
  if (window.lucide) lucide.createIcons();

  rows.appendChild(div);

  const searchEl = div.querySelector('.buku-search');
  const listEl = div.querySelector('.autocomplete-list');
  const hiddenId = div.querySelector('.buku-id');
  const infoEl = div.querySelector('.buku-info');
  const jumlahEl = div.querySelector('.buku-jumlah');

  setupAutocomplete(searchEl, listEl, async (q) => {
    const res = await apiGet('/buku', { search: q, limit: 8 });
    return (res.data || []).filter(b => b.stok_tersedia > 0).map(b => ({
      buku: b,
      html: `<b>${escapeHtml(b.judul)}</b>
        <small>${escapeHtml(b.kode_buku)} · ${escapeHtml(b.penulis) || '-'} · Stok: ${b.stok_tersedia}</small>`
    }));
  }, (item) => {
    hiddenId.value = item.buku.id;
    searchEl.value = item.buku.judul;
    infoEl.classList.remove('hidden');
    infoEl.innerHTML = `<i data-lucide="book-open"></i> <b>${escapeHtml(item.buku.kode_buku)}</b> · Stok tersedia: <b>${item.buku.stok_tersedia}</b>`;
    if (window.lucide) lucide.createIcons();
    jumlahEl.max = item.buku.stok_tersedia;
  });

  div.querySelector('.btn-hapus-row').addEventListener('click', () => {
    const total = document.querySelectorAll('#buku-rows > div').length;
    if (total <= 1) {
      toast('Minimal 1 buku', 'warning');
      return;
    }
    div.remove();
  });
}

async function submitPeminjaman(e) {
  e.preventDefault();

  const anggotaId = document.getElementById('anggota-id').value;
  if (!anggotaId) return toast('Pilih anggota dulu', 'error');

  const rows = document.querySelectorAll('#buku-rows > div');
  const bukuList = [];
  for (const r of rows) {
    const id = r.querySelector('.buku-id').value;
    const jml = parseInt(r.querySelector('.buku-jumlah').value) || 1;
    if (!id) continue;
    bukuList.push({ buku_id: Number(id), jumlah: jml });
  }

  if (!bukuList.length) return toast('Minimal 1 buku harus dipilih', 'error');
  if (bukuList.length > state.settings.maxBuku) {
    return toast(`Maksimal ${state.settings.maxBuku} buku per transaksi`, 'error');
  }

  const payload = {
    anggota_id: Number(anggotaId),
    tanggal_pinjam: document.getElementById('tanggal-pinjam').value || todayStr(),
    catatan: document.getElementById('catatan').value.trim(),
    buku_list: bukuList
  };

  const btn = document.getElementById('btn-submit-pinjam');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    const res = await apiPost('/peminjaman', payload);
    toast(res.message, 'success');
    closeModalPinjam();
    loadPeminjaman();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan Peminjaman';
  }
}

// ================================================================
// DETAIL & PENGEMBALIAN
// ================================================================
async function bukaDetail(id) {
  state.detailId = id;
  document.getElementById('modal-detail').classList.remove('hidden');
  document.getElementById('detail-content').innerHTML =
    '<div class="text-center text-slate-400 py-8"><i data-lucide="loader"></i> Memuat...</div>';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await apiGet('/peminjaman/' + id);
    renderDetail(res.data);
  } catch (err) {
    document.getElementById('detail-content').innerHTML =
      `<div class="text-center text-red-500 py-8"><i data-lucide="x-circle"></i> ${err.message}</div>`;
    if (window.lucide) lucide.createIcons();
  }
}

function renderDetail(p) {
  const detailRows = p.detail.map(d => {
    const isBack = d.status === 'dikembalikan';

    return `
      <tr class="border-b border-slate-100">
        <td class="px-3 py-3">
          <div class="font-medium text-slate-800">${escapeHtml(d.judul) || '-'}</div>
          <div class="text-xs text-slate-400">${escapeHtml(d.kode_buku) || ''} · ${escapeHtml(d.penulis) || ''}</div>
        </td>
        <td class="px-3 py-3 text-center text-slate-600">${d.jumlah}</td>
        <td class="px-3 py-3 text-center">
          ${isBack
            ? '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Kembali</span>'
            : '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Dipinjam</span>'}
        </td>
        <td class="px-3 py-3 text-xs text-slate-600 text-center">
          ${isBack ? formatTanggal(d.tanggal_kembali) : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const adaBelumKembali = p.detail.some(d => d.status === 'dipinjam');
  const tombolKembalikan = adaBelumKembali
    ? `<button data-action="kembalikanSemua" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
         <i data-lucide="check-circle"></i> Kembalikan Semua
       </button>`
    : '';

  const statusBadge = {
    'dipinjam':      '<span class="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">Dipinjam</span>',
    'sebagian':      '<span class="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">Sebagian Kembali</span>',
    'dikembalikan':  '<span class="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700 font-medium">Dikembalikan</span>'
  }[p.status] || p.status;

  document.getElementById('detail-content').innerHTML = `
    <div class="space-y-5">

      <!-- Header info -->
      <div class="bg-slate-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div class="text-xs text-slate-500 mb-1">Kode Pinjam</div>
          <div class="font-mono font-bold text-slate-800">${escapeHtml(p.kode_pinjam)}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500 mb-1">Status</div>
          <div>${statusBadge}${p.is_terlambat ? ' <span class="ml-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700"><i data-lucide="alert-triangle"></i> Telat</span>' : ''}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500 mb-1">Tanggal Pinjam</div>
          <div class="font-medium text-slate-800 text-sm">${formatTanggal(p.tanggal_pinjam)}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500 mb-1">Jatuh Tempo</div>
          <div class="font-medium text-sm ${p.is_terlambat ? 'text-red-600' : 'text-slate-800'}">${formatTanggal(p.tanggal_jatuh)}</div>
        </div>
      </div>

      <!-- Anggota -->
      <div class="border border-slate-200 rounded-lg p-4">
        <div class="text-xs text-slate-500 mb-1 flex items-center gap-1"><i data-lucide="user" class="w-3 h-3"></i> ANGGOTA</div>
        <div class="font-bold text-slate-800 text-lg">${escapeHtml(p.anggota_nama)}</div>
        <div class="text-sm text-slate-500 mt-0.5">
          NIS: ${escapeHtml(p.anggota_nis)} ${p.anggota_kelas ? '· Kelas: ' + escapeHtml(p.anggota_kelas) : ''} · ${p.anggota_jenis}
        </div>
      </div>

      <!-- Info keterlambatan -->
      ${p.is_terlambat ? `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <i data-lucide="alert-triangle" class="w-6 h-6 text-red-600 flex-shrink-0"></i>
            <div class="flex-1">
              <div class="font-bold text-red-800">Terlambat ${p.hari_terlambat} hari</div>
              <div class="text-sm text-red-600 mt-1">
                Buku ini sudah melewati tanggal jatuh tempo. Sanksi administratif dapat dikenakan sesuai kebijakan perpustakaan.
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tabel detail buku -->
      <div>
        <div class="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
          <i data-lucide="book-open" class="w-4 h-4"></i> Daftar Buku
        </div>
        <div class="border border-slate-200 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr class="text-left text-xs text-slate-500">
                <th class="px-3 py-2">Buku</th>
                <th class="px-3 py-2 text-center w-16">Jml</th>
                <th class="px-3 py-2 text-center w-28">Status</th>
                <th class="px-3 py-2 text-center w-32">Tgl Kembali</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Catatan -->
      ${p.catatan ? `
        <div>
          <div class="text-xs text-slate-500 mb-1 flex items-center gap-1"><i data-lucide="sticky-note" class="w-3 h-3"></i> Catatan</div>
          <div class="bg-slate-50 p-3 rounded-lg text-sm text-slate-700">${escapeHtml(p.catatan)}</div>
        </div>
      ` : ''}

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-4 border-t border-slate-200">
        ${tombolKembalikan}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

async function kembalikanSemua() {
  if (!state.detailId) return;
  if (!confirm('Kembalikan semua buku dalam transaksi ini?')) return;

  try {
    const res = await apiPost(`/peminjaman/${state.detailId}/kembalikan`, {});
    toast(res.message, 'success');
    bukaDetail(state.detailId);
    loadPeminjaman();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ================================================================
// HAPUS
// ================================================================
function konfirmasiHapus(id, kode) {
  state.hapusId = id;
  document.getElementById('hapus-info').textContent = kode;
  document.getElementById('modal-hapus').classList.remove('hidden');
}

async function lakukanHapus() {
  const btn = document.getElementById('btn-konfirmasi-hapus');
  btn.disabled = true; btn.textContent = 'Menghapus...';
  try {
    await apiDelete('/peminjaman/' + state.hapusId);
    toast('Peminjaman dihapus, stok dikembalikan', 'success');
    document.getElementById('modal-hapus').classList.add('hidden');
    loadPeminjaman();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Hapus';
  }
}

// ================================================================
// PRINT
// ================================================================
async function cetakStruk() {
  if (!state.detailId) return;
  try {
    const res = await apiGet('/peminjaman/' + state.detailId);
    const p = res.data;

    const rows = p.detail.map((d, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td class="mono">${escapeHtml(d.kode_buku) || ''}</td>
        <td>${escapeHtml(d.judul)}</td>
        <td>${escapeHtml(d.penulis) || '-'}</td>
        <td class="text-center">${d.jumlah}</td>
      </tr>
    `).join('');

    document.getElementById('print-area').innerHTML = `
      <div class="print-page">
        <div class="print-header">
          <h1>Perpustakaan Sekolah</h1>
          <h2>Bukti Peminjaman Buku</h2>
          <p class="meta">Kode: <b>${escapeHtml(p.kode_pinjam)}</b></p>
        </div>

        <dl class="print-info">
          <dt>Nama Anggota</dt>       <dd>${escapeHtml(p.anggota_nama)}</dd>
          <dt>NIS</dt>                <dd>${escapeHtml(p.anggota_nis)}</dd>
          ${p.anggota_kelas ? `<dt>Kelas</dt><dd>${escapeHtml(p.anggota_kelas)}</dd>` : ''}
          <dt>Tanggal Pinjam</dt>     <dd>${formatTanggal(p.tanggal_pinjam)}</dd>
          <dt>Jatuh Tempo</dt>        <dd>${formatTanggal(p.tanggal_jatuh)}</dd>
          <dt>Status</dt>             <dd>${p.status}</dd>
        </dl>

        <table class="print-table">
          <thead>
            <tr>
              <th style="width:30pt" class="text-center">No</th>
              <th style="width:70pt">Kode</th>
              <th>Judul</th>
              <th style="width:120pt">Penulis</th>
              <th style="width:40pt" class="text-center">Jml</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="print-summary">
          <div class="row"><span>Total Buku Dipinjam</span><span><b>${p.detail.length} judul</b></span></div>
          <div class="row"><span>Status</span><span><b>${p.status}</b></span></div>
          ${p.is_terlambat ? `<div class="row total"><span>Keterangan</span><span>Terlambat ${p.hari_terlambat} hari</span></div>` : ''}
        </div>

        <p style="margin-top:10pt;font-size:9pt;color:#555;font-style:italic;">
          Harap kembalikan buku sesuai tanggal jatuh tempo. Keterlambatan dapat dikenakan sanksi administratif sesuai kebijakan perpustakaan.
        </p>

        <div class="print-signature right">
          <div class="date">Sidoarjo, ${new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</div>
          <div>Petugas Perpustakaan,</div>
          <div class="line">&nbsp;</div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    window.print();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {

  await loadSettings();

  const anggotaSearch = document.getElementById('anggota-search');
  const anggotaList = document.getElementById('anggota-list');
  const anggotaId = document.getElementById('anggota-id');
  const anggotaInfo = document.getElementById('anggota-info');

  setupAutocomplete(anggotaSearch, anggotaList, async (q) => {
    const res = await apiGet('/anggota', { search: q, limit: 8, status: 'aktif' });
    return (res.data || []).map(a => ({
      anggota: a,
      html: `<b>${escapeHtml(a.nama)}</b>
        <small>${escapeHtml(a.nis)} ${a.kelas ? '· ' + escapeHtml(a.kelas) : ''} · ${a.jenis}</small>`
    }));
  }, (item) => {
    anggotaId.value = item.anggota.id;
    anggotaSearch.value = item.anggota.nama;
    anggotaInfo.classList.remove('hidden');
    document.getElementById('anggota-nama-terpilih').textContent = item.anggota.nama;
    document.getElementById('anggota-detail-terpilih').textContent =
      `NIS: ${item.anggota.nis} ${item.anggota.kelas ? '· Kelas: ' + item.anggota.kelas : ''} · ${item.anggota.jenis}`;
  });

  anggotaSearch.addEventListener('input', () => {
    if (!anggotaSearch.value.trim()) {
      anggotaId.value = '';
      anggotaInfo.classList.add('hidden');
    }
  });

  document.getElementById('tanggal-pinjam').addEventListener('change', updateJatuhTempo);

  document.getElementById('btn-pinjam-baru').addEventListener('click', openModalPinjam);
  document.getElementById('btn-close-pinjam').addEventListener('click', closeModalPinjam);
  document.getElementById('btn-cancel-pinjam').addEventListener('click', closeModalPinjam);

  document.getElementById('btn-tambah-buku').addEventListener('click', () => {
    const currentCount = document.querySelectorAll('#buku-rows > div').length;
    if (currentCount >= state.settings.maxBuku) {
      return toast(`Maksimal ${state.settings.maxBuku} buku per transaksi`, 'warning');
    }
    tambahBarisBuku();
  });

  document.getElementById('form-pinjam').addEventListener('submit', submitPeminjaman);

  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('modal-detail').classList.add('hidden');
  });
  document.getElementById('btn-print').addEventListener('click', cetakStruk);

  document.getElementById('btn-cancel-hapus').addEventListener('click', () => {
    document.getElementById('modal-hapus').classList.add('hidden');
  });
  document.getElementById('btn-konfirmasi-hapus').addEventListener('click', lakukanHapus);

  let searchTimer = null;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadPeminjaman();
    }, 400);
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value; state.page = 1; loadPeminjaman();
  });
  document.getElementById('filter-limit').addEventListener('change', (e) => {
    state.limit = Number(e.target.value); state.page = 1; loadPeminjaman();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    state.page = 1; state.search = ''; state.status = '';
    document.getElementById('search').value = '';
    document.getElementById('filter-status').value = '';
    loadPeminjaman();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModalPinjam();
      document.getElementById('modal-detail').classList.add('hidden');
      document.getElementById('modal-hapus').classList.add('hidden');
    }
  });
  ['modal-pinjam', 'modal-detail', 'modal-hapus'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('click', (e) => { if (e.target.id === id) el.classList.add('hidden'); });
  });

  loadPeminjaman();
});