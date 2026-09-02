#!/usr/bin/env python3
"""Ubah workbook target bulanan menjadi web/data.js.

Tiap sheet di workbook adalah satu produk, dan hanya baris yang ADA NAMA
SALESMAN-nya yang diambil — sisanya outlet subdist lain yang ikut tercetak di
laporan yang sama.

Tata letak tiap sheet dijelaskan di SHEETS di bawah memakai indeks kolom
0-based (kolom A = 0, B = 1, dan seterusnya). Kalau bulan depan formatnya
bergeser, yang perlu diubah cuma tabel itu.

Pakai:  python3 web/tools/build_data.py target_september.xlsx
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

# Kolom identitas sama di semua sheet.
KOLOM_ID = {
    "region": 2,
    "wilayah": 3,   # RSM/AREA di sheet TPH, SUBDIST di sheet lain
    "no": 4,
    "nama": 5,
    "sales": 6,
    "alamat": 7,
    "tipe": 8,
}

# Blok riwayat: (judul, [(indeks kolom, label), ...])
RIWAYAT_TPH = [
    ("Omset Q2.2026", [(9, "APR"), (10, "MEI"), (11, "JUN"), (12, "Total"), (13, "Avg/wk")]),
    ("Omset Q3.2025", [(14, "JUL"), (15, "AGU"), (16, "SEP"), (17, "Total"), (18, "Avg/wk")]),
    ("Omset 13 Week Terakhir", [(19, "JUN"), (20, "JUL"), (21, "AGU"), (22, "Total"), (23, "Avg/wk")]),
    ("Acuan Target", [(24, "Avg/wk Q2.2026"), (25, "Acuan 1"), (26, "Avg/wk Q3.2025"),
                      (27, "Acuan 2"), (28, "Avg/wk 13W"), (29, "Acuan 3")]),
]

ACUAN_3BLN = [
    (24, "Avg/wk acuan 1"), (25, "Acuan 1 (1 bln)"),
    (27, "Avg/wk acuan 2"), (28, "Acuan 2 (1 bln)"),
    (30, "Avg/wk acuan 3"), (31, "Acuan 3 (1 bln)"),
]

RIWAYAT_LM = [
    ("Omset Q1.2026", [(9, "JAN"), (10, "FEB"), (11, "MAR"), (12, "Total"), (13, "Avg/wk")]),
    ("Omset Q2.2026", [(14, "APR"), (15, "MEI"), (16, "JUN"), (17, "Total"), (18, "Avg/wk")]),
    ("Omset Q3.2025", [(19, "JUL"), (20, "AGU"), (21, "SEP"), (22, "Total"), (23, "Avg/wk")]),
    ("Acuan Target", ACUAN_3BLN),
]

SHEETS = {
    "SO TPH SEP": {
        "label": "TPH SO",
        "baris_awal": 8,
        "riwayat": RIWAYAT_TPH,
        "spk": 30, "tgt_week": 31, "tgt": 32, "zona": 33,
        "weeks": [34, 35, 36, 37, 38],
    },
    "GROMIN TPH SEP": {
        "label": "TPH Gromin",
        "baris_awal": 8,
        "riwayat": RIWAYAT_TPH,
        "spk": 30, "tgt_week": 31, "tgt": 32, "zona": 33,
        "weeks": [34, 35, 36, 37, 38],
    },
    "NMAD SEP - NOV": {
        "label": "Nipis Madu",
        "baris_awal": 6,
        "riwayat": [
            ("Omset Q1.2026", [(9, "JAN"), (10, "FEB"), (11, "MAR"), (12, "Total"), (13, "Avg/wk")]),
            ("Omset 13 Week Terakhir", [(14, "JUN"), (15, "JUL"), (16, "AGU"), (17, "Total"), (18, "Avg/wk")]),
            ("Omset Q3.2025", [(19, "JUL"), (20, "AGU"), (21, "SEP"), (22, "Total"), (23, "Avg/wk")]),
            ("Acuan Target", ACUAN_3BLN),
        ],
        "spk": 33, "tgt_week": 34, "tgt": 35, "zona": 36,
        "weeks": [37, 38, 39, 40, 41],
    },
    "LM 600 JAKTIM": {
        "label": "LM 600",
        "baris_awal": 8,
        "riwayat": RIWAYAT_LM,
        "spk": 33, "tgt_week": 66, "tgt": 67, "zona": 68,
        "weeks": [69, 70, 71, 72, 73],
    },
    "LM 1500+330 JAKTIM": {
        "label": "LM 1500+330",
        "baris_awal": 8,
        "riwayat": RIWAYAT_LM,
        "spk": 33, "tgt_week": 80, "tgt": 81, "zona": 82,
        # Realisasinya dipecah dua ukuran; yang dipakai target adalah jumlahnya.
        "weeks": [83, 84, 85, 86, 87],
        "weeks_kedua": [89, 90, 91, 92, 93],
        "rincian": [("Omset LM 1500ML", [83, 84, 85, 86, 87]),
                    ("Omset LM 330ML", [89, 90, 91, 92, 93])],
    },
}


def num(value):
    """Angka atau None. Sel kosong, teks, dan error rumus dianggap kosong."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return round(float(value), 4)


