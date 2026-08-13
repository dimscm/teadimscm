#!/usr/bin/env python3
"""Ubah MASTER_AGUSTUS.xlsx menjadi web/data.js.

Tiap sheet di workbook adalah satu produk. Kolomnya beda-beda per produk,
jadi tata letak tiap sheet dijelaskan di SHEETS di bawah: indeks kolom
(0-based) untuk identitas outlet, blok riwayat penjualan, target, dan
realisasi mingguan W31..W34.

Pakai:  python3 web/tools/build_data.py MASTER_AGUSTUS.xlsx
"""

import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]

# Blok riwayat: (judul, [(indeks kolom, label), ...])
QUARTER_LM = [
    ("Q1 TH 2026", [(5, "JAN"), (6, "FEB"), (7, "MAR"), (8, "Total")]),
    ("Q2 TH 2026", [(9, "APR"), (10, "MEI"), (11, "JUN"), (12, "Total")]),
    ("Q3 TH 2025", [(13, "JUL"), (14, "AGU"), (15, "SEP"), (16, "Total")]),
    ("AVG / Week", [(17, "Q1 '26"), (18, "Q2 '26"), (19, "Q3 '25")]),
]

SHEETS = {
    "Pucuk": {
        "label": "Pucuk",
        "first_row": 3,
        "history": [
            ("13 Week Terakhir", [(5, "MEI"), (6, "JUNI"), (7, "JULI"), (8, "Total")]),
            ("Q3 TH 2025", [(9, "JUL"), (10, "AGU"), (11, "SEP"), (12, "Total")]),
            ("Q2 TH 2026", [(13, "APR"), (14, "MEI"), (15, "JUNI"), (16, "Total")]),
            ("AVG / Week", [(17, "13W"), (18, "Q3 '25"), (19, "Q1 '26")]),
        ],
        "pilihan": 20,
        "zona": 21,
        "zona_label": "Paket",
        "up": 22,
        "tgt_week": 23,
        "tgt": 24,
        "weeks": [25, 26, 27, 28],
        "ebs": 34,  # persen target EBS (0.7)
    },
    "LM 600": {
        "label": "LM 600",
        "first_row": 4,
        "history": QUARTER_LM,
        "pilihan": 20,
        "zona": 21,
        "zona_label": "Zona",
        "up": 22,
        "tgt_week": 23,
        "tgt": 24,
        "weeks": [26, 27, 28, 29],
    },
    "LM 1500+330": {
        "label": "LM 1500+330",
        "first_row": 4,
        "history": QUARTER_LM,
        "pilihan": 20,
        "zona": 21,
        "zona_label": "Zona",
        "up": 22,
        "tgt_week": 23,
        "tgt": 24,
        "weeks": [26, 27, 28, 29],
    },
    "NIPIS": {
        "label": "Nipis",
        "first_row": 2,
        "history": [
            ("AVG 13 Week TH 2026", [(5, "MEI"), (6, "JUNI"), (7, "JULI"), (8, "Total")]),
            ("Q1 TH 2026", [(9, "JAN"), (10, "FEB"), (11, "MAR"), (12, "Total")]),
            ("Q3 TH 2025", [(13, "OCT"), (14, "NOV"), (15, "DES"), (16, "Total")]),
            ("AVG / Week", [(17, "13W"), (18, "Q1 '26"), (19, "Q3 '25")]),
        ],
        "pilihan": 20,
        "up": 22,
        "tgt": 23,
        "weeks": [24, 25, 26, 27],
    },
}

WEEK_LABELS = ["W31", "W32", "W33", "W34"]


def num(value):
    """Angka atau None. Sel kosong, teks, dan error rumus dianggap kosong."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return round(float(value), 4)


def text(value):
    return str(value).strip() if value is not None else ""


def read_sheet(ws, cfg):
    rows = []
    for raw in ws.iter_rows(min_row=cfg["first_row"], values_only=True):
        outlet_no = num(raw[2])
        name = text(raw[3])
        if outlet_no is None or not name:
            continue  # baris kosong / pemisah

        weeks = [num(raw[i]) for i in cfg["weeks"]]
        total = sum(w for w in weeks if w)
        tgt = num(raw[cfg["tgt"]]) or 0

        history = [
            {
                "title": title,
                "items": [{"k": label, "v": num(raw[i])} for i, label in cols],
            }
            for title, cols in cfg["history"]
        ]

        rows.append(
            {
                "sales": text(raw[0]),
                "rayon": text(raw[1]),
                "no": int(outlet_no),
                "nama": name,
                "alamat": text(raw[4]),
                "zona": text(raw[cfg["zona"]]) if cfg.get("zona") else "",
                "up": num(raw[cfg["up"]]) if cfg.get("up") else None,
                "tgtWeek": num(raw[cfg["tgt_week"]]) if cfg.get("tgt_week") else None,
                "tgt": round(tgt, 2),
                "weeks": weeks,
                "total": round(total, 2),
                "ebs": num(raw[cfg["ebs"]]) if cfg.get("ebs") else None,
                "history": history,
            }
        )
    return rows


def build(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    products = []
    for ws in wb.worksheets:
        key = ws.title.strip()
        cfg = SHEETS.get(key)
        if cfg is None:
            print(f"  ! sheet '{ws.title}' dilewati (belum ada tata letaknya)")
            continue
        rows = read_sheet(ws, cfg)
        products.append(
            {
                "id": key,
                "label": cfg["label"],
                "zonaLabel": cfg.get("zona_label", ""),
                "weekLabels": WEEK_LABELS,
                "rows": rows,
            }
        )
        print(f"  {cfg['label']:<14} {len(rows):>4} outlet")
    return {"weekLabels": WEEK_LABELS, "products": products}


def main():
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "MASTER_AGUSTUS.xlsx"
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
