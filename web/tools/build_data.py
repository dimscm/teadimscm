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

# Kolom identitas dicari lewat judulnya, bukan posisi tetap: susunannya sudah
# pernah berubah (RSM diganti Kecamatan dan Kelurahan) tanpa mengubah kolom
# angka, dan posisi tetap membuat build diam-diam salah baca.
JUDUL_KOLOM = {
    "no": ("KODE OUTLET",),
    "nama": ("NAMA OUTLET",),
    "alamat": ("ALAMAT",),
    "tipe": ("TYPE OUTLET",),
    "channel": ("CHANNEL (LBP)", "CHANNEL"),
    "sales": ("SALESMAN",),
    "ket": ("KETERANGAN",),
    "wilayah": ("RAYON",),
    "region": ("RSM", "REGION"),
    "kecamatan": ("KECAMATAN",),
    "kelurahan": ("KELURAHAN",),
}

# Kolom yang wajib ada; sisanya boleh kosong kalau memang tidak ada di file.
WAJIB = ("no", "nama", "sales", "ket", "wilayah")

# Tiga blok omset, masing-masing 3 bulan + TOTAL + AVG.
BLOK_OMSET = [11, 16, 21]
KOLOM_ACUAN = [26, 27, 28]
KOLOM_WEEK = [34, 35, 36, 37, 38]

# Blok angka belum pernah bergeser, tapi kalau suatu saat bergeser build harus
# berhenti dengan jelas, bukan menghasilkan angka yang salah diam-diam.
PERIKSA_SUBJUDUL = {29: ("TGT/WK MID", "TGT/BLN MID"), 39: ("TOTAL",), 40: ("ACH % VS MID",)}

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


def peta_kolom(header):
    """Cari indeks tiap kolom identitas dari judulnya."""
    judul = {rapikan(v).upper(): i for i, v in enumerate(header) if v is not None}
    pos = {}
    for kunci, kandidat in JUDUL_KOLOM.items():
        for nama in kandidat:
            if nama in judul:
                pos[kunci] = judul[nama]
                break
    hilang = [k for k in WAJIB if k not in pos]
    if hilang:
        raise SystemExit(f"Kolom wajib tidak ditemukan di sheet: {', '.join(hilang)}")
    return pos


def cari_header(semua):
    """Baris judul kolom adalah baris yang memuat 'KODE OUTLET'."""
    for i, raw in enumerate(semua):
        if any(rapikan(v).upper() == "KODE OUTLET" for v in raw if v is not None):
            return i
    raise SystemExit("Baris judul kolom tidak ditemukan (tidak ada 'KODE OUTLET')")


def read_sheet(ws, cfg):
    semua = list(ws.iter_rows(values_only=True))
    i_header = cari_header(semua)
    header = semua[i_header]
    subheader = semua[i_header + 1]
    KOLOM = peta_kolom(header)
    galon = cfg.get("galon", False)

    for kolom, diharapkan in PERIKSA_SUBJUDUL.items():
        ada = rapikan(subheader[kolom]).upper()
        if ada not in diharapkan:
            raise SystemExit(f"{ws.title}: kolom {kolom} berisi {ada!r}, "
                             f"bukan {' / '.join(diharapkan)} — susunan kolom angka berubah")

    # Baris data pertama: baris pertama setelah subjudul yang kode outletnya angka.
    awal = next((i for i in range(i_header + 2, len(semua))
                 if num(semua[i][KOLOM["no"]]) is not None), len(semua))

    # Galon: target sudah per bulan di kolom 29/30. Produk lain: 29/30 target
    # per minggu, 31/32 target sebulan, 33 zona.
    k_tgt, k_tgt_max = (29, 30) if galon else (31, 32)

    hasil = []
    tanpa_sales = 0
    seen = {}

    for nomor, raw in enumerate(semua[awal:], start=awal + 1):
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
            "region": text(raw[KOLOM["region"]]) if "region" in KOLOM else "",
            "kecamatan": text(raw[KOLOM["kecamatan"]]) if "kecamatan" in KOLOM else "",
            "kelurahan": text(raw[KOLOM["kelurahan"]]) if "kelurahan" in KOLOM else "",
            "no": int(outlet_no) if outlet_no is not None else 0,
            "nama": nama,
            "alamat": text(raw[KOLOM["alamat"]]),
            "tipe": text(raw[KOLOM["tipe"]]),
            "channel": text(raw[KOLOM["channel"]]),
            "ket": text(raw[KOLOM["ket"]]),
            # "FIX IKAT TARGET" berarti targetnya sudah diikat SPK, dan itu yang
            # membedakan cashback yang sudah jadi hak dari yang masih perkiraan.
            "spk": text(raw[KOLOM["ket"]]).upper().startswith("FIX"),
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


