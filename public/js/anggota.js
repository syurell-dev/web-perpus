// ================================================================
// anggota.js — Logika halaman Kelola Anggota
// ================================================================

const state = {
  page: 1,
  limit: 20,
  search: '',
  jenis: '',
  kelas: '',
  status: '',
  total_page: 1,
  kelasList: [],
  deleteId: null,
  deleteNama: '',
  csvData: [],       // hasil parse CSV
  csvHeaders: [],
  bulkStudents: [] // <--- TAMBAHKAN
};

// ================================================================
// LOAD DATA
// ================================================================
async function loadAnggota() {
  const tbody = document.getElementById('tabel-body');
  tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-10 text-center text-slate-400"><i data-lucide="loader"></i> Memuat data...</td></tr>`;
  if (window.lucide) lucide.createIcons();


  try {
    const res = await apiGet('/anggota', {
      page: state.page, limit: state.limit,
      search: state.search, jenis: state.jenis,
      kelas: state.kelas, status: state.status
    });
    renderTabel(res.data);
    renderPagination(res.pagination);
    renderKelasDropdown(res.kelas_list);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-10 text-center text-red-500"><i data-lucide="x-circle"></i> ${err.message}</td></tr>`;
  if (window.lucide) lucide.createIcons();

  }
}

// ================================================================
// RENDER TABEL
// ================================================================
function renderTabel(list) {
  const tbody = document.getElementById('tabel-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-10 text-center text-slate-400"><i data-lucide="inbox"></i> Tidak ada data anggota</td></tr>`;
  if (window.lucide) lucide.createIcons();

    return;
  }

  const startNo = (state.page - 1) * state.limit + 1;

  tbody.innerHTML = list.map((a, i) => {
    const jenisBadge = {
      siswa: '<span class="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Siswa</span>',
      guru:  '<span class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Guru</span>',
      staf:  '<span class="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Staf</span>'
    }[a.jenis] || a.jenis;

    const statusBadge = a.status === 'aktif'
      ? '<span class="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Aktif</span>'
      : '<span class="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-600">Nonaktif</span>';

    // LOGIKA BADGE MASA AKTIF
    const tglAktif = a.tanggal_aktif_sampai ? a.tanggal_aktif_sampai : '-';
    let expBadge = '';
    if (a.tanggal_aktif_sampai) {
      const today = new Date();
      const exp = new Date(a.tanggal_aktif_sampai);
      const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        expBadge = '<span class="text-[10px] text-red-600 block font-bold">(Expired)</span>';
      } else if (diffDays <= 30) {
        expBadge = `<span class="text-[10px] text-amber-600 block font-bold">(${diffDays} hari lagi)</span>`;
      }
    }

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 ${a.status !== 'aktif' ? 'opacity-60' : ''}">
        <td class="px-4 py-3 text-slate-500">${startNo + i}</td>
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${escapeHtml(a.nis)}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(a.nama)}</td>
        <td class="px-4 py-3">${jenisBadge}</td>
        <td class="px-4 py-3 text-slate-600">${escapeHtml(a.kelas) || '-'}</td>
        <td class="px-4 py-3 text-slate-600">${a.jenis_kelamin || '-'}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${tglAktif} ${expBadge}</td>
        <td class="px-4 py-3 text-center">${statusBadge}</td>
                <td class="px-4 py-3">
          <div class="flex gap-1.5 justify-center">
            <button data-action="editAnggota" data-id="${a.id}" title="Edit" class="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            <button data-action="resetPassword" data-id="${a.id}" data-str="${escapeHtml(a.nama)}" title="Reset Password" class="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition">
              <i data-lucide="key" class="w-4 h-4"></i>
            </button>
            <button data-action="konfirmasiHapus" data-id="${a.id}" data-str="${escapeHtml(a.nama)}" title="Hapus" class="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ================================================================
// PAGINATION
// ================================================================
function renderPagination(p) {
  state.total_page = p.total_page;
  const start = (p.page - 1) * p.limit + 1;
  const end = Math.min(p.page * p.limit, p.total);

  document.getElementById('info-page').textContent =
    p.total === 0 ? 'Tidak ada data' :
    `Menampilkan ${start}–${end} dari ${p.total} anggota`;

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
  loadAnggota();
}

function renderKelasDropdown(list) {
  if (JSON.stringify(list) === JSON.stringify(state.kelasList)) return;
  state.kelasList = list;
  const sel = document.getElementById('filter-kelas');
  sel.innerHTML = '<option value="">Semua Kelas</option>' +
    list.map(k => `<option value="${escapeHtml(k)}" ${k === state.kelas ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('');
}

// ================================================================
// MODAL FORM
// ================================================================
function openModal(mode = 'tambah', data = null) {
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('form-anggota').reset();
  document.getElementById('f-id').value = '';
  if (window.lucide) lucide.createIcons();


  if (mode === 'edit' && data) {
    document.getElementById('modal-title').textContent = 'Edit Anggota';
    document.getElementById('f-id').value = data.id;
    document.getElementById('f-nis').value = data.nis || '';
    document.getElementById('f-nama').value = data.nama || '';
    document.getElementById('f-jenis').value = data.jenis || 'siswa';
    document.getElementById('f-kelas').value = data.kelas || '';
    document.getElementById('f-jenis_kelamin').value = data.jenis_kelamin || '';
    document.getElementById('f-no_hp').value = data.no_hp || '';
    document.getElementById('f-alamat').value = data.alamat || '';
    document.getElementById('f-status').value = data.status || 'aktif';
    document.getElementById('f-tanggal_aktif_sampai').value = data.tanggal_aktif_sampai || '';
  } else {
    document.getElementById('modal-title').textContent = 'Tambah Anggota';
  }

  setTimeout(() => document.getElementById('f-nis').focus(), 100);
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

async function submitForm(e) {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const payload = {
    nis:           document.getElementById('f-nis').value.trim(),
    nama:          document.getElementById('f-nama').value.trim(),
    jenis:         document.getElementById('f-jenis').value,
    kelas:         document.getElementById('f-kelas').value.trim(),
    jenis_kelamin: document.getElementById('f-jenis_kelamin').value,
    no_hp:         document.getElementById('f-no_hp').value.trim(),
    alamat:        document.getElementById('f-alamat').value.trim(),
    status:        document.getElementById('f-status').value,
    tanggal_aktif_sampai: document.getElementById('f-tanggal_aktif_sampai').value || null
  };

  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    if (id) {
      await apiPut('/anggota/' + id, payload);
      toast('Anggota berhasil diupdate', 'success');
    } else {
      await apiPost('/anggota', payload);
      toast('Anggota berhasil ditambahkan', 'success');
    }
    closeModal();
    loadAnggota();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
}

async function editAnggota(id) {
  try {
    const res = await apiGet('/anggota/' + id);
    openModal('edit', res.data);
  } catch (err) { toast(err.message, 'error'); }
}

// ================================================================
// HAPUS
// ================================================================
function konfirmasiHapus(id, nama) {
  state.deleteId = id; state.deleteNama = nama;
  document.getElementById('hapus-nama').textContent = nama;
  document.getElementById('modal-hapus').classList.remove('hidden');
}

async function lakukanHapus() {
  const btn = document.getElementById('btn-konfirmasi-hapus');
  btn.disabled = true; btn.textContent = 'Menghapus...';
  try {
    await apiDelete('/anggota/' + state.deleteId);
    toast('Anggota berhasil dihapus', 'success');
    document.getElementById('modal-hapus').classList.add('hidden');
    loadAnggota();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Hapus';
  }
}

// ================================================================
// IMPORT CSV — Parsing
// ================================================================

// Parser CSV sederhana yang support tanda kutip
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuote) {
      if (c === '"' && next === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { cur += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else { cur += c; }
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function openImportModal() {
  document.getElementById('modal-import').classList.remove('hidden');
  document.getElementById('file-csv').value = '';
  document.getElementById('preview-import').classList.add('hidden');
  document.getElementById('import-result').classList.add('hidden');
  document.getElementById('btn-proses-import').disabled = true;
  state.csvData = [];
  state.csvHeaders = [];
}

function closeImportModal() {
  document.getElementById('modal-import').classList.add('hidden');
}

function handleFileCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result;
      const rows = parseCSV(text);

      if (rows.length < 2) {
        toast('File CSV kosong atau hanya berisi header', 'error');
        return;
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const requiredCols = ['nis', 'nama'];
      const missing = requiredCols.filter(c => !headers.includes(c));
      if (missing.length) {
        toast(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`, 'error');
        return;
      }

      // Konversi baris jadi object
      const data = rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
        return obj;
      });

      state.csvHeaders = headers;
      state.csvData = data;

      renderPreview(headers, data.slice(0, 10));
      document.getElementById('preview-import').classList.remove('hidden');
      document.getElementById('import-result').classList.add('hidden');
      document.getElementById('btn-proses-import').disabled = false;

      document.getElementById('preview-info').innerHTML =
        `<i data-lucide="check-circle"></i> Terbaca <b>${data.length}</b> baris data. Preview 10 pertama:`;
  if (window.lucide) lucide.createIcons();

    } catch (err) {
      toast('Gagal baca file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function renderPreview(headers, rows) {
  document.getElementById('preview-head').innerHTML =
    headers.map(h => `<th class="px-2 py-1.5 text-left font-semibold text-slate-600">${escapeHtml(h)}</th>`).join('');
  document.getElementById('preview-body').innerHTML = rows.map(r =>
    `<tr class="border-t border-slate-100">${headers.map(h =>
      `<td class="px-2 py-1.5 text-slate-700">${escapeHtml(r[h]) || '-'}</td>`
    ).join('')}</tr>`
  ).join('');
}

async function prosesImport() {
  if (!state.csvData.length) return;

  const btn = document.getElementById('btn-proses-import');
  btn.disabled = true;
  btn.textContent = `Memproses ${state.csvData.length} baris...`;

  try {
    const res = await apiPost('/anggota/import', { rows: state.csvData });
    const hasil = res.hasil;

    const resultEl = document.getElementById('import-result');
    resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="font-semibold text-green-800 mb-2"><i data-lucide="check-circle"></i> ${res.message}</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-green-600">${hasil.sukses}</div>
            <div class="text-xs text-slate-500">Baru</div>
          </div>
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-blue-600">${hasil.diperbarui || 0}</div>
            <div class="text-xs text-slate-500">Diperbarui</div>
          </div>
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-amber-600">${hasil.duplikat}</div>
            <div class="text-xs text-slate-500">Sama (skip)</div>
          </div>
          <div class="bg-white rounded p-2 text-center">
            <div class="text-2xl font-bold text-red-600">${hasil.gagal}</div>
            <div class="text-xs text-slate-500">Gagal</div>
          </div>
        </div>
        ${hasil.errors.length ? `
          <details class="mt-3 text-xs">
            <summary class="cursor-pointer text-red-700 font-medium">Detail error (${hasil.errors.length})</summary>
            <ul class="mt-2 space-y-1 text-red-600 max-h-40 overflow-y-auto list-disc list-inside">
              ${hasil.errors.slice(0, 50).map(e => `<li>${escapeHtml(e)}</li>`).join('')}
              ${hasil.errors.length > 50 ? `<li>... dan ${hasil.errors.length - 50} lainnya</li>` : ''}
            </ul>
          </details>
        ` : ''}
      </div>
    `;
  if (window.lucide) lucide.createIcons();


    toast(`Import: ${hasil.sukses} baru, ${hasil.diperbarui || 0} diperbarui, ${hasil.duplikat} sama, ${hasil.gagal} gagal`, 'success');    loadAnggota();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Proses Import';
  }
}

function downloadTemplate() {
  const csv = [
    'nis,nama,jenis,kelas,jenis_kelamin,no_hp,alamat,tanggal_aktif_sampai',
    '2025001,Ahmad Contoh,siswa,X-IPA-1,L,081234567001,Jl. Merdeka No. 1,2027-06-30',
    '2025002,Siti Contoh,siswa,X-IPA-1,P,081234567002,Jl. Sudirman No. 2,2026-12-31',
    'G010,Bapak Guru,guru,,L,081234567010,,'
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template_import_anggota.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ================================================================
// IMPORT EXCEL MASSAL
// ================================================================
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === 'undefined') {
      return reject(new Error('Library Excel belum dimuat. Periksa koneksi internet.'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const students = [];
        const seenNis = new Set();

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          // Hanya proses sheet yang punya header kolom student sebenarnya
          const hasStudentHeader = rows.some(row => {
            const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
            return rowStr.includes('nama siswa') &&
                   (rowStr.includes('no. induk') || rowStr.includes('no induk') || rowStr.includes('no.induk'));
          });
          if (!hasStudentHeader) return;

          let currentKelas = '';

          rows.forEach(row => {
            const cells = row.map(c => String(c || '').trim());
            if (cells.length === 0) return;

            // Deteksi "Kelas : VIII-A"
            const kelasIdx = cells.findIndex(c => c.toLowerCase() === 'kelas');
            if (kelasIdx !== -1) {
              for (const cell of cells) {
                const m = cell.match(/(VIII|VII|IX)\s*[-]?\s*([A-K])\b/i);
                if (m) {
                  currentKelas = `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
                  break;
                }
              }
              return;
            }

            // Deteksi baris siswa: [No, NO.INDUK, NISN, Nama, L/P, ...]
            if (cells.length >= 5 && currentKelas) {
              const c0 = cells[0], c1 = cells[1], c3 = cells[3], c4 = cells[4];
              if (/^\d+$/.test(c0) &&
                  /^\d{3,}$/.test(c1) &&
                  c3 && c3.length >= 2 && c3 !== '-' &&
                  /^[LP]$/i.test(c4)) {
                if (!seenNis.has(c1)) {
                  seenNis.add(c1);
                  students.push({
                    nis: c1,
                    nama: c3,
                    jenis: 'siswa',
                    kelas: currentKelas,
                    jenis_kelamin: c4.toUpperCase()
                  });
                }
              }
            }
          });
        });

        resolve(students);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file Excel'));
    reader.readAsArrayBuffer(file);
  });
}

