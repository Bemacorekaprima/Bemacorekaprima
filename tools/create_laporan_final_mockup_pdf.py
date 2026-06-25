from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape, portrait
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(r"C:\Users\Otong Supriyadi\Documents\Codex\Dashboard")
OUT_DIR = ROOT / "output" / "pdf"
PDF_PATH = OUT_DIR / "contoh-laporan-final.pdf"
LOGO_PATH = ROOT / "web" / "assets" / "company-logos-transparent.webp"


NAVY = colors.HexColor("#0f172a")
TEXT = colors.HexColor("#172033")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#d9e2ef")
BLUE = colors.HexColor("#2563eb")
BLUE_SOFT = colors.HexColor("#eaf2ff")
RED = colors.HexColor("#dc2626")
RED_SOFT = colors.HexColor("#fff1f2")
GREEN = colors.HexColor("#16a34a")
GREEN_SOFT = colors.HexColor("#ecfdf3")
ORANGE = colors.HexColor("#ea580c")
ORANGE_SOFT = colors.HexColor("#fff7ed")
PANEL = colors.Color(1, 1, 1, alpha=0.92)


def ensure_dirs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)


def draw_round(c, x, y, w, h, fill, stroke=LINE, radius=10, width=1):
    c.saveState()
    c.setLineWidth(width)
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)
    c.restoreState()


