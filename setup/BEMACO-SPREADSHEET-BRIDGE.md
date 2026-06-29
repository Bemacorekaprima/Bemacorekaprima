# Bemaco Spreadsheet Bridge Baru

Bridge ini mengganti bridge lama dan diarahkan ke spreadsheet baru:

https://docs.google.com/spreadsheets/d/1H5eAR4_Q3Du0C1zPxxI_ZoBm-gQibMsks_DxUdSUfjA/edit?usp=sharing

## File Apps Script

Copy seluruh isi file ini ke Apps Script:

`	ext
setup/bemaco-spreadsheet-bridge-Code.gs.txt
`

## Cara pasang

1. Buka https://script.google.com atau buka spreadsheet baru lalu pilih Ekstensi > Apps Script.
2. Buat project baru, hapus isi Code.gs, lalu paste isi emaco-spreadsheet-bridge-Code.gs.txt.
3. Klik Simpan.
4. Klik Terapkan > Deployment baru > Aplikasi web.
5. Jalankan sebagai: Saya.
6. Yang memiliki akses: Siapa saja.
7. Klik Terapkan dan setujui izin Google.
8. Copy URL yang berakhiran /exec.
9. Paste URL tersebut ke irebase-config.js:

`js
window.PERSONNEL_BRIDGE_URL = "URL_APPS_SCRIPT_BARU_YANG_BERAKHIR_EXEC";
window.PERSONNEL_BRIDGE_TOKEN = "Bemaco-20260630-spreadsheet-bridge";
`

## Sheet yang dibaca

Bridge mencari tab dengan GID lama terlebih dahulu, lalu fallback ke nama tab:

- DATA UTAMA
- PERSONIL BMC
- Outsourcing

Jika tab pada spreadsheet baru punya nama berbeda, ubah daftar 
ames pada PERSONNEL_SHEETS di Code.gs.

## Catatan

Email Bridge lama sudah dinonaktifkan dari konfigurasi web. Tombol email akan kembali memakai mailto sampai dibuat bridge email baru khusus pengiriman reminder.

## Update sinkronisasi dua arah

Versi bridge ini membaca dan menulis tab DATA UTAMA, PERSONIL BMC, Outsourcing, BAR Tender, dan Finance. Setelah file emaco-spreadsheet-bridge-Code.gs.txt diperbarui, salin seluruh isi file tersebut ke Apps Script yang sudah ter-deploy, lalu Deploy > Manage deployments > Edit > New version agar web dapat menulis data Finance/BAR Tender ke spreadsheet.
