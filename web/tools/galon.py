"""Baca sheet monitoring Galon 15L ("SO GALON OKT", "GRM GALON OKT").

Bentuknya bukan sheet IKAT: ini form monitoring cashback bulanan, satu sheet
untuk SO dan satu untuk GROMIN/GROSIR/LMD, dengan tabel strata ditulis sebagai
kalimat di kepala sheet:

    ~1.500 – 4.999 GALLON MENDAPAT DISC RP. 300,-/GALLON

Ambang galon adalah jumlah galon SEBULAN, bukan per minggu — tabel yang sama
dipakai di September (5 minggu) dan Oktober (4 minggu) — jadi di web ambang
ini tidak ikut diskalakan jumlah minggu.

Sheet ini tidak punya kolom salesman. Salesman tiap outlet diambil dari
salesman_outlet.json (dibangun dari seluruh riwayat data dan diperbarui tiap
build dari sheet IKAT); outlet yang tidak dikenal dilewati, sesuai aturan
"hanya outlet yang ada salesman-nya".
"""

import re

JUDUL = {
    "subdist": ("SUBDIST",),
    "no": ("KODE OUTLET",),
    "nama": ("NAMA OUTLET",),
    "alamat": ("ALAMAT",),
    "tipe": ("TYPE OUTLET",),
    "tgt": ("TARGET",),
    "total": ("TOTAL",),
    "rate": ("POT. DISCOUNT/GALON",),
    "cashback": ("TOTAL POT. DISCOUNT",),
    "ket": ("KETERANGAN",),
}

# Tipe outlet yang memakai tabel GROMIN (judul sheet: "GROMIN, GROSIR, LMD").
IKUT_GROMIN = ("GROMIN", "GROSIR", "LMD")


