#!/usr/bin/env python3
"""Ubah form monitoring resmi ikat target ("MONITORING_IKAT_TARGET_Q4...") jadi web/data.js.

Bentuk ini dipakai kantor mulai November 2026. Bedanya dengan sheet "IKAT ...":

  - satu workbook untuk Jaktim DAN Bekasi, berisi semua outlet ber-SPK;
  - tiap sheet memuat beberapa bulan berdampingan (LM: OKT · NOV · DES, Nipis
    Madu: SEP · OKT · NOV), dan bulan yang dipakai dipilih otomatis — bulan
    terbaru yang realisasi mingguannya sudah terisi;
  - TPH dan Nipis Madu dipecah dua sheet (SO/GROMIN, Bekasi/Jaktim) yang di web
    digabung jadi satu produk;
  - TIDAK ada kolom salesman. Salesman tiap outlet diambil dari
    salesman_outlet.json; outlet yang tidak dikenal dilewati dan dilaporkan.

Tabel strata tidak diambil ulang: strata program Q4 sudah tersimpan di
data.js, dan tiap build dicocokkan lagi dengan zona dan cashback yang dihitung
kantor di file ini.

Pakai:  python3 web/tools/build_monitoring.py MONITORING_IKAT_TARGET_Q4....xlsx
"""

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_ikat as ikat  # noqa: E402
import galon  # noqa: E402

ROOT = ikat.ROOT

BULAN = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOV", "DES"]
NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
              "September", "Oktober", "November", "Desember"]
# Penulisan bulan di judul kolom: 'NOV.2026', 'NOVEMBER.2026', 'AUG', 'AGU', ...
ALIAS = {"AUG": "AGS", "AGU": "AGS", "AGUSTUS": "AGS", "OCT": "OKT", "OKTOBER": "OKT",
         "NOVEMBER": "NOV", "DEC": "DES", "DESEMBER": "DES", "SEPTEMBER": "SEP",
         "MAY": "MEI", "JULI": "JUL", "JUNI": "JUN"}

# Urutan tab di web, sama seperti bulan-bulan sebelumnya.
URUTAN_TAB = ["LM 600", "LM 1500+330", "TPH", "Nipis Madu"]

# Sheet produk dikenali dari judulnya; galon dibaca tools/galon.py.
PRODUK = [
    ("TPH", "TPH", "crt"),
    ("NMAD", "Nipis Madu", "crt"),
    ("LM 600", "LM 600", "crt"),
    ("LM 1500", "LM 1500+330", "crt"),
]


def k(v):
    return re.sub(r"\s+", " ", str(v)).strip().upper() if v is not None else ""


def num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return round(float(v), 4)


def bulan_dari(teks):
    """'OMSET NOV.2026' / 'TGT SPK NOVEMBER.2026' -> ('NOV', 2026)."""
    m = re.search(r"\b([A-Z]{3,9})\.?\s*(20\d\d)\b", teks)
    if not m:
        return None
    b = ALIAS.get(m.group(1), m.group(1))
    return (b, int(m.group(2))) if b in BULAN else None


def baris_judul(rows):
    for i, r in enumerate(rows[:40]):
        if any(k(v) == "KODE OUTLET" for v in r):
            return i
    return None


def judul_kolom(rows, hdr):
    """Judul tiap kolom: baris judul, dan subjudul di bawahnya."""
    atas = [k(v) for v in rows[hdr]]
    bawah = [rows[hdr + 1][j] if hdr + 1 < len(rows) and j < len(rows[hdr + 1]) else None
             for j in range(len(atas))]
    return atas, bawah


