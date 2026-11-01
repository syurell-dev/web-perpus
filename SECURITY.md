# Security Policy

## Supported Versions

Saat ini, hanya versi terbaru dari aplikasi Perpustakaan yang menerima pembaruan keamanan.

| Version | Supported          |
| ------- | ------------------ |
| v1.2.x  | Ya                 |
| < v1.2  | Tidak              |

## Reporting a Vulnerability

Karena aplikasi ini menangani data sensitif (NIS, Nama Siswa, Riwayat Peminjaman), kami sangat menghargai setiap laporan terkait keamanan.

**MOHON JANGAN melaporkan celah keamanan melalui fitur *Issues* publik di GitHub.**

Sebagai gantinya, silakan laporkan melalui salah satu cara berikut:
1. Gunakan fitur **Private Vulnerability Reporting** di tab *Security* pada repositori ini.
2. Hubungi pengembang secara langsung melalui email: **syurell.hartono@gmail.com** *(Ganti dengan email Anda yang sebenarnya)*.

Anda akan menerima balasan dalam waktu 1x24 jam. Jika celah keamanan terbukti valid, patch akan segera dirilis pada pembaruan versi berikutnya.

## Scope & Context

Aplikasi ini dirancang untuk berjalan secara lokal (offline) di lingkungan jaringan sekolah. Fokus keamanan utama aplikasi ini meliputi:
*   Mencegah akses tidak sah ke Dashboard Admin.
*   Melindungi integritas data siswa di dalam database SQLite (`perpus.db`).
*   Mencegah serangan SQL Injection dan Cross-Site Scripting (XSS) pada formulir input.