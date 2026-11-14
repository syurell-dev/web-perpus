// ================================================================
// pengaturan.js — Logika halaman Pengaturan (Final Clean)
// ================================================================

const state = {
  settings: {},
  resetType: null,
  anggotaList: []
};

function formatTanggalWaktu(str) {
  if (!str) return '-';
  const d = new Date(str);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ================================================================
// LOAD
// ================================================================
async function loadPengaturan() {
  try {
    const res = await apiGet('/pengaturan');
    state.settings = {};
    res.data.forEach(p => { state.settings[p.key] = p.value; });

    document.getElementById('f-nama_perpustakaan').value  = state.settings.nama_perpustakaan || '';
    document.getElementById('f-lama_pinjam_default').value = state.settings.lama_pinjam_default || 7;
    document.getElementById('f-max_buku_per_pinjam').value = state.settings.max_buku_per_pinjam || 3;
    
    const domainInput = document.getElementById('f-domain_expired_at');
    if (domainInput) domainInput.value = state.settings.domain_expired_at || '';

    const versionEl = document.querySelector('[data-app-version]');
    if (versionEl && res.app) versionEl.textContent = 'v' + res.app.version;

    const info = res.info;
    document.getElementById('info-size').textContent = info.db_size_human;
    document.getElementById('info-mtime').textContent = formatTanggalWaktu(info.db_mtime);
    document.getElementById('info-buku').textContent = info.counts.buku.toLocaleString('id-ID');
    document.getElementById('info-anggota').textContent = info.counts.anggota.toLocaleString('id-ID');
    document.getElementById('info-peminjaman').textContent = info.counts.peminjaman.toLocaleString('id-ID');
    document.getElementById('info-detail').textContent = info.counts.detail.toLocaleString('id-ID');
  } catch (err) {
    toast('Gagal memuat pengaturan: ' + err.message, 'error');
  }
}

// ================================================================
// SIMPAN
// ================================================================
async function simpanPengaturan(e) {
  e.preventDefault();

  const payload = {
    nama_perpustakaan:   document.getElementById('f-nama_perpustakaan').value.trim(),
    lama_pinjam_default: document.getElementById('f-lama_pinjam_default').value,
    max_buku_per_pinjam: document.getElementById('f-max_buku_per_pinjam').value,
    domain_expired_at:   document.getElementById('f-domain_expired_at') ? document.getElementById('f-domain_expired_at').value : ''
  };

  const btn = document.getElementById('btn-simpan');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Menyimpan...';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await apiPut('/pengaturan', payload);
    toast(res.message, 'success');
    await loadPengaturan();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Simpan Pengaturan';
    if (window.lucide) lucide.createIcons();
  }
}

// ================================================================
// PERPANJANG DOMAIN
// ================================================================
async function perpanjangDomain() {
  if (!confirm('Perpanjang masa aktif sistem selama 365 hari dari tanggal berakhir saat ini?')) return;
  
  const btn = document.getElementById('btn-perpanjang-domain');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Memproses...';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/pengingat/domain/perpanjang', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });
    const json = await res.json();

    if (!res.ok || json.status !== 'ok') throw new Error(json.message || 'Gagal memperpanjang');
    toast(json.message, 'success');
    await loadPengaturan();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    if (window.lucide) lucide.createIcons();
  }
}

// ================================================================
// BACKUP
// ================================================================
function downloadBackup() {
  toast('Menyiapkan backup...', 'info');
  window.location.href = '/api/pengaturan/backup';
}

// ================================================================
// RESET
// ================================================================
function bukaModalReset(type) {
  state.resetType = type;
  const title = document.getElementById('reset-title');
  const desc = document.getElementById('reset-desc');

  if (type === 'peminjaman') {
    title.textContent = 'Reset Data Peminjaman?';
    desc.textContent = 'Semua transaksi peminjaman akan dihapus dan stok buku dikembalikan seperti semula.';
  } else {
    title.textContent = 'Hapus SEMUA Data?';
    desc.textContent = 'Semua buku, anggota, dan peminjaman akan dihapus permanen. Pengaturan tetap disimpan.';
  }

  document.getElementById('input-konfirmasi').value = '';
  document.getElementById('btn-konfirmasi-reset').disabled = true;
  document.getElementById('modal-reset').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-konfirmasi').focus(), 100);
}