def blok_omset(atas, bawah):
    """Blok 'OMSET <bulan>' beserta kolom mingguannya.

    Kembalikan [(bulan, tahun, ukuran, {minggu: kolom}, kolom TOTAL)]; ukuran
    diisi '1500'/'330' untuk sheet LM 1500+330 yang memisah dua ukuran.
    """
    hasil = []
    for j, t in enumerate(atas):
        if not t.startswith("OMSET"):
            continue
        bt = bulan_dari(t)
        if not bt or " Q" in t or "WEEK" in t:
            continue
        ukuran = ""
        m = re.search(r"LM (\d{3,4})ML", t)
        if m:
            ukuran = m.group(1)
        minggu, total = {}, None
        for c in range(j, min(j + 8, len(atas))):
            if c > j and atas[c]:
                break
            v = bawah[c]
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                minggu[int(v)] = c
            elif k(v) == "TOTAL":
                total = c
                break
        if minggu:
            hasil.append((bt[0], bt[1], ukuran, minggu, total))
    return hasil


def pilih_bulan(wb):
    """Bulan terbaru yang realisasi mingguannya sudah terisi, dari semua sheet."""
    terbaik = None
    for ws in wb.worksheets:
        if ws.sheet_state != "visible":
            continue
        rows = list(ws.iter_rows(values_only=True))
        hdr = baris_judul(rows)
        if hdr is None:
            continue
        atas, bawah = judul_kolom(rows, hdr)
        for b, th, _, minggu, _ in blok_omset(atas, bawah):
            ada = any(isinstance(r[c], (int, float)) and r[c]
                      for r in rows[hdr + 2:] for c in minggu.values() if c < len(r))
            kunci = (th, BULAN.index(b))
            if ada and (terbaik is None or kunci > terbaik[0]):
                terbaik = (kunci, b, th, sorted(minggu))
    if terbaik is None:
        raise SystemExit("Tidak ada blok OMSET bulanan yang sudah terisi di workbook ini")
    _, b, th, minggu = terbaik
    return b, th, minggu


def strata_tersimpan():
    """Strata tiap produk dari data.js, dalam bentuk tuple per minggu milik build_ikat."""
    lama = ROOT / "data.js"
    teks = lama.read_text(encoding="utf-8")
    data = json.loads(teks[teks.index("=") + 1:teks.rstrip().rstrip(";").rfind("}") + 1])
    n = len(data.get("weekLabels") or []) or 4
    hasil = {}
    for p in data["products"]:
        if p.get("strataTetap"):
            continue  # galon: tabelnya dibaca dari sheet galon sendiri
        hasil[p["label"]] = {
            tipe: sorted(((b["min"] / n, b["zona"], b["rate"], b["rate2"]) for b in tabel),
                         reverse=True)
            for tipe, tabel in (p.get("strata") or {}).items()
        }
    return hasil


def riwayat(rows, hdr, atas, bawah, raw, bulan_ini):
    """Omset kuartal lalu dan bulan-bulan sebelumnya di sheet yang sama."""
    blok = []
    for j, t in enumerate(atas):
        if not t.startswith("OMSET") or not (" Q" in t or "WEEK" in t):
            continue
        items = []
        for c in range(j, min(j + 5, len(raw))):
            lab = bawah[c]
            if isinstance(lab, datetime):
                lab = f"{BULAN[lab.month - 1].title()} {str(lab.year)[2:]}"
            items.append({"k": k(lab).title() if isinstance(lab, str) else str(lab), "v": num(raw[c])})
        blok.append({"title": re.sub(r"\s+", " ", str(rows[hdr][j])).strip(), "items": items})
    kini = (bulan_ini[1], BULAN.index(bulan_ini[0]))
    for b, th, ukuran, minggu, total in blok_omset(atas, bawah):
        # Hanya bulan yang sudah lewat; bulan depan masih kosong.
        if ukuran or (th, BULAN.index(b)) >= kini:
            continue
        items = [{"k": f"W{w}", "v": num(raw[c])} for w, c in sorted(minggu.items())]
        if total is not None:
            items.append({"k": "Total", "v": num(raw[total])})
        blok.append({"title": f"{NAMA_BULAN[BULAN.index(b)]} {th}", "items": items})
    return blok


