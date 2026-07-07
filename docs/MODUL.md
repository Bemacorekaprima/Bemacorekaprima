# Modul Aplikasi

Dokumen ini mencatat struktur modul aktif agar perubahan berikutnya tidak perlu membaca seluruh `app.js`.

## Struktur Saat Ini

- `app.js`: bootstrap aplikasi, Firebase/Auth, data lintas fitur, adapter modul, render utama, dan fitur yang belum dipisah.
- `core/router.js`: perpindahan view dan kebijakan scroll per navigasi.
- `core/scroll.js`: helper scroll `preserve`, `top`, dan `none`.
- `components/inventory.js`: UI dan logic Inventaris Kantor.
- `components/dashboard.js`: KPI dashboard, paket prioritas, tender aktif, personil, posisi penugasan, inventaris dashboard, dan progress.
- `components/portfolio.js`: UI Portfolio, ringkasan, kartu pekerjaan, aktivitas, agenda, tabel pekerjaan, mobile cards, pagination, dan klik detail.
- `components/finance.js`: UI Finance, ringkasan kontrak, termin, addendum, form record, dan aksi detail.
- `components/reports.js`: workspace laporan, filter, preview, export Excel/PDF, print, dan template cepat.
- `components/personnel.js`: UI Personil, filter, pagination, detail histori, form, mutasi spreadsheet, dan export.
- `components/tender.js`: UI Tender, filter, detail, form paket, checklist dokumen, template tender, dan sinkronisasi sheet tender.
- `styles/`: pecahan CSS per area, termasuk base, layout, dashboard, tender, inventory, portfolio, personnel, reports, finance, modal, responsive, dan theme.
- `styles.css`: entry CSS utama yang hanya mengimpor file area.
- `theme.css`: entry theme yang hanya mengimpor file theme modular.

## Pola Komponen

Setiap modul fitur memakai pola:

```js
export function createFeatureName(options = {}) {
  const { state, dependencyA, dependencyB } = options;

  function bindControls() {}
  function render() {}

  return { bindControls, render };
}
```

Aturan:

- Modul menerima dependency dari `app.js`, tidak mengambil data global diam-diam selain DOM dan `window.lucide`.
- Helper data lintas fitur tetap di `app.js` sampai modul tujuan dipisah penuh.
- `app.js` menyediakan wrapper pendek agar pemanggil lama tetap stabil.
- Event handler fitur ditempatkan di modul fiturnya melalui `bindControls()`.
- Semua tombol non-submit harus memakai `type="button"`.
- CSS baru ditempatkan di file area yang sesuai di folder `styles/`; gunakan `styles.css` hanya untuk legacy style yang belum aman dipindah.

## Modul Yang Belum Dipisah Penuh

- `components/settings.js`
- modul task harian
- modul auth/profile/role/backend bridge
- helper data lintas fitur yang masih dipakai bersama

## Catatan Akses

Kontrol menu di UI hanya membantu pengalaman pengguna. Hak penting tetap harus diamankan di Firestore Rules atau backend/Apps Script Bridge.

## Validasi

Gunakan:

```powershell
npm.cmd run check
```

Jika `npm.cmd` tidak ada di PATH terminal, gunakan Node yang tersedia lalu jalankan `tools/quality-check.ps1`, atau minimal:

```powershell
node --check app.js
```