async function updateBulkPreview() {
  const fileInput = document.getElementById('bulk-file');
  const previewEl = document.getElementById('bulk-preview');
  const startBtn = document.getElementById('btn-start-bulk');

  if (!fileInput.files[0]) {
    previewEl.classList.add('hidden');
    startBtn.disabled = true;
    state.bulkStudents = [];
    return;
  }

  previewEl.classList.remove('hidden');
  previewEl.innerHTML = `<div class="text-slate-500 text-sm flex items-center gap-2"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Membaca file Excel...</div>`;
  if (window.lucide) lucide.createIcons();

  try {
    const students = await parseExcelFile(fileInput.files[0]);
    state.bulkStudents = students;

    if (students.length === 0) {
      previewEl.innerHTML = `<div class="text-red-600 font-semibold text-sm">❌ Tidak ada data siswa terdeteksi. Pastikan file Excel memiliki kolom: <b>No. Urut, NO. INDUK, NISN, Nama Siswa, L/P</b>.</div>`;
      startBtn.disabled = true;
      return;
    }

    const kelasSet = new Set(students.map(s => s.kelas));
    const kelasList = [...kelasSet].sort().join(', ');
    const preview5 = students.slice(0, 5).map(s =>
      `<div class="text-[11px] font-mono text-slate-600">${s.nis} · ${s.nama} · ${s.kelas} · ${s.jenis_kelamin}</div>`
    ).join('');

    previewEl.innerHTML = `
      <div class="font-semibold text-emerald-700 mb-1 text-sm">✅ Terdeteksi ${students.length} siswa dari ${kelasSet.size} kelas</div>
      <div class="text-slate-500 text-[10px] mb-3 break-words">Kelas: ${kelasList}</div>
      <div class="text-slate-500 mb-1 text-[10px] uppercase tracking-wide font-semibold">Preview 5 pertama:</div>
      <div class="space-y-0.5">${preview5}</div>
    `;
    startBtn.disabled = false;
  } catch (err) {
    previewEl.innerHTML = `<div class="text-red-600 font-semibold text-sm">❌ ${err.message}</div>`;
    startBtn.disabled = true;
  }
}

