#!/usr/bin/env python3
"""Ubah workbook potensi ikat target menjadi web/data.js.

Tiap sheet di workbook adalah satu produk, dan hanya baris yang ADA NAMA
SALESMAN-nya yang diambil.

Tata letak kelima sheet sama persis, jadi cukup satu peta kolom (KOLOM,
0-based: kolom A = 0, B = 1, …). Judul blok omset dan nama bulannya dibaca
langsung dari baris header sheet, bukan ditulis ulang di sini, supaya workbook
bulan berikutnya tidak perlu penyesuaian selama bentuk kolomnya tetap.

Pakai:  python3 web/tools/build_data.py TARGET_SEPTEMBER_TOKO_AI.xlsx
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]

PERIODE = "September 2026"
WEEK_LABELS = ["W35", "W36", "W37", "W38", "W39"]

BARIS_HEADER = 6      # baris judul kolom (1-based)
BARIS_SUBHEADER = 7   # baris nama bulan / TOTAL / AVG
BARIS_AWAL = 8        # baris data pertama

KOLOM = {
    "region": 2,      # RSM
    "wilayah": 3,     # RAYON
    "no": 4,
    "nama": 5,
    "alamat": 6,
    "tipe": 7,        # TYPE OUTLET: SO / GROMIN / GROSIR
    "channel": 8,     # CHANNEL (LBP)
    "sales": 9,
    "ket": 10,        # FIX IKAT TARGET / POTENSI
}

# Tiga blok omset, masing-masing 3 bulan + TOTAL + AVG.
BLOK_OMSET = [11, 16, 21]
KOLOM_ACUAN = [26, 27, 28]
KOLOM_WEEK = [34, 35, 36, 37, 38]

# Galon dijual per galon, bukan per karton, dan targetnya sudah per bulan —
# bukan per minggu seperti produk lain. Kolom 33 pun beda artinya.
SATUAN_GALON = "galon"

SHEETS = {
    "POTENSI TPH": {"label": "TPH"},
    "POTENSI NMAD": {"label": "Nipis Madu"},
    "POTENSI LM 600": {"label": "LM 600"},
    "POTENSI LM 1500+330": {"label": "LM 1500+330"},
    "POTENSI GALON 15L": {"label": "Galon 15L", "galon": True},
}

BULAN = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN",
         "JUL", "AGU", "SEP", "OKT", "NOV", "DES"]


def num(value):
    """Angka atau None. Sel kosong, teks, dan error rumus dianggap kosong."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return round(float(value), 4)


def text(value):
    return str(value).strip() if value is not None else ""


def rapikan(value):
    """Judul di sheet memakai baris baru dan spasi ganda."""
    return re.sub(r"\s+", " ", text(value))


def label_bulan(value):
    """Subheader menulis bulan sebagai angka: '4' -> 'APR'."""
    s = text(value)
    if re.fullmatch(r"\d{1,2}", s) and 1 <= int(s) <= 12:
        return BULAN[int(s) - 1]
    return rapikan(s)


def susun_riwayat(header, subheader, raw, galon):
    """Blok omset + acuan, judul dan nama bulannya ikut yang tertulis di sheet."""
    riwayat = []
    for awal in BLOK_OMSET:
        items = [{"k": label_bulan(subheader[j]), "v": num(raw[j])}
                 for j in range(awal, awal + 5)]
        riwayat.append({"title": rapikan(header[awal]), "items": items})

    riwayat.append({
        "title": rapikan(header[KOLOM_ACUAN[0] - 0]) or "Acuan Target",
        "items": [{"k": rapikan(subheader[j]), "v": num(raw[j])} for j in KOLOM_ACUAN],
    })
    return riwayat


def read_sheet(ws, cfg):
    rows = ws.iter_rows(values_only=True)
    semua = list(rows)
    header = semua[BARIS_HEADER - 1]
    subheader = semua[BARIS_SUBHEADER - 1]
    galon = cfg.get("galon", False)

    # Galon: target sudah per bulan di kolom 29/30. Produk lain: 29/30 target
    # per minggu, 31/32 target sebulan, 33 zona.
    k_tgt, k_tgt_max = (29, 30) if galon else (31, 32)

    hasil = []
    tanpa_sales = 0
    seen = {}

    for nomor, raw in enumerate(semua[BARIS_AWAL - 1:], start=BARIS_AWAL):
        nama = text(raw[KOLOM["nama"]])
        sales = text(raw[KOLOM["sales"]])
        if not nama:
            continue
        if not sales:
            tanpa_sales += 1
            continue

        weeks = [num(raw[i]) for i in KOLOM_WEEK]
        total = sum(w for w in weeks if w)
        tgt = num(raw[k_tgt]) or 0

        outlet_no = num(raw[KOLOM["no"]])
        kunci = (outlet_no, nama)
        if kunci in seen:
            print(f"  ! {ws.title}: '{nama}' muncul dua kali, baris {seen[kunci]} dan {nomor}")
        else:
            seen[kunci] = nomor

        hasil.append({
            "sales": sales,
            "wilayah": text(raw[KOLOM["wilayah"]]),
            "region": text(raw[KOLOM["region"]]),
            "no": int(outlet_no) if outlet_no is not None else 0,
            "nama": nama,
            "alamat": text(raw[KOLOM["alamat"]]),
            "tipe": text(raw[KOLOM["tipe"]]),
            "channel": text(raw[KOLOM["channel"]]),
            "ket": text(raw[KOLOM["ket"]]),
            "zona": "" if galon else text(raw[33]),
            "diskon": num(raw[33]) if galon else None,
            "tgtWeek": None if galon else num(raw[29]),
            "tgt": round(tgt, 2),
            "tgtMax": num(raw[k_tgt_max]),
            "weeks": weeks,
            "total": round(total, 2),
            "history": susun_riwayat(header, subheader, raw, galon),
        })

    return hasil, tanpa_sales


def build(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    products = []
    for ws in wb.worksheets:
        cfg = SHEETS.get(ws.title.strip())
        if cfg is None:
            print(f"  ! sheet '{ws.title}' dilewati (belum ada tata letaknya)")
            continue
        rows, tanpa = read_sheet(ws, cfg)
        products.append({
            "id": ws.title.strip(),
            "label": cfg["label"],
            "satuan": SATUAN_GALON if cfg.get("galon") else "crt",
            "zonaLabel": "Zona",
            "rows": rows,
        })
        catatan = f"  (+{tanpa} tanpa salesman, dilewati)" if tanpa else ""
        print(f"  {cfg['label']:<14} {len(rows):>4} outlet{catatan}")

    return {
        "periode": PERIODE,
        "weekLabels": WEEK_LABELS,
        "labels": {"wilayah": "Rayon"},
        # Berkas unggahan kadang diberi awalan acak; yang perlu dilihat orang
        # cuma nama aslinya.
        "sumber": re.sub(r"^[0-9a-f]{6,}-", "", Path(xlsx_path).name),
        "tanggal": date.today().isoformat(),
        "products": products,
    }


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python3 web/tools/build_data.py <berkas.xlsx>")
    xlsx = Path(sys.argv[1])
    if not xlsx.exists():
        sys.exit(f"File tidak ditemukan: {xlsx}")

    data = build(xlsx)
    out = ROOT / "data.js"
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out.write_text(
        "// Dibuat otomatis oleh tools/build_data.py — jangan diedit manual.\n"
        f"window.MASTER_DATA = {payload};\n",
        encoding="utf-8",
    )
    total = sum(len(p["rows"]) for p in data["products"])
    print(f"-> {out.relative_to(ROOT.parent)} ({total} baris, {out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
