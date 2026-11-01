// public/js/icons.js
// Render ikon seketika saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
});

// Buat fungsi global agar bisa dipanggil dari file JS lain (misal setelah load tabel)
window.refreshIcons = function() {
  if (window.lucide) lucide.createIcons();
};