def text(value):
    return str(value).strip() if value is not None else ""


def read_sheet(ws, cfg):
    rows = []
    dilewati = 0
    seen = {}

    for nomor, raw in enumerate(ws.iter_rows(min_row=cfg["baris_awal"], values_only=True),
                                start=cfg["baris_awal"]):
        nama = text(raw[KOLOM_ID["nama"]])
        sales = text(raw[KOLOM_ID["sales"]])
        if not nama:
            continue
        if not sales:
            dilewati += 1  # outlet subdist lain, tidak dipegang salesman kita
            continue

        weeks = [num(raw[i]) for i in cfg["weeks"]]
        if cfg.get("weeks_kedua"):
            kedua = [num(raw[i]) for i in cfg["weeks_kedua"]]
            weeks = [None if a is None and b is None else (a or 0) + (b or 0)
                     for a, b in zip(weeks, kedua)]

        total = sum(w for w in weeks if w)
        tgt = num(raw[cfg["tgt"]]) or 0

        riwayat = [
            {"title": judul, "items": [{"k": label, "v": num(raw[i])} for i, label in kolom]}
            for judul, kolom in cfg["riwayat"]
        ]
        for judul, kolom in cfg.get("rincian", []):
            riwayat.append({
                "title": judul,
                "items": [{"k": WEEK_LABELS[i], "v": num(raw[j])} for i, j in enumerate(kolom)],
            })

        outlet_no = num(raw[KOLOM_ID["no"]])
        kunci = (outlet_no, nama)
        if kunci in seen:
            print(f"  ! {ws.title}: '{nama}' muncul dua kali, baris {seen[kunci]} dan {nomor}")
        else:
            seen[kunci] = nomor

        # Sebagian sheet menulis subdist sebagai "CNS JUP", sebagian
        # "CNS JUP - JAKTIM". Region sudah jadi kolom sendiri, jadi akhiran itu
        # dibuang supaya satu subdist tidak terpecah dua di filter.
        region = text(raw[KOLOM_ID["region"]])
        wilayah = text(raw[KOLOM_ID["wilayah"]])
        if region and wilayah.upper().endswith(" - " + region.upper()):
            wilayah = wilayah[: -(len(region) + 3)].strip()

        rows.append({
            "sales": sales,
            "wilayah": wilayah,
            "region": region,
            "no": int(outlet_no) if outlet_no is not None else 0,
            "nama": nama,
            "alamat": text(raw[KOLOM_ID["alamat"]]),
            "tipe": text(raw[KOLOM_ID["tipe"]]),
            "zona": text(raw[cfg["zona"]]),
            "spk": text(raw[cfg["spk"]]),
            "tgtWeek": num(raw[cfg["tgt_week"]]),
            "tgt": round(tgt, 2),
            "weeks": weeks,
            "total": round(total, 2),
            "history": riwayat,
        })

    return rows, dilewati


def build(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    products = []
    for ws in wb.worksheets:
        cfg = SHEETS.get(ws.title.strip())
        if cfg is None:
            print(f"  ! sheet '{ws.title}' dilewati (belum ada tata letaknya)")
            continue
        rows, dilewati = read_sheet(ws, cfg)
        products.append({
            "id": ws.title.strip(),
            "label": cfg["label"],
            "zonaLabel": "Zona",
            "rows": rows,
        })
        print(f"  {cfg['label']:<14} {len(rows):>4} outlet  (+{dilewati} tanpa salesman, dilewati)")

    return {
        "periode": PERIODE,
        "weekLabels": WEEK_LABELS,
        "labels": {"wilayah": "Subdist"},
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