def rapikan(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def kunci(v):
    return rapikan(v).upper()


def num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return round(float(v), 4)


def sheet_galon(nama):
    atas = nama.upper()
    return "GALON" in atas and not atas.startswith("IKAT")


def angka_rupiah(teks):
    """'1.500' -> 1500 (titik ribuan)."""
    return float(teks.replace(".", "").replace(",", "."))


def baca_strata(rows):
    """Kalimat '~1.500 – 4.999 GALLON MENDAPAT DISC RP. 300,-' -> (min, tarif).

    Tipe outlet tabelnya diambil dari baris 'SO :' / 'GROMIN :' di atasnya.
    """
    tabel, tipe = [], ""
    for r in rows[:20]:
        for v in r:
            teks = kunci(v)
            if teks in ("SO :", "SO:"):
                tipe = "SO"
            elif teks.startswith("GROMIN") and teks.endswith(":"):
                tipe = "GROMIN"
            cocok = re.match(r"~?\s*(?:>=\s*)?([\d.]+).*?RP\.?\s*([\d.]+)", teks)
            if cocok and "GALLON" in teks:
                tabel.append({"min": angka_rupiah(cocok.group(1)), "zona": "",
                              "rate": angka_rupiah(cocok.group(2)), "rate2": None})
    return tipe, sorted(tabel, key=lambda b: b["min"], reverse=True)


def tarif(tabel, galon):
    for b in tabel:
        if galon >= b["min"]:
            return b["rate"]
    return 0


def baca(sheets, labels_minggu, peta_sales, koordinat):
    """Gabungkan sheet galon jadi satu produk. Kembalikan (produk, laporan)."""
    strata, rows_hasil = {}, []
    lewat, cek = {}, {"cocok": 0, "beda": []}

    for ws in sheets:
        rows = list(ws.iter_rows(values_only=True))
        tipe_tabel, tabel = baca_strata(rows)
        if tabel:
            strata[tipe_tabel or "SO"] = tabel

        hdr = next((i for i, r in enumerate(rows) if any(kunci(v) == "KODE OUTLET" for v in r)), None)
        if hdr is None:
            continue
        judul = {}
        for j, v in enumerate(rows[hdr]):
            t = kunci(v)
            if t and t not in judul:
                judul[t] = j
        kol = {k: next((judul[c] for c in v if c in judul), None) for k, v in JUDUL.items()}
        k_minggu = [judul.get(w[1:]) for w in labels_minggu]  # kolom berjudul 40, 41, ...
        # Judul minggu di sheet ini berupa angka, bukan teks.
        for j, v in enumerate(rows[hdr]):
            if isinstance(v, (int, float)) and f"W{int(v)}" in labels_minggu:
                k_minggu[labels_minggu.index(f"W{int(v)}")] = j

        for raw in rows[hdr + 1:]:
            kode = num(raw[kol["no"]]) if kol["no"] is not None else None
            if kode is None or not rapikan(raw[kol["nama"]]):
                continue
            kode = int(kode)
            tipe = kunci(raw[kol["tipe"]]) or tipe_tabel
            subdist = rapikan(raw[kol["subdist"]])
            dikenal = peta_sales.get(kode)
            if not dikenal:
                lewat[subdist] = lewat.get(subdist, 0) + 1
                continue

            weeks = [num(raw[k]) if k is not None else None for k in k_minggu]
            total = num(raw[kol["total"]]) or 0
            tgt = num(raw[kol["tgt"]]) or 0
            rate_now = num(raw[kol["rate"]]) or 0
            cb_now = num(raw[kol["cashback"]]) or 0

            tab = strata.get("SO" if tipe == "SO" else "GROMIN", [])
            model = tarif(tab, total)
            if abs(model - rate_now) < 0.5:
                cek["cocok"] += 1
            else:
                cek["beda"].append((kode, rapikan(raw[kol["nama"]]), total, rate_now, model))

            rate_tgt = tarif(tab, tgt)
            cb_tgt = round(tgt * rate_tgt)
            tercapai = tgt > 0 and total >= tgt
            status = ("aman" if tercapai else
                      "retur" if total < 0 else
                      "nol" if total <= 0 else
                      "gugur" if not cb_now else
                      "kurang")

            baris = {
                "sales": dikenal["sales"],
                "wilayah": dikenal.get("rayon", ""),
                "region": "",
                "kecamatan": "",
                "kelurahan": "",
                "subdist": subdist,
                "no": kode,
                "nama": rapikan(raw[kol["nama"]]),
                "alamat": rapikan(raw[kol["alamat"]]) if kol["alamat"] is not None else "",
                "tipe": tipe,
                "channel": "",
                # Status program: FIX IKAT TARGET / POTENSI, kalau kolomnya ada.
                "ket": kunci(raw[kol["ket"]]) if kol["ket"] is not None else "",
                "spk": kunci(raw[kol["ket"]]).startswith("FIX") if kol["ket"] is not None else False,
                "zona": "",
                "diskon": rate_now,
                "tgtWeek": None,
                "tgt": round(tgt, 2),
                "tgtMax": None,
                "pilih": "",
                "weeks": weeks,
                "total": round(total, 2),
                "share": None,
                "history": [],
                "koreksi": None,
                "cb": {
                    "tarif": round(rate_now),
                    "tarifTgt": round(rate_tgt),
                    "zona": "",
                    "zonaTgt": "",
                    "now": round(cb_now),
                    "target": cb_tgt,
                    "sisa": max(cb_tgt - round(cb_now), 0),
                    "kurangUnit": round(max(tgt - total, 0), 2),
                    "status": status,
                    "syaratAch": False,
                },
            }
            titik = koordinat.get(kode)
            if titik:
                baris["lat"], baris["lng"] = titik
            rows_hasil.append(baris)

    # LMD dan GROSIR memakai tabel GROMIN.
    if "GROMIN" in strata:
        for t in IKUT_GROMIN:
            strata.setdefault(t, strata["GROMIN"])

    produk = {
        "id": "GALON 15L",
        "label": "Galon 15L",
        "satuan": "galon",
        "zonaLabel": "Zona",
        "strata": strata,
        # Ambang galon ditulis per bulan, tidak ikut jumlah minggu.
        "strataTetap": True,
        "ukuran": [],
        "rows": rows_hasil,
    } if rows_hasil else None
    return produk, {"lewat": lewat, "cek": cek}
