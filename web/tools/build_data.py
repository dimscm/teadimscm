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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cashback  # noqa: E402

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

# Selain sheet produk, workbook bisa memuat satu sheet daftar outlet berisi
# koordinat. Sheet itu dikenali dari judul kolomnya, bukan dari namanya.
KOLOM_KOORDINAT = {"kode": ("kodeoutlet", "kode outlet"),
                   "lat": ("latitude",),
                   "lng": ("langitude", "longitude", "longitud")}

SHEETS = {
    "POTENSI TPH": {"label": "TPH", "program": "TPH"},
    "POTENSI NMAD": {"label": "Nipis Madu", "program": "NMAD"},
    "POTENSI LM 600": {"label": "LM 600", "program": "LM600"},
    "POTENSI LM 1500+330": {"label": "LM 1500+330", "program": "LM1500"},
    "POTENSI GALON 15L": {"label": "Galon 15L", "galon": True, "program": "GALON"},
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


def baca_koordinat(wb):
    """Cari sheet daftar outlet, kembalikan {kode outlet: [lat, lng]}."""
    for ws in wb.worksheets:
        baris = list(ws.iter_rows(max_row=1, values_only=True))
        if not baris:
            continue
        judul = [text(v).lower() for v in baris[0]]
        pos = {}
        for kunci, kandidat in KOLOM_KOORDINAT.items():
            for i, j in enumerate(judul):
                if j in kandidat:
                    pos[kunci] = i
                    break
        if len(pos) < 3:
            continue

        peta = {}
        for raw in list(ws.iter_rows(values_only=True))[1:]:
            kode = num(raw[pos["kode"]])
            lat = num(raw[pos["lat"]])
            lng = num(raw[pos["lng"]])
            # 0,0 berarti outletnya belum dipetakan, bukan lokasi sungguhan.
            if kode is None or not lat or not lng:
                continue
            peta[int(kode)] = [lat, lng]
        print(f"  koordinat dari sheet '{ws.title}': {len(peta)} outlet")
        return peta, ws.title
    return {}, None


def build(xlsx_path, mix_path=None):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    koordinat, sheet_koordinat = baca_koordinat(wb)
    mix = baca_mix_lm1500(mix_path) if mix_path else {}
    products = []
    for ws in wb.worksheets:
        cfg = SHEETS.get(ws.title.strip())
        if cfg is None:
            if ws.title != sheet_koordinat:
                print(f"  ! sheet '{ws.title}' dilewati (belum ada tata letaknya)")
            continue
        rows, tanpa = read_sheet(ws, cfg)
        for r in rows:
            titik = koordinat.get(r["no"])
            if titik:
                r["lat"], r["lng"] = titik
            r["cb"] = cashback.hitung(cfg["program"], r["tipe"], r["tgt"], r["total"],
                                      share1500=mix.get(r["no"]))
        products.append({
            "id": ws.title.strip(),
            "label": cfg["label"],
            "satuan": SATUAN_GALON if cfg.get("galon") else "crt",
            "zonaLabel": "Zona",
            "rows": rows,
        })
        catatan = f"  (+{tanpa} tanpa salesman, dilewati)" if tanpa else ""
        berkoordinat = sum(1 for r in rows if r.get("lat"))
        if koordinat and berkoordinat < len(rows):
            catatan += f"  [{len(rows) - berkoordinat} tanpa koordinat]"
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


def baca_mix_lm1500(path):
    """Bagian omset LM 1500ML terhadap total 1500+330 per outlet, dari form
    monitoring bulan lalu.

    Tarif cashback LM 1500ML dan 330ML berbeda, sedangkan file target hanya
    memuat jumlah keduanya. Komposisi tiap outlet diambil dari bulan terakhir
    yang datanya lengkap; outlet tanpa riwayat memakai rata-rata semua outlet.
    """
    import xlrd

    s = xlrd.open_workbook(path).sheet_by_name("MONITORING LM Q3.2026")
    mix = {}
    jum15 = jum33 = 0
    for i in range(7, s.nrows):
        kode = s.cell_value(i, 4)
        if not isinstance(kode, (int, float)):
            continue
        v15 = s.cell_value(i, 63)
        v33 = s.cell_value(i, 68)
        v15 = v15 if isinstance(v15, (int, float)) else 0
        v33 = v33 if isinstance(v33, (int, float)) else 0
        if v15 + v33 <= 0:
            continue
        mix[int(kode)] = v15 / (v15 + v33)
        jum15 += v15
        jum33 += v33

    if jum15 + jum33:
        rata = jum15 / (jum15 + jum33)
        print(f"  campuran LM 1500ML: {len(mix)} outlet berriwayat, "
              f"rata-rata {rata * 100:.0f}% ukuran 1500ML")
    return mix


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python3 web/tools/build_data.py <berkas.xlsx> [--mix <form_lm1500.xls>]")
    xlsx = Path(sys.argv[1])
    if not xlsx.exists():
        sys.exit(f"File tidak ditemukan: {xlsx}")

    mix_path = None
    if "--mix" in sys.argv:
        mix_path = Path(sys.argv[sys.argv.index("--mix") + 1])
        if not mix_path.exists():
            sys.exit(f"File tidak ditemukan: {mix_path}")

    data = build(xlsx, mix_path)
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
