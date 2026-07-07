# Standar Coding Dashboard

Dokumen ini menjadi pegangan teknis untuk update berikutnya pada web Dashboard.

## Dasar Rujukan

- WCAG 2.2: fokus pada aksesibilitas, kontras, navigasi keyboard, dan status yang dapat dibaca tanpa bergantung warna saja.
- OWASP Web Security Testing Guide dan OWASP Cheat Sheet Series: hindari injeksi HTML/skrip, validasi input, dan jangan memperlakukan token publik sebagai rahasia.
- MDN Web Docs: gunakan DOM API, `addEventListener`, `textContent`, dan semantic HTML untuk UI yang lebih aman dan mudah dirawat.
- web.dev Core Web Vitals: prioritaskan loading stabil, layout tidak bergeser, dan aset ringan.

## Aturan Proyek

1. Jangan gunakan `alert()` untuk feedback aplikasi. Pakai `notify()` agar tidak mengunci browser.
2. Jangan memasukkan data dari user, Spreadsheet, Firebase, atau URL langsung ke `innerHTML` tanpa `escapeHtml()`.
3. Class CSS dinamis harus lewat `safeClassToken()` atau daftar nilai yang dikontrol.
4. Event interaktif memakai `addEventListener` dan `data-*`, bukan inline `onclick`.
5. File di atas 2.000 baris boleh berjalan, tetapi wajib dipantau. Perubahan besar sebaiknya dipisah bertahap agar risiko regresi kecil.
6. `firebase-config.js` berisi konfigurasi publik Firebase. Jangan memasukkan password, private key, atau token rahasia server di file ini.
7. Modul fitur baru mengikuti pola `createXFeature(options)` dan menerima dependency dari `app.js`.
8. Setiap update wajib menjalankan:

```powershell
npm.cmd run check
```

Jika `npm` belum tersedia, minimal jalankan:

```powershell
node --check app.js
```

## Catatan Ukuran File

Saat audit, `app.js`, `styles.css`, dan `index.html` masih besar. Ini masih aman untuk static web selama sintaks valid dan browser mampu merender, tetapi lebih sulit dirawat. Rekomendasi refactor dilakukan bertahap:

- Pisahkan helper umum: format tanggal, escape HTML, notifikasi, export.
- Pisahkan modul data: Firebase, Spreadsheet Bridge, Tender Bridge.
- Pisahkan renderer per halaman: Dashboard, Portfolio, Tender, Personil, Tugas, Pengaturan.
- Setelah modul stabil, baru kecilkan `app.js` utama menjadi router dan pengikat event.

Progress refactor:

- `core/router.js` dan `core/scroll.js` sudah aktif.
- `components/inventory.js`, `components/dashboard.js`, `components/portfolio.js`, `components/finance.js`, `components/reports.js`, `components/personnel.js`, dan `components/tender.js` sudah aktif.
- CSS dan theme sudah dipisah ke folder `styles/`.
- Modul berikutnya sebaiknya memindahkan `settings`, task harian, auth/profile, role, dan helper data bersama secara bertahap.


## Struktur CSS

Gunakan pemisahan bertahap agar file mudah dirawat:

- `styles/base.css`: token CSS awal, reset, loading screen, dan auth screen.
- `styles/layout.css`: shell aplikasi, topbar, main area, nav/profile dasar, dan layout utama.
- `styles/forms.css`: input, select, textarea, tombol dasar, dan state view.
- `styles/sidebar.css`: kontrol visual kecil sidebar yang masih berdiri sendiri.
- `styles/dashboard.css`: dashboard utama, KPI, tabel mini, progress, dan area monitoring dashboard.
- File area tambahan di `styles/`: `tender-list.css`, `tender-detail.css`, `inventory.css`, `tasks.css`, `tables.css`, `portfolio.css`, `personnel.css`, `settings.css`, `recipients.css`, `modals.css`, `responsive.css`, `toasts.css`, `reports.css`, dan `finance.css`.
- File theme modular di `styles/`: `theme-base.css`, `theme-layout.css`, `theme-workspaces.css`, `theme-dashboard.css`, `theme-wide.css`, dan `theme-inventory.css`.
- `styles.css` dan `theme.css` adalah entry import. Jangan menambah rule baru langsung di sana kecuali hanya menambah `@import`.

Prinsipnya: perubahan data dan sinkronisasi tetap di `app.js`; perubahan tampilan cukup di file CSS tema selama tidak membutuhkan markup baru.
