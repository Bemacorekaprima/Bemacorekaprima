# Panduan Personnel Bridge

Personnel Bridge menghubungkan web dengan tiga sheet sumber:

- DATA UTAMA, GID `2034016714`
- PERSONIL BMC, GID `2048149704`
- Outsourcing, GID `1030462578`

Bridge membaca ketiga sheet secara langsung. Ini memperbaiki DATA UTAMA yang tidak dapat dibaca melalui URL CSV. Bridge juga menerima tambah, edit, dan hapus dari web untuk role **Super Admin**, **Editor**, dan **Author**.

## 1. Buat Apps Script dari spreadsheet

1. Buka Google Spreadsheet yang berisi ketiga sheet tersebut.
2. Pilih **Ekstensi > Apps Script**.
3. Hapus isi awal `Code.gs`.
4. Buka file `setup/personnel-bridge-Code.gs.txt` dari paket web.
5. Salin seluruh kodenya ke `Code.gs`.
6. Klik **Simpan**.

Apps Script harus dibuat dari spreadsheet sumber. Jangan membuat project Apps Script kosong dari halaman utama Apps Script karena `SpreadsheetApp.getActiveSpreadsheet()` memerlukan project yang terikat ke spreadsheet.

## 2. Deploy sebagai Web App

1. Klik **Terapkan > Deployment baru**.
2. Klik ikon roda gigi, lalu pilih **Aplikasi web**.
3. Isi:
   - Deskripsi: `Personnel Bridge`
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
4. Klik **Terapkan**.
5. Setujui permintaan izin Google.
6. Salin URL yang berakhiran `/exec`.

## 3. Hubungkan URL ke web

Buka `firebase-config.js`, lalu isi:

```js
window.PERSONNEL_BRIDGE_URL = "URL_APPS_SCRIPT_YANG_BERAKHIR_EXEC";
window.PERSONNEL_BRIDGE_TOKEN = "Ospr630-personnel-bridge";
```

Token pada `firebase-config.js` harus sama dengan:

```js
const PERSONNEL_BRIDGE_TOKEN = 'Ospr630-personnel-bridge';
```

di `Code.gs`.

## 4. Upload pembaruan

Dari PowerShell pada folder `asisten-harian-web-gratis`, jalankan:

```powershell
.\deploy-github.ps1 "Aktifkan Personnel Bridge"
```

Tunggu GitHub Pages sekitar 1-3 menit, lalu buka URL baru yang ditampilkan oleh script.

## 5. Tes

1. Login menggunakan `o.supriyadi630@gmail.com`.
2. Buka **Personil**.
3. Pastikan DATA UTAMA berstatus terbaca pada menu Pengaturan.
4. Klik **Tambah Personil**, isi data, lalu simpan.
5. Periksa baris baru pada Google Spreadsheet.
6. Coba tombol **Edit** dan **Hapus**.

## Memperbarui Apps Script

Jika `Code.gs` diubah:

1. Klik **Terapkan > Kelola deployment**.
2. Klik ikon pensil.
3. Pada Versi, pilih **Versi baru**.
4. Klik **Terapkan**.

URL `/exec` tetap sama.

## Keamanan

Bridge memeriksa Firebase ID token pengguna dan membaca role pengguna dari Firestore. Penulisan hanya diterima untuk:

- `super_admin`
- `editor`
- `author`

Role lain tetap dapat membaca data sesuai akses web, tetapi tidak dapat menulis ke Spreadsheet.
