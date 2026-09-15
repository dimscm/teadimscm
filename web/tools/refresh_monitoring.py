#!/usr/bin/env python3
"""Segarkan angka di web/data.js dari form monitoring mingguan.

File target bulanan menentukan daftar outlet sekali sebulan; form monitoring
datang jauh lebih sering dan membawa omset terbaru serta target SPK. Skrip ini
memperbarui angka outlet yang ada di form monitoring, menghitung ulang
cashback semua baris (supaya perubahan tabel strata ikut terpakai), lalu
menulis ulang data.js — tanpa perlu file target bulanannya lagi.

Outlet yang belum punya SPK tidak ada di form monitoring; angkanya dibiarkan
apa adanya dan ditandai spk = false.

Pakai:  python3 web/tools/refresh_monitoring.py MONITORING_...xlsx [--periode "Oktober 2026"]
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cashback  # noqa: E402
from build_data import baca_monitoring  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data.js"

# Label produk di data.js -> nama program di cashback.py
PROGRAM = {
    "TPH": "TPH",
    "Nipis Madu": "NMAD",
    "LM 600": "LM600",
    "LM 1500+330": "LM1500",
    "Galon 15L": "GALON",
}


def baca_data_js():
    isi = DATA.read_text(encoding="utf-8")
    cocok = re.search(r"window\.MASTER_DATA = (.*);\s*$", isi, re.S)
    if not cocok:
        sys.exit(f"Tidak menemukan MASTER_DATA di {DATA}")
    return json.loads(cocok.group(1))


def tulis_data_js(data):
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    DATA.write_text(
        "// Dibuat otomatis oleh tools/build_data.py — jangan diedit manual.\n"
        f"window.MASTER_DATA = {payload};\n",
        encoding="utf-8",
    )


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python3 web/tools/refresh_monitoring.py <form monitoring .xlsx>")
    path = Path(sys.argv[1])
    if not path.exists():
        sys.exit(f"File tidak ditemukan: {path}")

    data = baca_data_js()
    monitoring = baca_monitoring(path)

    for produk in data["products"]:
        program = PROGRAM.get(produk["label"])
        if program is None:
            print(f"  ! produk '{produk['label']}' belum dipetakan ke program cashback")
            continue

        disegarkan = berubah = 0
        for r in produk["rows"]:
            segar = monitoring.get((program, r["no"]))
            if segar:
                disegarkan += 1
                if segar["total"] != r["total"] or (segar["tgt"] and segar["tgt"] != r["tgt"]):
                    berubah += 1
                r["tgt"] = segar["tgt"] or r["tgt"]
                r["weeks"] = segar["weeks"]
                r["total"] = segar["total"]
                r["spk"] = True
            else:
                r["spk"] = False
            r["cb"] = cashback.hitung(program, r["tipe"], r["tgt"], r["total"])

        print(f"  {produk['label']:14} {len(produk['rows']):3} outlet | "
              f"{disegarkan:3} ada di monitoring ({berubah} angkanya berubah)")

    data["tanggal"] = date.today().isoformat()
    data["sumber"] = re.sub(r"^[0-9a-f]{6,}-", "", path.name)
    tulis_data_js(data)

    total = sum(len(p["rows"]) for p in data["products"])
    sisa = sum(r["cb"]["sisa"] for p in data["products"] for r in p["rows"])
    print(f"-> web/data.js ({total} baris, sisa cashback Rp {sisa:,.0f})")


if __name__ == "__main__":
    main()
