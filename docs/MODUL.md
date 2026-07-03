# Modul Aplikasi

Dokumen ini mencatat struktur modul aktif agar perubahan berikutnya tidak perlu membaca seluruh `app.js`.

## Struktur Saat Ini

- `app.js`: bootstrap aplikasi, Firebase/Auth, data lintas fitur, adapter modul, render utama, dan fitur yang belum dipisah.
- `core/router.js`: perpindahan view dan kebijakan scroll per navigasi.
- `core/scroll.js`: helper scroll `preserve`, `top`, dan `none`.
- `components/inventory.js`: UI dan logic Inventaris Kantor.
- `components/dashboard.js`: KPI dashboard, paket prioritas, tender aktif, personil, posisi penugasan, inventaris dashboard, dan progress.
- `components/portfolio.js`: UI Portfolio, ringkasan, kartu pekerjaan, aktivitas, agenda, tabel pekerjaan, mobile cards, pagination, dan klik detail.
- `styles/`: pecahan CSS awal untuk base, layout, form, sidebar, dan dashboard.
- `styles.css`: entry CSS utama plus legacy style yang belum dipisah.

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

## Modul Yang Belum Dipisah

- `components/tender.js`
- `components/personnel.js`
- `components/finance.js`
- `components/reports.js`
- `components/settings.js`
- modul auth/role/backend bridge

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