def koordinat_lama():
    """Koordinat outlet dari data.js yang sudah ada.

    Lokasi toko tidak berubah tiap bulan, sedangkan sheet daftar outlet tidak
    selalu ikut dikirim. Daripada tautan petanya hilang, koordinat yang sudah
    pernah terbaca dipakai lagi.
    """
    berkas = ROOT / "data.js"
    if not berkas.exists():
        return {}
    cocok = re.search(r"window\.MASTER_DATA = (.*);\s*$", berkas.read_text(encoding="utf-8"), re.S)
    if not cocok:
        return {}
    lama = json.loads(cocok.group(1))
    peta = {}
    for produk in lama.get("products", []):
        for r in produk.get("rows", []):
            if r.get("lat") and r.get("lng"):
                peta[r["no"]] = [r["lat"], r["lng"]]
    return peta


def build(xlsx_path, monitoring_path=None):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    koordinat, sheet_koordinat = baca_koordinat(wb)
    if not koordinat:
        koordinat = koordinat_lama()
        if koordinat:
            print(f"  koordinat dari data.js sebelumnya: {len(koordinat)} outlet")
    monitoring = baca_monitoring(monitoring_path) if monitoring_path else {}
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
            segar = monitoring.get((cfg["program"], r["no"]))
            if segar:
                # Form monitoring adalah sumber resmi program cashback: kalau
                # outletnya ada di sana, target dan omsetnya yang dipakai.
                r["tgt"] = segar["tgt"] or r["tgt"]
                r["weeks"] = segar["weeks"]
                r["total"] = segar["total"]
                r["spk"] = True
            r["cb"] = cashback.hitung(cfg["program"], r["tipe"], r["tgt"], r["total"])
        products.append({
            "id": ws.title.strip(),
            "label": cfg["label"],
            "satuan": SATUAN_GALON if cfg.get("galon") else "crt",
            "zonaLabel": "Zona",
            # Dipakai simulasi harga di web: zona dan tarif pada volume apa pun.
            "strata": cashback.strata_web(cfg["program"]),
            "ukuran": [],
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


# Tiap produk: daftar (sheet, baris data pertama, kolom kode outlet,
# kolom target, kolom total omset, kolom minggu pertama).
SHEET_MONITORING = {
    "TPH": [("SO TPH SEP", 7, 4, 31, 38, 33), ("GROMIN TPH SEP", 7, 4, 31, 38, 33)],
    "NMAD": [("NMAD SEP - NOV", 5, 4, 34, 41, 36)],
    "LM600": [("LM 600 JAKTIM", 7, 4, 66, 73, 68), ("LM 600 BEKASI", 7, 4, 66, 73, 68)],
    "LM1500": [("LM 1500+330 JAKTIM", 7, 4, 80, 94, None),
               ("LM 1500+330 BEKASI", 7, 4, 80, 94, None)],
    "GALON": [("SO GALON 15L SEP", 13, 3, 7, 13, 8), ("GRM GALON 15L SEP", 13, 3, 7, 13, 8)],
}

# LM 1500+330 memisahkan omset per ukuran; keduanya dijumlahkan per minggu.
KOLOM_LM1500 = ([82, 83, 84, 85, 86], [88, 89, 90, 91, 92])


def baca_monitoring(path):
    """Target SPK dan omset terbaru per outlet dari form monitoring bulanan.

    Form ini hanya memuat outlet yang SPK-nya sudah ada. Outlet yang masih
    berstatus potensi tidak ada di sini, dan tetap memakai angka dari file
    target.
    """
    wb = openpyxl.load_workbook(path, data_only=True)
    hasil = {}
    for program, daftar in SHEET_MONITORING.items():
        for nama, awal, k_kode, k_tgt, k_total, k_week in daftar:
            if nama not in wb.sheetnames:
                print(f"  ! sheet monitoring '{nama}' tidak ada, dilewati")
                continue
            for raw in list(wb[nama].iter_rows(values_only=True))[awal:]:
                kode = num(raw[k_kode])
                if kode is None or not text(raw[k_kode + 1]):
                    continue
                if k_week is None:
                    a, b = KOLOM_LM1500
                    weeks = [None if raw[x] is None and raw[y] is None
                             else (num(raw[x]) or 0) + (num(raw[y]) or 0)
                             for x, y in zip(a, b)]
                else:
                    weeks = [num(raw[k_week + i]) for i in range(len(WEEK_LABELS))]
                hasil[(program, int(kode))] = {
                    "tgt": num(raw[k_tgt]),
                    "weeks": weeks,
                    "total": round(sum(w for w in weeks if w), 2),
                }
    print(f"  monitoring: {len(hasil)} baris outlet-produk dengan SPK")
    return hasil


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python3 web/tools/build_data.py <target.xlsx> "
                 "[--monitoring <form_monitoring.xlsx>]")
    xlsx = Path(sys.argv[1])
    if not xlsx.exists():
        sys.exit(f"File tidak ditemukan: {xlsx}")

    monitoring_path = None
    if "--monitoring" in sys.argv:
        monitoring_path = Path(sys.argv[sys.argv.index("--monitoring") + 1])
        if not monitoring_path.exists():
            sys.exit(f"File tidak ditemukan: {monitoring_path}")

    data = build(xlsx, monitoring_path)
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
