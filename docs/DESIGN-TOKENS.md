# Design Tokens

Token visual utama masih berada di `styles.css` dan sebagian override di `theme.css`. Saat CSS dipisah, token ini dipindahkan lebih dulu ke `styles/base.css` atau `styles/tokens.css`.

## Warna

- `--bg`: latar aplikasi.
- `--surface`: permukaan panel/kartu.
- `--surface-soft`: permukaan lembut untuk toolbar, tombol sekunder, dan area table head.
- `--line`: garis batas.
- `--text`: teks utama.
- `--muted`: teks sekunder.
- `--blue`, `--green`, `--red`: warna status utama.

## Efek

- `--shadow`: bayangan standar panel.
- Radius kartu dan tombol saat ini mayoritas `8px`; pertahankan kecuali komponen lama membutuhkan bentuk khusus.

## Aturan Pemakaian

- Jangan menambah warna baru langsung di banyak selector jika bisa memakai token.
- Override di `theme.css` harus dicatat saat CSS mulai dipisah, karena file ini dimuat setelah `styles.css`.
- Komponen baru harus memakai token yang sama agar dashboard, portfolio, inventory, dan finance tetap konsisten.