def baca_sheet(ws, label, satuan, bulan, tahun, minggu, peta_sales, koordinat, strata):
    rows = list(ws.iter_rows(values_only=True))
    hdr = baris_judul(rows)
    atas, bawah = judul_kolom(rows, hdr)
    col = {t: j for j, t in reversed(list(enumerate(atas))) if t}
    def cari(*nama):
        return next((col[n] for n in nama if n in col), None)
    c_kode, c_nama = cari("KODE OUTLET"), cari("NAMA OUTLET")
    c_alamat, c_tipe = cari("ALAMAT"), cari("TYPE OUTLET")
    c_sub = cari("SUBDIST", "NAMA SUBDIST", "AREA")

    # Blok bulan ini: mulai di kolom target bulan itu sampai blok berikutnya.
    pola_tgt = re.compile(r"^(TGT|TARGET)\b")
    c_tgt = next(j for j, t in enumerate(atas)
                 if pola_tgt.match(t) and "/ WK" not in t and bulan_dari(t) == (bulan, tahun))
    akhir = next((j for j in range(c_tgt + 1, len(atas)) if atas[j] == "TGT / WK SPK"), len(atas))
    c_tgtwk = c_tgt - 1 if atas[c_tgt - 1] == "TGT / WK SPK" else None
    c_zona_tgt = c_tgt + 1 if atas[c_tgt + 1] == "ZONA" else None
    di_blok = lambda pred: next((j for j in range(c_tgt, akhir) if pred(atas[j])), None)  # noqa: E731
    c_val = di_blok(lambda t: "CASHBACK" in t and ("VALUE" in t or t.startswith("TOTAL CASHBACK"))) \
        or di_blok(lambda t: t.startswith("CASHBACK") and bulan_dari(t) == (bulan, tahun)
                   and "ML" not in t)
    c_rate = di_blok(lambda t: t == "CASHBACK (RP)/CRT")
    c_ket = di_blok(lambda t: t == "KETERANGAN")
    c_zona_act = di_blok(lambda t: t.startswith("ZONA FINAL"))
    c_mix = di_blok(lambda t: t.startswith("TOTAL LM"))

    omset = [b for b in blok_omset(atas, bawah) if (b[0], b[1]) == (bulan, tahun)]
    tabel = strata.get(label, {})

    hasil, lewat, cek = [], {}, []
    for raw in rows[hdr + 1:]:
        kode = num(raw[c_kode])
        if kode is None or not k(raw[c_nama]):
            continue
        kode = int(kode)
        subdist = k(raw[c_sub]) if c_sub is not None else ""
        dikenal = peta_sales.get(kode)
        if not dikenal:
            lewat[subdist] = lewat.get(subdist, 0) + 1
            continue

        weeks = [0.0] * len(minggu)
        per_ukuran = {}
        for _, _, ukuran, kol_minggu, kol_total in omset:
            jml = 0.0
            for i, w in enumerate(minggu):
                v = num(raw[kol_minggu[w]]) if w in kol_minggu else None
                weeks[i] += v or 0
                jml += v or 0
            per_ukuran[ukuran] = jml
        total = num(raw[c_mix]) if c_mix is not None else None
        if total is None:
            total = sum(weeks)
        tgt = num(raw[c_tgt]) or 0
        tipe = k(raw[c_tipe]) if c_tipe is not None else ""
        share = (per_ukuran["1500"] / total) if ("1500" in per_ukuran and total) else 1.0

        cb_file = num(raw[c_val]) if c_val is not None else None
        rate_file = num(raw[c_rate]) if c_rate is not None else None
        zona_final = k(raw[c_zona_tgt]) if c_zona_tgt is not None else ""
        rate_m, zona_m, cb_m, aturan = ikat.cashback_model(
            label, tabel, tipe, total, tgt, share, zona_final, minggu=len(minggu))

        # Angka kantor dipakai bila sama dengan model; bila berbeda, model
        # dipakai dan barisnya ditandai (lihat README: cashback dihitung ulang).
        koreksi = None
        cb_now, rate_now, zona_now = cb_m, rate_m, zona_m
        if cb_file is not None and abs(cb_file - cb_m) <= max(2, cb_m * 0.002):
            cb_now = cb_file
            if rate_file:
                rate_now = rate_file
        elif tabel:
            koreksi = {"jenis": "cashback", "cbFile": round(cb_file or 0), "cbModel": cb_m}
            if aturan:
                koreksi["aturan"] = aturan
            cek.append(f"{kode} {k(raw[c_nama])} — cashback di file Rp {cb_file or 0:,.0f}, "
                       f"hitungan Rp {cb_m:,.0f} (realisasi {total:,.0f})")
        if c_zona_act is not None and k(raw[c_zona_act]) not in ("", "0", "-") and koreksi is None:
            zona_now = k(raw[c_zona_act])

        rate_tgt, zona_tgt = ikat.tarif_di(tabel, tipe, tgt / len(minggu), share)
        cb_tgt = round(tgt * rate_tgt)
        tercapai = tgt > 0 and total >= tgt
        status = ("aman" if tercapai else
                  "retur" if total < 0 else
                  "nol" if total <= 0 else
                  "gugur" if not cb_now and zona_now in ("", "-") else
                  "kurang")
        ket = k(raw[c_ket]) if c_ket is not None else ""

        baris = {
            "sales": dikenal["sales"],
            "wilayah": dikenal.get("rayon", ""),
            "region": "",
            "kecamatan": "",
            "kelurahan": "",
            "subdist": subdist,
            "no": kode,
            "nama": k(raw[c_nama]),
            "alamat": k(raw[c_alamat]) if c_alamat is not None else "",
            "tipe": tipe,
            "channel": "",
            "ket": ket,
            "spk": True,
            "zona": zona_final if zona_final not in ("", "-", "0") else "",
            "diskon": None,
            "tgtWeek": num(raw[c_tgtwk]) if c_tgtwk is not None else None,
            "tgt": round(tgt, 2),
            "tgtMax": None,
            "pilih": "",
            "weeks": [round(w, 2) for w in weeks],
            "total": round(total, 2),
            "share": round(share, 4) if share != 1.0 else None,
            "history": riwayat(rows, hdr, atas, bawah, raw, (bulan, tahun)),
            "koreksi": koreksi,
            "cb": {
                "tarif": round(rate_now or 0),
                "tarifTgt": round(rate_tgt),
                "zona": zona_now if zona_now not in ("-", "0") else "",
                "zonaTgt": zona_tgt,
                "now": round(cb_now or 0),
                "target": cb_tgt,
                "sisa": max(cb_tgt - round(cb_now or 0), 0),
                "kurangUnit": round(max(tgt - total, 0), 2),
                "status": status,
                "syaratAch": label == "Nipis Madu",
            },
        }
        titik = koordinat.get(kode)
        if titik:
            baris["lat"], baris["lng"] = titik
        hasil.append(baris)
    return hasil, lewat, cek


