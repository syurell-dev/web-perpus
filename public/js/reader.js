const urlParams = new URLSearchParams(window.location.search);
const bookId = urlParams.get('id');

let db;
let pdfBlobUrl = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PerpusDigitalDB', 1);
    request.onerror = (e) => reject(e.target.error);
    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains('pdf_files')) db.createObjectStore('pdf_files');
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(); };
  });
}

function getCachedPDF(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pdf_files', 'readonly');
    const request = tx.objectStore('pdf_files').get(id.toString());
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function savePDFToCache(id, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pdf_files', 'readwrite');
    const request = tx.objectStore('pdf_files').put(blob, id.toString());
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!bookId) { window.location.href = '/portal.html'; return; }
  if (window.lucide) lucide.createIcons();

  const iframe = document.getElementById('pdf-frame');
  const loadingScreen = document.getElementById('loading-screen');
  const fallbackButtons = document.getElementById('fallback-buttons');
  const btnDownload = document.getElementById('btn-download');
  const cacheStatus = document.getElementById('cache-status');
  const bookTitle = document.getElementById('book-title');
  
  try {
    await initDB();

    try {
      const res = await apiGet('/digital');
      const book = res.data.find(b => b.id == bookId);
      if (book) bookTitle.textContent = book.judul;
    } catch (e) {
      if (e.message.includes('Belum login')) { window.location.href = '/login.html'; return; }
    }

    // Cek apakah sudah ada di cache (Offline)
    const cachedBlob = await getCachedPDF(bookId);

    if (cachedBlob) {
      console.log('Membuka dari Offline Cache...');
      const pdfBlob = new Blob([cachedBlob], { type: 'application/pdf' });
      pdfBlobUrl = URL.createObjectURL(pdfBlob);
      iframe.src = pdfBlobUrl;
      
      cacheStatus.classList.remove('hidden');
      cacheStatus.classList.add('bg-emerald-900/50', 'text-emerald-400');
      btnDownload.classList.add('hidden'); 
      
    } else {
      console.log('Mengambil dari server...');
      iframe.src = `/api/digital/file/${bookId}`;
      btnDownload.classList.remove('hidden');
      cacheStatus.classList.add('hidden');
    }

    // Tampilkan Iframe & Sembunyikan Loading
    iframe.classList.remove('hidden');
    loadingScreen.classList.add('hidden');

    // Tampilkan tombol cadangan (Buka Tab Baru / Download) SETELAH 2 detik
    // Jaga-jaga jika layar PDF hitam/kosong.
    setTimeout(() => {
      fallbackButtons.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }, 2000);

    // Aksi Tombol Cadangan
    document.getElementById('btn-open-tab').addEventListener('click', () => {
      window.open(iframe.src, '_blank');
    });
    document.getElementById('btn-download-pc').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = iframe.src;
      a.download = `Buku_${bookId}.pdf`;
      a.click();
    });

    // Logika Simpan Offline
    btnDownload.addEventListener('click', async () => {
      try {
        btnDownload.disabled = true;
        btnDownload.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Mengunduh...`;
        
        const response = await fetch(`/api/digital/file/${bookId}`);
        
        // CEK APAKAH RESPONSENYA BENAR-BENAR PDF
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('text/html')) {
          throw new Error('Server mengirim error atau halaman login. Pastikan Anda sudah login!');
        }
        
        const blob = await response.blob();
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        
        await savePDFToCache(bookId, pdfBlob);
        
        cacheStatus.classList.remove('hidden');
        cacheStatus.classList.add('bg-emerald-900/50', 'text-emerald-400');
        btnDownload.classList.add('hidden');
        
        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        pdfBlobUrl = URL.createObjectURL(pdfBlob);
        iframe.src = pdfBlobUrl;
        
        alert('Berhasil disimpan ke perangkat!');
      } catch (err) {
        alert(err.message);
        btnDownload.disabled = false;
        btnDownload.innerHTML = `<i data-lucide="download" class="w-4 h-4"></i> Simpan Offline`;
        if (window.lucide) lucide.createIcons();
      }
    });

  } catch (err) {
    console.error(err);
    loadingScreen.innerHTML = `<div class="text-red-500 text-sm font-medium">${err.message}</div>`;
  }
});