async function startBulkImport() {
  const students = state.bulkStudents;
  if (!students.length) return toast('Tidak ada data untuk diimport', 'warning');

  const startBtn = document.getElementById('btn-start-bulk');
  const progressEl = document.getElementById('bulk-progress');
  const progressBar = document.getElementById('bulk-progress-bar');
  const progressText = document.getElementById('bulk-progress-text');
  const progressPct = document.getElementById('bulk-progress-pct');
  const resultEl = document.getElementById('bulk-result');

  startBtn.disabled = true;
  progressEl.classList.remove('hidden');
  resultEl.classList.add('hidden');

  const total = students.length;
  const BATCH_SIZE = 100;
    let processed = 0, sukses = 0, diperbarui = 0, duplikat = 0, gagal = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);
    try {
      const res = await apiPost('/anggota/import', { rows: batch });
      sukses     += res.hasil.sukses;
      diperbarui += res.hasil.diperbarui || 0;
      duplikat   += res.hasil.duplikat;
      gagal      += res.hasil.gagal;
    } catch (err) {
      gagal += batch.length;
    }

    processed += batch.length;
    const pct = Math.round((processed / total) * 100);
    progressBar.style.width = pct + '%';
    progressText.textContent = `Batch ${Math.ceil(processed / BATCH_SIZE)} dari ${Math.ceil(total / BATCH_SIZE)} · ${processed} / ${total} siswa`;
    progressPct.textContent = pct + '%';

    // Beri napas browser untuk render progress (loading jujur)
    await new Promise(r => setTimeout(r, 40));
  }

  progressText.textContent = '✅ Import selesai!';
  progressBar.style.background = '#10b981';

  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
      <div class="font-bold text-emerald-800 mb-3 flex items-center gap-2">
        <i data-lucide="check-circle" class="w-5 h-5"></i> Import Selesai
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div class="bg-white rounded-lg p-3 text-center border border-emerald-100">
          <div class="text-2xl font-bold text-emerald-600">${sukses}</div>
          <div class="text-[10px] text-slate-500 uppercase font-semibold">Baru</div>
        </div>
        <div class="bg-white rounded-lg p-3 text-center border border-blue-100">
          <div class="text-2xl font-bold text-blue-600">${diperbarui}</div>
          <div class="text-[10px] text-slate-500 uppercase font-semibold">Diperbarui</div>
        </div>
        <div class="bg-white rounded-lg p-3 text-center border border-amber-100">
          <div class="text-2xl font-bold text-amber-600">${duplikat}</div>
          <div class="text-[10px] text-slate-500 uppercase font-semibold">Duplikat</div>
        </div>
        <div class="bg-white rounded-lg p-3 text-center border border-red-100">
          <div class="text-2xl font-bold text-red-600">${gagal}</div>
          <div class="text-[10px] text-slate-500 uppercase font-semibold">Gagal</div>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  toast(`Import: ${sukses} baru, ${diperbarui} diperbarui, ${duplikat} sama, ${gagal} gagal`, 'success');
  loadAnggota();

  state.bulkStudents = [];
  startBtn.disabled = true;
}

