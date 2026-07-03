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
- `components/inventory.js`, `components/dashboard.js`, dan `components/portfolio.js` sudah aktif.
- Modul berikutnya sebaiknya dipilih satu per tahap agar dependency data tetap mudah dicek.


## Struktur CSS

Gunakan pemisahan bertahap agar file mudah dirawat:

- `styles.css`: base style, layout dasar, komponen lama yang masih menjadi fondasi aplikasi.
- `theme.css`: tema visual, warna, gradasi, polish dashboard, dan override lintas halaman. File ini diload setelah `styles.css`, sehingga perubahan tema tidak perlu mengubah base style.
- Jika nanti bertambah besar, pecah lagi berdasarkan domain: `base.css`, `layout.css`, `components.css`, `pages/dashboard.css`, dan `pages/finance.css`.

Prinsipnya: perubahan data dan sinkronisasi tetap di `app.js`; perubahan tampilan cukup di file CSS tema selama tidak membutuhkan markup baru.
