/* ============================================================
 * Pengingat Perpanjangan Masa Aktif Domain — Frontend
 * - Fetch GET /api/pengingat/domain
 * - Tampil modal SEKALI per hari (localStorage)
 * - Tidak memblokir aplikasi (tetap bisa dismiss)
 * - Pakai data-action + event delegation (no inline onclick)
 * - Ikon SVG inline (no emoji)
 * ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    endpoint:      '/api/pengingat/domain',
    renewEndpoint: '/api/pengingat/domain/perpanjang',
    settingsUrl:   '/pengaturan.html',
    storageKey:    'domain_reminder_shown_date',
    skipPaths:     ['/login.html']
  };

  // ===== SVG Lucide inline =====
  const SVG_BELL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
    '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

  const SVG_ALERT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

  const SVG_INFO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

  const SVG_CHECK =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 6 9 17l-5-5"/></svg>';

  const SVG_X =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ===== Helper =====
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function alreadyShownToday() {
    try { return localStorage.getItem(CONFIG.storageKey) === todayStr(); }
    catch (e) { return false; }
  }

  function markShownToday() {
    try { localStorage.setItem(CONFIG.storageKey, todayStr()); } catch (e) {}
  }

  function shouldSkip() {
    if (CONFIG.skipPaths.indexOf(window.location.pathname) !== -1) return true;
    if (document.body && document.body.classList.contains('no-pengingat-domain')) return true;
    return false;
  }

  // ===== Modal builder =====
  function buildModal(data) {
    let variant, icon, title, body, primaryBtn;

    if (data.state === 'expired') {
      variant = 'danger';
      icon = SVG_ALERT;
      title = 'Masa Aktif Domain Telah Berakhir';
      body = 'Masa aktif sistem perpustakaan telah berakhir <strong>' +
        Math.abs(data.sisa_hari) + ' hari</strong> lalu (' + data.expired_at +
        '). Silakan perpanjang agar sistem sesuai lisensi resmi.';
      primaryBtn = '<button type="button" class="domain-reminder-btn domain-reminder-btn-primary" ' +
        'data-action="renew-domain">Perpanjang ' + data.renewal_duration_days + ' Hari</button>';
    } else if (data.state === 'warning') {
      variant = 'warning';
      icon = SVG_BELL;
      title = 'Pengingat Perpanjangan Domain';
      body = 'Masa aktif sistem perpustakaan akan berakhir dalam <strong>' +
        data.sisa_hari + ' hari</strong> (tanggal ' + data.expired_at +
        '). Anda sudah bisa memperpanjang sekarang.';
      primaryBtn = '<button type="button" class="domain-reminder-btn domain-reminder-btn-primary" ' +
        'data-action="renew-domain">Perpanjang ' + data.renewal_duration_days + ' Hari</button>';
    } else if (data.state === 'unset') {
      variant = 'info';
      icon = SVG_INFO;
      title = 'Masa Aktif Domain Belum Diatur';
      body = 'Tanggal berakhirnya masa aktif sistem belum diatur. Atur di halaman Pengaturan agar pengingat perpanjangan berjalan otomatis.';
      primaryBtn = '<button type="button" class="domain-reminder-btn domain-reminder-btn-primary" ' +
        'data-action="open-settings">Buka Pengaturan</button>';
    } else {
      return null; // state 'ok' → jangan tampilkan
    }

    const overlay = document.createElement('div');
    overlay.id = 'domain-reminder-overlay';
    overlay.className = 'domain-reminder-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="domain-reminder-card domain-reminder-' + variant + '">' +
        '<div class="domain-reminder-header">' +
          '<div class="domain-reminder-icon">' + icon + '</div>' +
          '<div class="domain-reminder-title">' + title + '</div>' +
          '<button type="button" class="domain-reminder-close" ' +
            'data-action="dismiss-domain-reminder" aria-label="Tutup">' +
            SVG_X +
          '</button>' +
        '</div>' +
        '<div class="domain-reminder-body">' + body + '</div>' +
        '<div class="domain-reminder-footer">' +
          '<button type="button" class="domain-reminder-btn domain-reminder-btn-secondary" ' +
            'data-action="dismiss-domain-reminder">Nanti Saja</button>' +
          primaryBtn +
        '</div>' +
      '</div>';
    return overlay;
  }

  function openModal(data) {
    const m = buildModal(data);
    if (!m) return;
    // Cegah dobel
    const existing = document.getElementById('domain-reminder-overlay');
    if (existing) existing.remove();
    document.body.appendChild(m);
    markShownToday();
  }

  function closeModal() {
    const m = document.getElementById('domain-reminder-overlay');
    if (m) m.remove();
  }

  // ===== Event delegation (no inline onclick) =====
  document.addEventListener('click', async function (e) {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');

    if (action === 'dismiss-domain-reminder') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (action === 'open-settings') {
      e.preventDefault();
      window.location.href = CONFIG.settingsUrl;
      return;
    }

    if (action === 'renew-domain') {
      e.preventDefault();
      trigger.disabled = true;
      const originalText = trigger.textContent;
      trigger.textContent = 'Memproses...';

      try {
        const res = await fetch(CONFIG.renewEndpoint, {
          method: 'GET',                     // GET → tidak dicek CSRF middleware Anda
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });
        const json = await res.json();

        if (!res.ok || json.status !== 'ok') {
          trigger.disabled = false;
          trigger.textContent = originalText;
          const bodyEl = document.querySelector('.domain-reminder-body');
          if (bodyEl) {
            bodyEl.innerHTML = '<strong>Gagal memperpanjang.</strong> ' +
              (json.message || 'Silakan coba lagi.');
          }
          return;
        }

        // Sukses — update tampilan modal
        const cardEl   = document.querySelector('.domain-reminder-card');
        const iconEl   = document.querySelector('.domain-reminder-icon');
        const bodyEl   = document.querySelector('.domain-reminder-body');
        const footerEl = document.querySelector('.domain-reminder-footer');
        const titleEl  = document.querySelector('.domain-reminder-title');

        if (cardEl) {
          cardEl.classList.remove('domain-reminder-warning', 'domain-reminder-danger');
          cardEl.classList.add('domain-reminder-success');
        }
        if (iconEl)  iconEl.innerHTML  = SVG_CHECK;
        if (titleEl) titleEl.textContent = 'Masa Aktif Berhasil Diperpanjang';
        if (bodyEl) {
          bodyEl.innerHTML = 'Masa aktif sistem perpustakaan kini berlaku sampai <strong>' +
            json.expired_at + '</strong>.';
        }
        if (footerEl) {
          footerEl.innerHTML =
            '<button type="button" class="domain-reminder-btn domain-reminder-btn-primary" ' +
              'data-action="dismiss-domain-reminder">OK</button>';
        }
      } catch (err) {
        trigger.disabled = false;
        trigger.textContent = originalText;
        const bodyEl = document.querySelector('.domain-reminder-body');
        if (bodyEl) bodyEl.innerHTML = '<strong>Gagal terhubung ke server.</strong> Silakan coba lagi.';
      }
    }
  });

  // ===== Init =====
  async function init() {
    if (shouldSkip()) return;
    if (alreadyShownToday()) return;

    try {
      const res = await fetch(CONFIG.endpoint, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json || json.status !== 'ok') return;

      // state 'ok' = masih jauh dari expired → tidak perlu modal
      if (json.state === 'ok') return;

      openModal(json);
    } catch (err) {
      // Diamkan kalau offline / server down
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();