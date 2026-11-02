const urlParams = new URLSearchParams(window.location.search);
const bookId = urlParams.get('id');

let db;
let pdfDoc = null;
let pageNum = 1;
let scale = 1.0; 
let pageRendering = false;
let pageNumPending = null;

// --- INDEXEDDB SETUP ---
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

// --- RENDER PDF DENGAN ANIMASI ---
function renderPage(num) {
  pageRendering = true;
  const loadingScreen = document.getElementById('loading-screen');
  const canvas = document.getElementById('pdf-canvas');
  
  // Sembunyikan loading screen
  loadingScreen.classList.remove('flex');
  loadingScreen.classList.add('hidden');

  pdfDoc.getPage(num).then(function(page) {
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('pdf-container');
    
    // Hitung lebar berdasarkan scale (zoom)
    const containerWidth = container.clientWidth - 32; 
    const viewport = page.getViewport({ scale: 1.0 });
    const baseScale = containerWidth / viewport.width;
    const finalScale = baseScale * scale;
    
    // Kualitas Tinggi (Anti Blur)
    const dpr = window.devicePixelRatio || 1;
    const renderScale = finalScale * dpr;
    const scaledViewport = page.getViewport({ scale: renderScale });

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    canvas.style.width = `${scaledViewport.width / dpr}px`;
    canvas.style.height = `${scaledViewport.height / dpr}px`;

    const renderContext = {
      canvasContext: ctx,
      viewport: scaledViewport
    };
    
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
      pageRendering = false;
      
      // Terapkan animasi smooth (Fade & Scale)
      canvas.classList.remove('animate-page');
      void canvas.offsetWidth; // Trigger reflow
      canvas.classList.add('animate-page');

      // Scroll ke atas dengan halus
      container.scrollTo({ top: 0, behavior: 'smooth' });

      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    }).catch(function(err) {
      pageRendering = false;
    });
  }).catch(function(err) {
    pageRendering = false;
  });

  document.getElementById('page-input').value = num;
  updateNavButtons();
}

function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

// --- KONTROL HALAMAN ---
function onPrevPage() {
  if (pageNum <= 1) return;
  pageNum--;
  queueRenderPage(pageNum);
}

function onNextPage() {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  queueRenderPage(pageNum);
}

function goToPage() {
  const input = document.getElementById('page-input');
  let target = parseInt(input.value);
  if (isNaN(target) || target < 1 || target > pdfDoc.numPages) {
    input.value = pageNum;
    return;
  }
  if (target !== pageNum) {
    pageNum = target;
    queueRenderPage(pageNum);
  }
}

function updateNavButtons() {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  if (prevBtn) prevBtn.disabled = pageNum <= 1;
  if (nextBtn) nextBtn.disabled = pageNum >= pdfDoc.numPages;
}

// --- KONTROL ZOOM ---
function zoomIn() {
  if (scale >= 2.5) return;
  scale += 0.25;
  queueRenderPage(pageNum);
}

function zoomOut() {
  if (scale <= 0.5) return;
  scale -= 0.25;
  queueRenderPage(pageNum);
}

// --- FULLSCREEN ---
function toggleFullscreen() {
  const header = document.getElementById('reader-header');
  const footer = document.getElementById('reader-footer');
  const main = document.getElementById('reader-main');
  const icon = document.querySelector('#btn-fullscreen i');

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    header.classList.add('hidden-ui');
    footer.classList.add('hidden-ui-bottom');
    main.classList.remove('pt-16', 'pb-24');
    icon.setAttribute('data-lucide', 'minimize');
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    header.classList.remove('hidden-ui');
    footer.classList.remove('hidden-ui-bottom');
    main.classList.add('pt-16', 'pb-24');
    icon.setAttribute('data-lucide', 'maximize');
  }
  if (window.lucide) lucide.createIcons();
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  if (!bookId) { window.location.href = '/portal.html'; return; }
  if (window.lucide) lucide.createIcons();

  const btnDownload = document.getElementById('btn-download');
  const cacheStatus = document.getElementById('cache-status');
  const bookTitle = document.getElementById('book-title');
  const loadingText = document.getElementById('loading-text');
  const container = document.getElementById('pdf-container');

  // Event Listeners
  document.getElementById('prev-page').addEventListener('click', onPrevPage);
  document.getElementById('next-page').addEventListener('click', onNextPage);
  document.getElementById('page-input').addEventListener('change', goToPage);
  document.getElementById('page-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') goToPage(); });
  
  document.getElementById('zoom-in').addEventListener('click', zoomIn);
  document.getElementById('zoom-out').addEventListener('click', zoomOut);
  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.getElementById('reader-header').classList.contains('hidden-ui')) {
      toggleFullscreen();
    }
  });

  // --- SWIPE GESTURE (DIPERBAIKI) ---
  let touchStartX = 0;
  let touchStartY = 0;

  container.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  container.addEventListener('touchend', e => {
    // 🔥 KUNCI UTAMA: Jika sedang zoom (scale > 1.0), JANGAN izinkan swipe ganti halaman
    // Agar user bisa menggeser (pan) gambar PDF dengan bebas.
    if (scale > 1.0) return;

    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Pastikan gerakan benar-benar horizontal (geser kiri/kanan), bukan scroll ke bawah
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && Math.abs(deltaY) < 40) {
      if (deltaX < 0) {
        onNextPage(); // Swipe Kiri
      } else {
        onPrevPage(); // Swipe Kanan
      }
    }
  }, { passive: true });

  try {
    await initDB();

    try {
      const res = await apiGet('/digital');
      const book = res.data.find(b => b.id == bookId);
      if (book) bookTitle.textContent = book.judul;
    } catch (e) {}

    const cachedBlob = await getCachedPDF(bookId);
    let pdfData;

    if (cachedBlob) {
      const pdfBlob = new Blob([cachedBlob], { type: 'application/pdf' });
      pdfData = await pdfBlob.arrayBuffer();
      cacheStatus.classList.remove('hidden');
      cacheStatus.classList.add('bg-emerald-900/50', 'text-emerald-400');
      btnDownload.classList.add('hidden'); 
    } else {
      const response = await fetch(`/api/digital/file/${bookId}`);
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        throw new Error('Sesi habis, silakan login ulang.');
      }
      pdfData = await response.arrayBuffer();
      btnDownload.classList.remove('hidden');
      cacheStatus.classList.add('hidden');
    }

    loadingText.textContent = "Memuat halaman...";

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    pdfDoc = await loadingTask.promise;

    document.getElementById('page-count').textContent = pdfDoc.numPages;
    document.getElementById('page-input').max = pdfDoc.numPages;
    
    renderPage(pageNum);

    btnDownload.addEventListener('click', async () => {
      try {
        btnDownload.disabled = true;
        btnDownload.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;
        const response = await fetch(`/api/digital/file/${bookId}`);
        const blob = await response.blob();
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        
        await savePDFToCache(bookId, pdfBlob);
        cacheStatus.classList.remove('hidden');
        cacheStatus.classList.add('bg-emerald-900/50', 'text-emerald-400');
        btnDownload.classList.add('hidden');
        alert('Berhasil disimpan ke perangkat!');
      } catch (err) {
        alert(err.message);
        btnDownload.disabled = false;
        btnDownload.innerHTML = `<i data-lucide="download" class="w-4 h-4"></i>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });

  } catch (err) {
    console.error(err);
    loadingText.innerHTML = `<span class="text-red-500 font-bold">Gagal membuka buku.<br>${err.message}</span>`;
  }
});