def strata_web(tabel, n):
    """Tuple per minggu -> bentuk web (ambang sebulan)."""
    return {tipe: [{"min": round(m * n, 2), "zona": z, "rate": round(r),
                    "rate2": None if r2 is None else round(r2)} for m, z, r, r2 in t]
            for tipe, t in tabel.items()}


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python3 web/tools/build_monitoring.py <berkas.xlsx>")
    xlsx = Path(sys.argv[1])
    wb = openpyxl.load_workbook(xlsx, data_only=True)

    bulan, tahun, minggu = pilih_bulan(wb)
    labels = [f"W{w}" for w in minggu]
    periode = f"{NAMA_BULAN[BULAN.index(bulan)]} {tahun}"
    print(f"  periode: {periode} ({labels[0]}–{labels[-1]})")

    koordinat = ikat.koordinat_tersimpan()
    peta_sales = ikat.salesman_tersimpan()
    strata = strata_tersimpan()

    per_label = {}
    sheet_galon = []
    for ws in wb.worksheets:
        if ws.sheet_state != "visible":
            continue
        judul = ws.title.upper()
        if "GALON" in judul:
            if bulan in judul:
                sheet_galon.append(ws)
            continue
        cocok = next((p for p in PRODUK if p[0] in judul), None)
        if cocok is None:
            continue
        _, label, satuan = cocok
        rows, lewat, cek = baca_sheet(ws, label, satuan, bulan, tahun, minggu,
                                      peta_sales, koordinat, strata)
        e = per_label.setdefault(label, {"rows": [], "lewat": {}, "cek": [], "satuan": satuan,
                                         "sheet": []})
        e["rows"] += rows
        e["sheet"].append(ws.title)
        for s, n in lewat.items():
            e["lewat"][s] = e["lewat"].get(s, 0) + n
        e["cek"] += [f"{ws.title}: {c}" for c in cek]

    products = []
    for label in URUTAN_TAB:
        e = per_label.get(label)
        if not e or not e["rows"]:
            continue
        products.append({
            "id": f"{label} {bulan}.{tahun}",
            "label": label,
            "satuan": e["satuan"],
            "zonaLabel": "Zona",
            "strata": strata_web(strata.get(label, {}), len(minggu)),
            "ukuran": ["1500ML", "330ML"] if label == "LM 1500+330" else [],
            "rows": e["rows"],
        })
        lewat = sum(e["lewat"].values())
        print(f"  {label:<14} {len(e['rows']):>4} outlet  (+{lewat} tanpa salesman, dilewati)"
              f"  dari {', '.join(e['sheet'])}")
        for s, n in sorted(e["lewat"].items()):
            print(f"      dilewati {n:>3} outlet {s}")
        cocok = len(e["rows"]) - len(e["cek"])
        print(f"      cashback kantor vs model: cocok {cocok}, beda {len(e['cek'])}")
        for c in e["cek"]:
            print(f"      ! {c}")

    if sheet_galon:
        prod, lap = galon.baca(sheet_galon, labels, peta_sales, koordinat)
        if prod:
            prod["id"] = f"GALON {bulan}.{tahun}"
            products.append(prod)
            print(f"  {'Galon 15L':<14} {len(prod['rows']):>4} outlet  "
                  f"(+{sum(lap['lewat'].values())} tanpa salesman, dilewati)")
            for s, n in sorted(lap["lewat"].items()):
                print(f"      dilewati {n:>3} outlet {s}")
            print(f"      tarif tercetak vs strata: cocok {lap['cek']['cocok']}, "
                  f"beda {len(lap['cek']['beda'])}")


    data = {
        "periode": periode,
        "weekLabels": labels,
        "labels": {"wilayah": "Rayon"},
        "sumber": re.sub(r"^[0-9a-f]{6,}-", "", xlsx.name),
        "tanggal": date.today().isoformat(),
        "products": products,
    }
    sim = ikat.simulasi_tersimpan()
    if sim:
        sim["nweek"] = len(minggu)
        data["simulasi"] = sim
        print("  simulasi harga: dipakai yang tersimpan")

    out = ROOT / "data.js"
    out.write_text(
        "// Dibuat otomatis oleh tools/build_monitoring.py — jangan diedit manual.\n"
        f"window.MASTER_DATA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    total = sum(len(p["rows"]) for p in products)
    sisa = sum(r["cb"]["sisa"] for p in products for r in p["rows"])
    print(f"-> web/data.js ({total} baris, sisa cashback Rp {sisa:,.0f})")


if __name__ == "__main__":
    main()