async function lakukanReset() {
  const btn = document.getElementById('btn-konfirmasi-reset');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const res = await apiPost('/pengaturan/reset', {
      konfirmasi: 'HAPUS',
      what: state.resetType
    });
    toast(res.message, 'success');
    document.getElementById('modal-reset').classList.add('hidden');
    await loadPengaturan();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Konfirmasi Reset';
  }
}

// ================================================================
// KARTU ANGGOTA
// ================================================================
async function loadAnggotaDropdown() {
  try {
    const res = await apiGet('/anggota', { limit: 2000, status: 'aktif' });
    state.anggotaList = res.data;

    const sel = document.getElementById('pilih-anggota');
    if (sel) {
      sel.innerHTML = '<option value="">-- Pilih Anggota --</option>' +
        res.data.map(a => `<option value="${a.id}">${escapeHtml(a.nama)} — ${escapeHtml(a.nis)}${a.kelas ? ' (' + escapeHtml(a.kelas) + ')' : ''}</option>`).join('');
    }

    const selKelas = document.getElementById('pilih-kelas');
    if (selKelas) {
      const kelasList = [...new Set(res.data.map(a => a.kelas).filter(Boolean))].sort();
      selKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
        kelasList.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
    }
  } catch (err) {
    toast('Gagal memuat anggota: ' + err.message, 'error');
  }
}

function nisToEAN13(nis) {
  const digits = String(nis).replace(/\D/g, '');
  const prefix = '200'; 
  const body = digits.padStart(9, '0').slice(-9);
  const base12 = prefix + body;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base12 + check;
}

async function generateKartuHTML(anggota) {
  const barcodeVal = nisToEAN13(anggota.nis);
  const uid = 'bc-' + anggota.id + '-' + Math.random().toString(36).slice(2, 6);

  return `
    <div class="print-card">
      <div class="print-card-header">
        <img src="/img/logo.png" alt="Logo">
        <div class="print-card-title">
          Kartu Anggota Perpustakaan
          <div class="sub">SMP Negeri 1 Taman</div>
        </div>
      </div>
      <div class="print-card-info-block">
        <div class="name">${escapeHtml(anggota.nama)}</div>
        <div class="nis">NIS: ${escapeHtml(anggota.nis)}</div>
        <div class="meta">
          ${escapeHtml(anggota.kelas) || '—'} · ${anggota.jenis.toUpperCase()}
          ${anggota.jenis_kelamin ? ' · ' + (anggota.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan') : ''}
        </div>
      </div>
      <div class="print-card-barcode">
        <svg id="${uid}" class="barcode-svg" data-value="${barcodeVal}"></svg>
      </div>
      <div class="print-card-footer">
        <span>Simpan kartu ini dengan baik</span>
        <span>${new Date().getFullYear()}</span>
      </div>
    </div>
  `;
}

function renderAllBarcodes() {
  if (typeof JsBarcode === 'undefined') return;
  document.querySelectorAll('.barcode-svg').forEach(svg => {
    const val = svg.dataset.value;
    if (!val) return;
    try {
      JsBarcode(svg, val, { format: 'EAN13', width: 1.4, height: 38, displayValue: true, fontSize: 9, margin: 0, font: 'Courier New', textMargin: 1 });
    } catch (e) {
      try { JsBarcode(svg, val, { format: 'CODE128', width: 1.4, height: 38, displayValue: true, fontSize: 9, margin: 0, font: 'Courier New' }); } catch (e2) {}
    }
  });
}

async function cetakKartu() {
  const id = document.getElementById('pilih-anggota').value;
  if (!id) return toast('Pilih anggota dulu', 'warning');
  const anggota = state.anggotaList.find(a => a.id == id);
  if (!anggota) return toast('Anggota tidak ditemukan', 'error');

  const html = await generateKartuHTML(anggota);
  document.getElementById('print-area').innerHTML = `<div class="print-page"><div class="print-cards-container">${html}</div></div>`;
  setTimeout(() => { renderAllBarcodes(); setTimeout(() => window.print(), 300); }, 100);
}