async function resetPassword(id, nama) {
  const yakin = confirm(`Reset password untuk "${nama}"?\n\nPassword akan kembali menjadi NIS mereka, dan mereka wajib menggantinya saat login.`);
  if (!yakin) return;

  try {
    const res = await apiPost(`/anggota/${id}/reset-password`, {});
    toast(res.message, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Form modal
  document.getElementById('btn-tambah').addEventListener('click', () => openModal('tambah'));
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('form-anggota').addEventListener('submit', submitForm);

  // Hapus modal
  document.getElementById('btn-cancel-hapus').addEventListener('click', () => {
    document.getElementById('modal-hapus').classList.add('hidden');
  });
  document.getElementById('btn-konfirmasi-hapus').addEventListener('click', lakukanHapus);

  // Import modal
  document.getElementById('btn-import').addEventListener('click', openImportModal);
  document.getElementById('btn-close-import').addEventListener('click', closeImportModal);
  document.getElementById('btn-cancel-import').addEventListener('click', closeImportModal);
  document.getElementById('file-csv').addEventListener('change', handleFileCSV);
  document.getElementById('btn-proses-import').addEventListener('click', prosesImport);
  document.getElementById('btn-download-template').addEventListener('click', downloadTemplate);

    // --- IMPORT EXCEL MASSAL ---
  document.getElementById('btn-import-bulk')?.addEventListener('click', () => {
    document.getElementById('modal-bulk').classList.remove('hidden');
    document.getElementById('bulk-file').value = '';
    document.getElementById('bulk-preview').classList.add('hidden');
    document.getElementById('bulk-progress').classList.add('hidden');
    document.getElementById('bulk-result').classList.add('hidden');
    document.getElementById('btn-start-bulk').disabled = true;
    state.bulkStudents = [];
    if (window.lucide) lucide.createIcons();
  });

  document.getElementById('btn-close-bulk')?.addEventListener('click', () => {
    document.getElementById('modal-bulk').classList.add('hidden');
  });

  document.getElementById('bulk-file')?.addEventListener('change', updateBulkPreview);
  document.getElementById('btn-start-bulk')?.addEventListener('click', startBulkImport);

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    window.location.href = '/api/anggota/export';
  });

  // Filter & search
  let searchTimer = null;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadAnggota();
    }, 400);
  });

  document.getElementById('filter-jenis').addEventListener('change', (e) => {
    state.jenis = e.target.value; state.page = 1; loadAnggota();
  });
  document.getElementById('filter-kelas').addEventListener('change', (e) => {
    state.kelas = e.target.value; state.page = 1; loadAnggota();
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value; state.page = 1; loadAnggota();
  });
  document.getElementById('filter-limit').addEventListener('change', (e) => {
    state.limit = Number(e.target.value); state.page = 1; loadAnggota();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    state.page = 1; state.search = ''; state.jenis = ''; state.kelas = ''; state.status = '';
    document.getElementById('search').value = '';
    document.getElementById('filter-jenis').value = '';
    document.getElementById('filter-kelas').value = '';
    document.getElementById('filter-status').value = '';
    loadAnggota();
  });

  // Esc tutup semua modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeImportModal();
      document.getElementById('modal-hapus').classList.add('hidden');
    }
  });

  // Klik backdrop untuk tutup
  ['modal', 'modal-hapus', 'modal-import'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('click', (e) => {
      if (e.target.id === id) el.classList.add('hidden');
    });
  });

  // Event delegation untuk tombol aksi tabel
  document.getElementById('tabel-body').addEventListener('click', (e) => {
    const btnEdit = e.target.closest('[data-action="editAnggota"]');
    if (btnEdit) return editAnggota(btnEdit.dataset.id);

    const btnHapus = e.target.closest('[data-action="konfirmasiHapus"]');
    if (btnHapus) return konfirmasiHapus(btnHapus.dataset.id, btnHapus.dataset.str);
    
    const btnResetPassword = e.target.closest('[data-action="resetPassword"]');
    if (btnResetPassword) return resetPassword(btnResetPassword.dataset.id, btnResetPassword.dataset.str);

    const btnPage = e.target.closest('[data-action="gotoPage"]');
    if (btnPage) return gotoPage(Number(btnPage.dataset.id));
  });

  loadAnggota();
});