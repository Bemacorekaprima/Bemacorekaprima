# BEMACO Apps Script Bridge

Bridge ini menjadi satu pintu sinkronisasi web dengan Google Spreadsheet:

https://docs.google.com/spreadsheets/d/1H5eAR4_Q3Du0C1zPxxI_ZoBm-gQibMsks_DxUdSUfjA/edit?usp=sharing

Web tidak lagi membaca data melalui link CSV publik. Semua baca, tambah, edit, hapus, upsert, dan pembuatan sheet/header dilakukan melalui Apps Script.

## File Apps Script

Salin seluruh isi file ini ke Apps Script:

```text
setup/bemaco-spreadsheet-bridge-Code.gs.txt
```

## Cara pasang

1. Buka spreadsheet BEMACO.
2. Pilih `Ekstensi > Apps Script`.
3. Hapus isi `Code.gs`.
4. Paste isi `setup/bemaco-spreadsheet-bridge-Code.gs.txt`.
5. Klik `Simpan`.
6. Klik `Terapkan > Deployment baru > Aplikasi web`.
7. Jalankan sebagai: `Saya`.
8. Yang memiliki akses: `Siapa saja`.
9. Klik `Terapkan` dan setujui izin Google.
10. Copy URL yang berakhiran `/exec`.
11. Pastikan `firebase-config.js` berisi URL dan token berikut:

```js
window.PERSONNEL_BRIDGE_URL = "URL_APPS_SCRIPT_BARU_YANG_BERAKHIR_EXEC";
window.PERSONNEL_BRIDGE_TOKEN = "Bemaco-20260630-spreadsheet-bridge";
```

## Sheet yang dikelola otomatis

Apps Script akan mencari tab berdasarkan GID/nama. Jika tab belum ada, script akan membuat sheet dan header otomatis.

- `DATA UTAMA`
- `PERSONIL BMC`
- `Outsourcing`
- `BAR Tender`
- `Finance`
- `FINANCE_TERMIN`
- `FINANCE_ADDENDUM`
- `INVENTARIS`

## Aksi yang didukung

- `read`: membaca semua sheet untuk web.
- `ensureSheet`: membuat sheet/header jika belum tersedia.
- `add`: menambah baris baru.
- `update`: mengubah baris berdasarkan `_Sumber Baris`.
- `upsert`: update jika data ditemukan, tambah jika belum ada.
- `delete`: hapus baris berdasarkan `_Sumber Baris`.
- `deleteByKey`: hapus berdasarkan kolom kunci.

## Catatan teknis

- Google Drive tetap disimpan dari halaman Pengaturan web untuk folder dokumen.
- Sheet/header spreadsheet tidak perlu diisi manual untuk fitur baru yang sudah terdaftar di bridge.
- Setelah mengubah Apps Script, gunakan `Deploy > Manage deployments > Edit > New version` agar web memakai versi terbaru.