def label(c, text, x, y, size=9, color=TEXT, bold=False, align="left"):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def wrapped(c, text, x, y, max_width, size=8.5, color=TEXT, leading=11, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.setFillColor(color)
    words = text.split()
    line = ""
    for word in words:
        probe = f"{line} {word}".strip()
        if c.stringWidth(probe, "Helvetica-Bold" if bold else "Helvetica", size) <= max_width:
            line = probe
        else:
            c.drawString(x, y, line)
            y -= leading
            line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_background(c, w, h):
    c.setFillColor(colors.HexColor("#f5f8fc"))
    c.rect(0, 0, w, h, stroke=0, fill=1)
    c.saveState()
    c.setStrokeColor(colors.Color(0.15, 0.39, 0.92, alpha=0.08))
    c.setLineWidth(0.7)
    for x in range(-120, int(w) + 220, 62):
        c.line(x, 0, x + 260, h)
    for y in range(20, int(h), 64):
        c.line(0, y, w, y + 26)
    c.restoreState()


def draw_logo(c, x, y, w=150, h=36):
    if LOGO_PATH.exists():
        try:
            c.drawImage(ImageReader(str(LOGO_PATH)), x, y, w, h, preserveAspectRatio=True, mask="auto")
            return
        except Exception:
            pass
    draw_round(c, x, y, w, h, colors.white, colors.HexColor("#cbd5e1"), 8)
    label(c, "BEMACO + MITRA", x + w / 2, y + 13, 10, NAVY, True, "center")


def draw_top_nav(c, w, h, active="Laporan"):
    draw_round(c, 22, h - 58, w - 44, 44, colors.white, colors.HexColor("#cbd5e1"), 9)
    draw_logo(c, 34, h - 49, 142, 26)
    items = ["Dashboard", "Tender", "Portofolio", "Personil", "Tugas", "Laporan", "Pengaturan"]
    x = 218
    for item in items:
        tw = 60 if item != "Pengaturan" else 74
        if item == active:
            draw_round(c, x, h - 48, tw, 25, BLUE_SOFT, colors.HexColor("#bfdbfe"), 7)
            label(c, item, x + tw / 2, h - 39, 7.5, BLUE, True, "center")
        else:
            label(c, item, x + tw / 2, h - 39, 7.3, MUTED, False, "center")
        x += tw + 10
    draw_round(c, w - 170, h - 48, 104, 25, colors.HexColor("#f8fafc"), LINE, 7)
    label(c, "Cari data...", w - 158, h - 39, 7.5, MUTED)
    c.setFillColor(colors.HexColor("#7c3aed"))
    c.circle(w - 40, h - 35, 13, stroke=0, fill=1)
    label(c, "OS", w - 40, h - 38, 8, colors.white, True, "center")


def metric_card(c, x, y, w, title, value, color):
    draw_round(c, x, y, w, 58, colors.white, LINE, 9)
    label(c, title, x + 13, y + 37, 8.2, MUTED)
    label(c, str(value), x + 13, y + 15, 18, color, True)


def page_desktop(c):
    w, h = landscape(A4)
    c.setPageSize((w, h))
    draw_background(c, w, h)
    draw_top_nav(c, w, h)

    label(c, "LAPORAN WORKSPACE", 32, h - 91, 8, BLUE, True)
    label(c, "Laporan Operasional Terintegrasi", 32, h - 111, 20, TEXT, True)
    label(c, "Ringkasan tugas, portofolio, tender, personil, dan catatan harian dalam satu tampilan.", 32, h - 127, 8.5, MUTED)

    draw_round(c, w - 190, h - 124, 72, 26, BLUE, BLUE, 8)
    label(c, "Buat Laporan", w - 154, h - 108, 8.5, colors.white, True, "center")
    draw_round(c, w - 108, h - 124, 76, 26, colors.HexColor("#eef4fb"), colors.HexColor("#dbe7f3"), 8)
    label(c, "Pilihan ^", w - 70, h - 108, 8.5, TEXT, True, "center")

    y = h - 205
    card_w = (w - 64 - 36) / 5
    metrics = [
        ("Laporan Hari Ini", "3", BLUE),
        ("Tugas Selesai", "12", GREEN),
        ("Terlambat", "2", RED),
        ("Pekerjaan Aktif", "8", BLUE),
        ("Tender Dipantau", "2", ORANGE),
    ]
    for i, item in enumerate(metrics):
        metric_card(c, 32 + i * (card_w + 9), y, card_w, item[0], item[1], item[2])

    draw_round(c, 32, 152, 252, 195, PANEL, LINE, 10)
    label(c, "Generator Laporan", 48, 325, 12, TEXT, True)
    label(c, "Form dibuat padat, jelas, dan siap dipakai berulang.", 48, 311, 7.8, MUTED)
    fields = [
        ("Jenis laporan", "Harian"),
        ("Periode", "25 Jun 2026"),
        ("Sumber data", "Tugas + Portofolio + Tender"),
        ("Status", "Semua status"),
        ("Format", "PDF, Excel, CSV"),
    ]
    fy = 286
    for name, value in fields:
        label(c, name, 48, fy + 17, 7.2, MUTED, True)
        draw_round(c, 48, fy - 3, 204, 23, colors.white, LINE, 6)
        label(c, value, 58, fy + 5, 8.2, TEXT)
        fy -= 31
    draw_round(c, 48, 170, 204, 27, BLUE, BLUE, 7)
    label(c, "Generate Preview", 150, 180, 8.8, colors.white, True, "center")

    draw_round(c, 300, 118, 326, 229, PANEL, LINE, 10)
    label(c, "Preview Laporan Harian", 318, 325, 12, TEXT, True)
    label(c, "25 Juni 2026 - versi siap ekspor", 318, 311, 7.8, MUTED)
    sections = [
        ("Ringkasan eksekutif", "2 tugas terlambat, 8 pekerjaan aktif, dan 2 paket tender perlu dipantau."),
        ("Fokus prioritas", "DED SPAM PDAM Bogor Barat Timur dan Tengah - Finish Overtime."),
        ("Tender", "Topografi dan Pekerjaan 123 masih tahap persiapan dokumen."),
        ("Personil", "141 personil tersedia. 44 Bemaco, 101 Outsourcing, beberapa aktif lintas pekerjaan."),
        ("Catatan sistem", "Data dibaca dari Firebase dan Spreadsheet Bridge dengan cache terkontrol."),
    ]
    sy = 288
    for title, body in sections:
        c.setFillColor(colors.HexColor("#dbeafe"))
        c.circle(324, sy + 4, 3, stroke=0, fill=1)
        label(c, title, 336, sy + 1, 8.2, TEXT, True)
        wrapped(c, body, 336, sy - 12, 250, 7.5, MUTED, 9)
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.line(318, sy - 25, 606, sy - 25)
        sy -= 42

    draw_round(c, 642, 118, 168, 229, PANEL, LINE, 10)
    label(c, "Panel Aksi", 658, 325, 12, TEXT, True)
    actions = [
        ("Template Cepat", "Harian, Mingguan, Tender, Portofolio"),
        ("Ekspor", "PDF rapi, Excel tabel, CSV data mentah"),
        ("Riwayat", "Versi laporan tersimpan dan dapat dicari"),
        ("Validasi", "Peringatan data kosong atau belum sinkron"),
    ]
    ay = 292
    for title, body in actions:
        draw_round(c, 658, ay - 15, 126, 33, colors.HexColor("#f8fafc"), LINE, 7)
        label(c, title, 668, ay + 2, 8, TEXT, True)
        label(c, body, 668, ay - 10, 6.4, MUTED)
        ay -= 45

    draw_round(c, 32, 58, w - 64, 46, colors.white, LINE, 9)
    label(c, "Prinsip desain", 48, 82, 9, TEXT, True)
    label(c, "Kontras jelas, tombol konsisten, layout responsif, status data eksplisit, dan ekspor tidak bergantung popup browser.", 48, 67, 8, MUTED)
    label(c, "1 / 3", w - 44, 34, 8, MUTED, align="right")
    c.showPage()


def page_mobile(c):
    w, h = portrait(A4)
    c.setPageSize((w, h))
    draw_background(c, w, h)
    label(c, "MOBILE - LAPORAN", 42, h - 46, 8, BLUE, True)
    label(c, "Tampilan Mobile Responsif", 42, h - 69, 20, TEXT, True)
    label(c, "Komponen disusun satu kolom, tombol tidak saling menutup, dan teks tidak menumpuk.", 42, h - 86, 8.5, MUTED)

    phone_x, phone_y, phone_w, phone_h = 142, 68, 312, 690
    draw_round(c, phone_x, phone_y, phone_w, phone_h, colors.HexColor("#0f172a"), colors.HexColor("#cbd5e1"), 26, 1.2)
    draw_round(c, phone_x + 14, phone_y + 14, phone_w - 28, phone_h - 28, colors.HexColor("#f6f9fd"), colors.HexColor("#f6f9fd"), 18)
    draw_round(c, phone_x + 14, phone_y + phone_h - 126, phone_w - 28, 112, NAVY, NAVY, 16)
    draw_logo(c, phone_x + 30, phone_y + phone_h - 75, 138, 28)
    c.setFillColor(colors.HexColor("#7c3aed"))
    c.circle(phone_x + phone_w - 50, phone_y + phone_h - 60, 17, stroke=0, fill=1)
    label(c, "OS", phone_x + phone_w - 50, phone_y + phone_h - 64, 9, colors.white, True, "center")
    navs = [("Dashboard", "[]"), ("Tender", "D"), ("Portofolio", "P"), ("Personil", "U"), ("Laporan", "R")]
    nx = phone_x + 28
    for name, icon in navs:
        active = name == "Laporan"
        if active:
            draw_round(c, nx - 7, phone_y + phone_h - 121, 46, 42, colors.HexColor("#263244"), colors.HexColor("#334155"), 9)
        label(c, name, nx + 16, phone_y + phone_h - 98, 6.2, colors.white if active else colors.HexColor("#cbd5e1"), align="center")
        label(c, icon, nx + 16, phone_y + phone_h - 113, 8, colors.HexColor("#38bdf8") if active else colors.HexColor("#94a3b8"), True, "center")
        nx += 52

    content_top = phone_y + phone_h - 158
    label(c, "Laporan", phone_x + 30, content_top, 20, TEXT, True)
    label(c, "Hari ini: Kamis, 25 Juni 2026", phone_x + 30, content_top - 18, 10, MUTED)
    draw_round(c, phone_x + 30, content_top - 70, phone_w - 60, 34, colors.white, LINE, 9)
    label(c, "Cari laporan atau catatan", phone_x + 43, content_top - 50, 8.5, MUTED)
    draw_round(c, phone_x + 30, content_top - 114, phone_w - 60, 34, colors.HexColor("#eef4fb"), LINE, 9)
    label(c, "Pilihan ^", phone_x + phone_w / 2, content_top - 94, 10, TEXT, True, "center")

    my = content_top - 152
    mobile_cards = [("Hari Ini", "3"), ("Selesai", "12"), ("Terlambat", "2")]
    for title, value in mobile_cards:
        draw_round(c, phone_x + 30, my, phone_w - 60, 50, colors.white, LINE, 9)
        label(c, title, phone_x + 48, my + 30, 8.5, MUTED)
        label(c, value, phone_x + phone_w - 56, my + 17, 16, BLUE if title != "Terlambat" else RED, True, "right")
        my -= 60

    draw_round(c, phone_x + 30, my - 2, phone_w - 60, 154, colors.white, LINE, 10)
    label(c, "Preview Laporan", phone_x + 48, my + 126, 11, TEXT, True)
    wrapped(c, "Ringkasan hari ini menampilkan tugas prioritas, tender, portofolio, personil, dan catatan yang siap diekspor.", phone_x + 48, my + 106, phone_w - 96, 7.7, MUTED, 10)
    for idx, txt in enumerate(["Tugas terlambat: 2", "Tender dipantau: 2", "Pekerjaan aktif: 8"]):
        draw_round(c, phone_x + 48, my + 72 - idx * 28, phone_w - 96, 20, colors.HexColor("#f8fafc"), LINE, 5)
        label(c, txt, phone_x + 58, my + 78 - idx * 28, 7.8, TEXT)

    label(c, "2 / 3", w - 44, 34, 8, MUTED, align="right")
    c.showPage()


def page_standards(c):
    w, h = landscape(A4)
    c.setPageSize((w, h))
    draw_background(c, w, h)
    draw_top_nav(c, w, h)
    label(c, "ACUAN IMPLEMENTASI", 32, h - 91, 8, BLUE, True)
    label(c, "Standar Desain dan Kode untuk Bar Laporan", 32, h - 112, 20, TEXT, True)
    label(c, "Catatan ini menjadi dasar ketika mockup diubah menjadi kode produksi.", 32, h - 130, 8.5, MUTED)

    columns = [
        ("Aksesibilitas", [
            "Kontras teks memenuhi target WCAG.",
            "Label input selalu terlihat, bukan hanya placeholder.",
            "Tombol dan menu dapat dipahami tanpa warna saja.",
            "Ukuran sentuh mobile minimal nyaman digunakan.",
        ], BLUE_SOFT),
        ("Responsif", [
            "Desktop memakai workspace multi-panel.",
            "Tablet berubah menjadi dua kolom.",
            "Mobile berubah menjadi satu kolom tanpa teks menumpuk.",
            "Header dan aksi penting tidak menutup konten.",
        ], GREEN_SOFT),
        ("Kerapian Kode", [
            "Komponen laporan dipisah dari logika data.",
            "Fungsi render kecil, bernama jelas, dan mudah diuji.",
            "State laporan tidak bergantung ke DOM tersebar.",
            "Ekspor memakai data terstruktur, bukan teks layar.",
        ], ORANGE_SOFT),
        ("Keamanan Data", [
            "Role menentukan akses menu dan ekspor.",
            "Token bridge tidak ditulis ulang sembarangan.",
            "Data sensitif tidak ditampilkan di laporan publik.",
            "Validasi data kosong sebelum laporan dibuat.",
        ], RED_SOFT),
    ]
    x = 32
    y = h - 220
    for title, bullets, fill in columns:
        draw_round(c, x, y - 185, 188, 185, fill, LINE, 11)
        label(c, title, x + 15, y - 27, 12, TEXT, True)
        by = y - 55
        for bullet in bullets:
            c.setFillColor(BLUE)
            c.circle(x + 18, by + 3, 2.2, stroke=0, fill=1)
            by = wrapped(c, bullet, x + 28, by + 1, 135, 7.7, TEXT, 12)
            by -= 7
        x += 200

    draw_round(c, 32, 70, w - 64, 58, colors.white, LINE, 10)
    label(c, "Rekomendasi final untuk web", 48, 105, 10, TEXT, True)
    label(c, "Bar Laporan sebaiknya bukan hanya riwayat laporan, tetapi pusat pembuatan, preview, validasi, ekspor, dan arsip laporan operasional.", 48, 88, 8.4, MUTED)
    label(c, "3 / 3", w - 44, 34, 8, MUTED, align="right")


def main():
    ensure_dirs()
    c = canvas.Canvas(str(PDF_PATH))
    page_desktop(c)
    page_mobile(c)
    page_standards(c)
    c.save()
    print(PDF_PATH)


if __name__ == "__main__":
    main()