async function cetakSemuaKartu() {
  if (!state.anggotaList.length) return toast('Belum ada anggota', 'warning');
  const selectedKelas = document.getElementById('pilih-kelas').value;
  if (!selectedKelas) return toast('Silakan pilih kelas terlebih dahulu', 'warning');
  
  const list = state.anggotaList.filter(a => a.kelas === selectedKelas);
  if (list.length === 0) return toast(`Tidak ada siswa di kelas ${selectedKelas}`, 'warning');
  if (list.length > 60) return toast(`Maksimal 60 kartu sekali cetak.`, 'warning');

  const cards = await Promise.all(list.map(a => generateKartuHTML(a)));
  document.getElementById('print-area').innerHTML = `
    <div class="print-page">
      <div class="print-header"><h1>Kartu Anggota Perpustakaan</h1><p class="meta">Kelas ${escapeHtml(selectedKelas)} — ${list.length} kartu</p></div>
      <div class="print-cards-container">${cards.join('')}</div>
    </div>`;
  setTimeout(() => { renderAllBarcodes(); setTimeout(() => window.print(), 300); }, 100);
}

// ================================================================
// INIT & RESTORE
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  await loadPengaturan();
  await loadAnggotaDropdown();

  document.getElementById('form-pengaturan').addEventListener('submit', simpanPengaturan);
  
  const btnPerpanjang = document.getElementById('btn-perpanjang-domain');
  if (btnPerpanjang) btnPerpanjang.addEventListener('click', perpanjangDomain);

  document.getElementById('btn-backup').addEventListener('click', downloadBackup);

  document.getElementById('btn-reset-peminjaman').addEventListener('click', () => bukaModalReset('peminjaman'));
  document.getElementById('btn-reset-semua').addEventListener('click', () => bukaModalReset('semua'));

  const inputKonfirmasi = document.getElementById('input-konfirmasi');
  if (inputKonfirmasi) {
    inputKonfirmasi.addEventListener('input', (e) => {
      document.getElementById('btn-konfirmasi-reset').disabled = e.target.value !== 'HAPUS';
    });
  }

  document.getElementById('btn-cancel-reset')?.addEventListener('click', () => document.getElementById('modal-reset').classList.add('hidden'));
  document.getElementById('btn-konfirmasi-reset')?.addEventListener('click', lakukanReset);
  document.getElementById('modal-reset')?.addEventListener('click', (e) => { if (e.target.id === 'modal-reset') e.currentTarget.classList.add('hidden'); });

  document.getElementById('pilih-anggota')?.addEventListener('change', (e) => {
    document.getElementById('btn-cetak-kartu').disabled = !e.target.value;
  });
  document.getElementById('btn-cetak-kartu')?.addEventListener('click', cetakKartu);
  document.getElementById('btn-cetak-semua')?.addEventListener('click', cetakSemuaKartu);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('modal-reset')?.classList.add('hidden'); });

  // --- LOGIKA RESTORE DATABASE (YANG TADI HILANG) ---
  const formRestore = document.getElementById('form-restore');
  if (formRestore) {
    formRestore.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log("🚀 [1] Tombol Restore diklik, form terpicu.");
      
      const fileInput = document.getElementById('file-restore');
      const file = fileInput.files[0];
      console.log("📁 [2] File yang dipilih:", file ? file.name : "TIDAK ADA FILE");

      if (!file) return toast('Pilih file database (.db) terlebih dahulu!', 'warning');

      const konfirmasi = confirm("⚠️ PERINGATAN KERAS ⚠️\n\nAnda akan menimpa SELURUH DATA saat ini dengan file backup.\n\nLanjutkan?");
      if (!konfirmasi) return;

      const btn = document.getElementById('btn-restore');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Memproses...`;

      const formData = new FormData();
      formData.append('database_file', file);

      try {
        console.log("📡 [4] Mengirim request ke /api/pengaturan/restore...");
        const res = await fetch('/api/pengaturan/restore', { method: 'POST', body: formData });
        const data = await res.json();
        console.log("📥 [5] Response:", data);

        if (!res.ok) throw new Error(data.message || 'Gagal restore');

        alert("✅ " + data.message + "\n\nHalaman akan dimuat ulang.");
        window.location.href = '/login.html';
        
      } catch (err) {
        console.error("❌ Error:", err);
        alert("❌ ERROR: " + err.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }
});