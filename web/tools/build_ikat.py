#!/usr/bin/env python3
"""Ubah workbook ikat target bentuk "IKAT ..." menjadi web/data.js.

Bentuk ini menggantikan workbook "POTENSI ..." mulai Oktober 2026: tiap sheet
satu produk, tata letak kolomnya berbeda-beda antar sheet, dan — ini yang
paling berguna — tiap sheet membawa tabel stratanya sendiri serta kolom zona,
rate, dan cashback yang sudah dihitung kantor.

Karena itu pembaca ini mencari kolom lewat JUDULNYA, bukan posisinya, dan
memakai angka cashback yang tercetak di file. Yang masih dihitung sendiri
hanyalah "cashback kalau target tercapai" — angka yang tidak ada di file
tetapi justru yang dicari sales — memakai tabel strata dari sheet itu juga.

Strata dinyatakan sebagai minimum karton per minggu, jadi band bulanannya
ikut jumlah minggu bulan itu tanpa perlu tabel baru tiap bulan.

Pakai:  python3 web/tools/build_ikat.py target_oct_toko.xlsx
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import galon  # noqa: E402
import simulasi  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

PERIODE = "Oktober 2026"
WEEK_LABELS = ["W40", "W41", "W42", "W43"]
BULAN_PENDEK = "OKT"

# Produk dikenali dari nama sheet; urutannya menentukan urutan tab di web.
PRODUK = [
    ("TPH", "TPH", "crt"),
    ("NM 330", "Nipis Madu", "crt"),
    ("NIPIS", "Nipis Madu", "crt"),
    ("LM 600", "LM 600", "crt"),
    ("LM 1500", "LM 1500+330", "crt"),
    ("GALON", "Galon 15L", "galon"),
]

# Judul kolom yang dicari. Beberapa sheet memakai sebutan berbeda untuk hal
# yang sama, jadi tiap entri boleh punya beberapa kandidat.
JUDUL = {
    "kecamatan": ("KECAMATAN",),
    "kelurahan": ("KELURAHAN",),
    "wilayah": ("RAYON",),
    "no": ("KODE OUTLET",),
    "nama": ("NAMA OUTLET",),
    "alamat": ("ALAMAT",),
    "tipe": ("TYPE OUTLET",),
    "channel": ("CHANNEL (LBP)", "CHANNEL"),
    "sales": ("SALESMAN",),
    "ket": ("KETERANGAN",),
    "tgt": (f"TGT {BULAN_PENDEK} (4 WK)", f"TGT {BULAN_PENDEK}"),
    "tgtMax": (f"TGT {BULAN_PENDEK} MAX (4 WK)", "TGT/WK MAX"),
    "act": (f"ACT {BULAN_PENDEK} (W40-43)", f"ACT MIX {BULAN_PENDEK}", f"ACT {BULAN_PENDEK}"),
    "zona": (f"ZONA CASHBACK {BULAN_PENDEK}", "ZONA CASHBACK", f"ZONA ACT {BULAN_PENDEK}", "ZONA ACT"),
    "zonaTgt": ("ZONA FINAL", "ZONA TARGET"),
    "rate": (f"RATE /CRT {BULAN_PENDEK}", "RATE /CRT"),
    "cashback": (f"CASHBACK (RP) {BULAN_PENDEK}", "CASHBACK (RP)", f"CASHBACK {BULAN_PENDEK} (RP)"),
    "tgtWeek": ("TGT/WK FINAL", "TGT/WK MID"),
    "pilih": ("PILIH TARGET",),
    # Khusus LM 1500+330 yang memisahkan omset dua ukuran.
    "act1": (f"ACT 1500 {BULAN_PENDEK}",),
    "act2": (f"ACT 330 {BULAN_PENDEK}",),
}

WAJIB = ("no", "nama", "sales", "ket", "wilayah", "tgt", "act")

# Judul tabel strata di dalam sheet, dan judul kolomnya.
JUDUL_STRATA = ("MIN CRT/WK",)
# Urutan penting: yang pertama jadi tarif utama, yang kedua tarif ukuran
# satunya (LM 1500+330 membedakan tarif 1500ML dan 330ML).
JUDUL_RATE = ("CASHBACK /CRT", "CB 1500 /CRT", "CB 330 /CRT")


def rapikan(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def kunci(v):
    return rapikan(v).upper()


def num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return round(float(v), 4)


def baris_judul(rows):
    for i, r in enumerate(rows):
        if any(kunci(v) == "KODE OUTLET" for v in r):
            return i
    raise SystemExit("Baris judul tidak ditemukan (tidak ada 'KODE OUTLET')")


def peta_judul(rows, hdr):
    """Judul -> kolom, dikumpulkan dari baris judul dan satu baris di bawahnya."""
    peta = {}
    for i in (hdr, hdr + 1):
        if i < len(rows):
            for j, v in enumerate(rows[i]):
                t = kunci(v)
                if t and t not in peta:
                    peta[t] = j
    return peta


def cari(peta, kandidat):
    kolom, _ = cari_judul(peta, kandidat)
    return kolom


def cari_judul(peta, kandidat):
    """Kolom beserta judul yang cocok — judulnya ikut menentukan artinya."""
    for k in kandidat:
        if k in peta:
            return peta[k], k
    return None, None


def kolom_minggu(rows, hdr):
    """Empat kolom berurutan berjudul 40, 41, 42, 43."""
    for i in (hdr, hdr + 1):
        if i >= len(rows):
            continue
        baris = [kunci(v) for v in rows[i]]
        target = [w[1:] for w in WEEK_LABELS]
        for j in range(len(baris) - len(target) + 1):
            if [baris[j + k] for k in range(len(target))] == target:
                return j
    return None


def nama_ukuran(judul):
    """'CB 1500 /CRT' -> '1500ML'; dipakai melabeli dua tarif LM 1500+330."""
    angka = re.search(r"\d{3,4}", judul)
    return f"{angka.group()}ML" if angka else ""


def baca_strata(rows, nama_sheet):
    """Tabel strata di dalam sheet.

    Kembalikan ({kunci tipe outlet: [(min crt/wk, zona, rate, rate kedua), ...]},
    nama ukuran tiap kolom tarif). TPH memuat dua tabel terpisah untuk SO dan
    GROMIN; produk lain satu tabel yang dipakai semua tipe (kuncinya "").
    """
    hasil = {}
    ukuran = []
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            if kunci(v) not in JUDUL_STRATA:
                continue
            judul = [kunci(x) for x in r]
            k_zona = next((c for c in range(j, min(j + 7, len(judul))) if judul[c] == "ZONA"), None)
            rate_kol = [c for c in range(j, min(j + 7, len(judul))) if judul[c] in JUDUL_RATE]
            if k_zona is None or not rate_kol:
                continue

            # Judul tabel ada di baris mana pun di atasnya yang menyebut STRATA
            # atau CASHBACK; dari situ ketahuan tabel ini untuk tipe outlet apa.
            tipe = ""
            for atas in range(i - 1, max(i - 4, -1), -1):
                teks = kunci(rows[atas][j])
                if "STRATA" in teks or "CASHBACK" in teks:
                    if " SO " in f" {teks} ":
                        tipe = "SO"
                    elif "GROMIN" in teks:
                        tipe = "GROMIN"
                    break

            tabel = []
            for baris in rows[i + 1:]:
                minimum = num(baris[j])
                zona = rapikan(baris[k_zona])
                # Baris kosong di tengah tabel dilewati, bukan menghentikan
                # pembacaan — tabel SO pernah hilang gara-gara ini.
                if minimum is None and not zona:
                    continue
                if minimum is None or not zona:
                    break
                if zona == "-":
                    continue
                rate = num(baris[rate_kol[0]]) or 0
                rate2 = num(baris[rate_kol[1]]) if len(rate_kol) > 1 else None
                if rate:
                    tabel.append((minimum, zona, rate, rate2))

            if tabel and tipe not in hasil:
                hasil[tipe] = sorted(tabel, reverse=True)
                if len(rate_kol) > 1 and not ukuran:
                    ukuran = [nama_ukuran(judul[c]) for c in rate_kol]

    if not hasil:
        print(f"  ! {nama_sheet}: tabel strata tidak ditemukan, cashback target dilewati")
    return hasil, ukuran


def strata_web(strata):
    """Strata untuk simulasi di browser.

    Ambangnya diubah jadi karton SEBULAN supaya di web bisa langsung
    dibandingkan dengan volume bulanan; di sheet angkanya per minggu.
    """
    n = len(WEEK_LABELS)
    return {
        tipe: [{"min": round(minimum * n, 2), "zona": zona,
                "rate": round(rate), "rate2": None if rate2 is None else round(rate2)}
               for minimum, zona, rate, rate2 in tabel]
        for tipe, tabel in strata.items()
    }


def tarif_di(strata, tipe_outlet, per_minggu, share_utama=1.0):
    """Tarif per karton pada suatu rata-rata mingguan.

    share_utama dipakai LM 1500+330 yang tarifnya berbeda antara 1500ML dan
    330ML: tarifnya dicampur mengikuti komposisi omset outlet itu sendiri.
    """
    tabel = strata.get((tipe_outlet or "").upper()) or strata.get("") or []
    for minimum, zona, rate, rate2 in tabel:
        if per_minggu >= minimum:
            if rate2 is None:
                return rate, zona
            return rate * share_utama + rate2 * (1 - share_utama), zona
    return 0, ""


# Berapa zona boleh turun dari zona SPK sebelum cashback LM gugur. Batasnya
# dari form monitoring resmi November (program Q4), dan kedua sheet LM-nya
# BERBEDA:
#   LM 600       turun 1 dibayar, turun 2 GUGUR (TIRTA JAYA A→C, AGEN JJ C→E)
#   LM 1500+330  turun 2 masih dibayar (RIFAI AGEN, LARNO, BINTANG TIMUR,
#                AGEN JJ), turun 3 gugur (CV ARSYIKA)
# AGEN JJ ada di keduanya dan diperlakukan berbeda, jadi ini bisa beda surat
# program (9046 vs 9047) atau salah rumus di salah satu sheet — belum
# dikonfirmasi. Web mengikuti hitungan kantor. Program Q3 lihat cashback.py.
MAKS_TURUN_ZONA = {"LM 600": 1, "LM 1500+330": 2}


def peringkat_zona(strata, tipe_outlet, zona):
    """Urutan zona dari tabel strata itu sendiri: terendah = 1."""
    tabel = strata.get((tipe_outlet or "").upper()) or strata.get("") or []
    urut = [z for _, z, _, _ in sorted(tabel)]  # dari ambang terkecil
    return urut.index(zona) + 1 if zona in urut else None


def cashback_model(label, strata, tipe_outlet, total, tgt, share, zona_final, minggu=None):
    """Cashback berjalan menurut aturan program, dari realisasi saat ini.

    Kembalikan (tarif /crt, zona, cashback, catatan aturan yang berlaku).
    """
    if total <= 0:
        return 0, "", 0, ""
    rate, zona = tarif_di(strata, tipe_outlet, total / (minggu or len(WEEK_LABELS)), share)
    if not rate:
        return 0, "", 0, ""
    if label == "Nipis Madu" and total < tgt:
        return 0, zona, 0, "Nipis Madu hanya dibayar kalau target tercapai"
    if label.startswith("LM") and zona_final:
        atas = peringkat_zona(strata, tipe_outlet, zona_final)
        kini = peringkat_zona(strata, tipe_outlet, zona)
        if atas and kini and atas - kini > MAKS_TURUN_ZONA.get(label, 1):
            return 0, "", 0, f"turun {atas - kini} zona dari zona final {zona_final}, gugur"
    return rate, zona, round(total * rate), ""


def label_produk(nama_sheet):
    atas = nama_sheet.upper()
    for potongan, label, satuan in PRODUK:
        if potongan in atas:
            return label, satuan
    return None, None


def riwayat(rows, hdr, raw):
    """Blok omset: tiap judul yang diawali 'OMSET' diikuti 3 bulan + total + avg."""
    blok = []
    for j, v in enumerate(rows[hdr]):
        judul = rapikan(v)
        if not judul.upper().startswith("OMSET"):
            continue
        sub = rows[hdr + 1] if hdr + 1 < len(rows) else []
        items = []
        for k in range(j, min(j + 5, len(raw))):
            label = rapikan(sub[k]) if k < len(sub) else ""
            items.append({"k": label or str(k - j + 1), "v": num(raw[k])})
        blok.append({"title": judul, "items": items})
    return blok


SALES_OUTLET = ROOT / "salesman_outlet.json"
# 'M3-T-TOB01 AHMAD' / 'M3-TA11 ANDI' -> kode salesman TOB01 / TA11.
KODE_SALES = re.compile(r"M3-(?:T-)?([A-Z]+\d+)")


def salesman_tersimpan():
    """Salesman tiap outlet dari seluruh riwayat data (kode -> sales, rayon).

    Dipakai sheet yang tidak punya kolom salesman, seperti monitoring galon.
    """
    if not SALES_OUTLET.exists():
        return {}
    isi = json.loads(SALES_OUTLET.read_text(encoding="utf-8"))
    return {int(k): v for k, v in isi.items()}


def perbarui_salesman(peta, products):
    """Penugasan di sheet IKAT bulan ini menang atas riwayat, dan nama
    salesman lama diseragamkan ke penulisan sekarang lewat kodenya (TOB01,
    TA11, ...) — September menulis 'M3-TOB01 ...', Oktober 'M3-T-TOB01 ...'."""
    kini = {}
    for p in products:
        for r in p["rows"]:
            peta[int(r["no"])] = {"sales": r["sales"], "rayon": r["wilayah"]}
            kode = KODE_SALES.search(r["sales"])
            if kode:
                kini[kode.group(1)] = r["sales"]
    for e in peta.values():
        kode = KODE_SALES.search(e["sales"])
        if kode and kode.group(1) in kini:
            e["sales"] = kini[kode.group(1)]
    SALES_OUTLET.write_text(
        json.dumps({str(k): v for k, v in sorted(peta.items())}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    return peta


KOORDINAT = ROOT / "koordinat.json"


def koordinat_tersimpan():
    """Koordinat outlet dari berkas terpisah.

    Dulu koordinat diambil dari data.js sebelumnya, tapi tiap bulan daftar
    outletnya berubah sehingga koordinat outlet yang keluar-masuk ikut hilang.
    Berkas ini menyimpannya lepas dari data bulanan.
    """
    if not KOORDINAT.exists():
        return {}
    isi = json.loads(KOORDINAT.read_text(encoding="utf-8"))
    return {int(k): v for k, v in isi.items()}


def baca_sheet(ws, label, satuan, koordinat):
    rows = list(ws.iter_rows(values_only=True))
    hdr = baris_judul(rows)
    peta = peta_judul(rows, hdr)
    kol = {k: cari(peta, v) for k, v in JUDUL.items()}
    # Sebagian sheet hanya punya target MAX per minggu, bukan per bulan.
    _, judul_max = cari_judul(peta, JUDUL["tgtMax"])
    max_per_minggu = judul_max == "TGT/WK MAX"

    hilang = [k for k in WAJIB if kol[k] is None]
    if hilang:
        raise SystemExit(f"{ws.title}: kolom wajib tidak ketemu: {', '.join(hilang)}")

    k_minggu = kolom_minggu(rows, hdr)
    strata, ukuran = baca_strata(rows, ws.title)

    hasil = []
    tanpa_sales = 0
    daftar_koreksi = []
    for raw in rows[hdr + 1:]:
        if num(raw[kol["no"]]) is None or not rapikan(raw[kol["nama"]]):
            continue
        sales = rapikan(raw[kol["sales"]])
        if not sales:
            tanpa_sales += 1
            continue

        tgt = num(raw[kol["tgt"]]) or 0
        total = num(raw[kol["act"]]) or 0
        weeks = ([num(raw[k_minggu + i]) for i in range(len(WEEK_LABELS))]
                 if k_minggu is not None else [None] * len(WEEK_LABELS))

        # Cashback berjalan diambil apa adanya dari file; yang dihitung sendiri
        # hanya nilainya kalau target bulan ini tercapai.
        rate_now = num(raw[kol["rate"]]) if kol["rate"] is not None else None
        cb_now = num(raw[kol["cashback"]]) if kol["cashback"] is not None else None
        if rate_now is None:
            rate_now = (cb_now / total) if (cb_now and total) else 0
        if cb_now is None:
            cb_now = round(total * (rate_now or 0))

        a1 = num(raw[kol["act1"]]) if kol["act1"] is not None else None
        a2_ = num(raw[kol["act2"]]) if kol["act2"] is not None else None
        share = (a1 / (a1 + a2_)) if (a1 is not None and a2_ is not None and (a1 + a2_)) else 1.0
        tipe_outlet = rapikan(raw[kol["tipe"]]) if kol["tipe"] is not None else ""
        rate_tgt, zona_tgt_strata = tarif_di(strata, tipe_outlet, tgt / len(WEEK_LABELS), share)
        cb_tgt = round(tgt * rate_tgt)

        # Kolom ACT di file pernah tidak sama dengan jumlah mingguannya sendiri
        # (rumus satu baris melewatkan W40; ACT MIX kosong padahal ACT 1500 dan
        # 330 terisi), sementara kolom ACH di baris yang sama memakai jumlah
        # mingguan. Kalau begitu yang dipakai jumlah mingguan, dan cashback
        # berjalan dihitung ulang dari strata — angka di file ikut salah.
        koreksi = None
        kode_outlet = int(num(raw[kol["no"]]))
        nama_outlet = rapikan(raw[kol["nama"]])
        if k_minggu is not None:
            jumlah = sum(w for w in weeks if w is not None)
            if abs(jumlah - total) > 0.5:
                koreksi = {"jenis": "act", "act": total, "minggu": round(jumlah, 2)}
                total = jumlah
                daftar_koreksi.append(f"{kode_outlet} {nama_outlet} — ACT di file {koreksi['act']:,.0f}, "
                                      f"jumlah mingguan {jumlah:,.0f}; dipakai jumlah mingguan")

        # Kolom zona, tarif, dan cashback di file pernah tidak ikut dihitung
        # ulang setelah realisasi minggu baru masuk (masih angka minggu lalu),
        # padahal ACT dan ACH-nya sudah baru. Tiap baris karena itu dihitung
        # ulang dari strata dengan aturan programnya; kalau berbeda dari file,
        # hasil hitungan yang dipakai dan barisnya ditandai.
        zona_final = rapikan(raw[kol["zonaTgt"]]) if kol["zonaTgt"] is not None else ""
        rate_m, zona_m, cb_m, aturan = cashback_model(
            label, strata, tipe_outlet, total, tgt, share, zona_final)
        zona_hitung = None
        if strata and (koreksi or abs((cb_now or 0) - cb_m) > max(2, cb_m * 0.002)):
            if koreksi is None:
                koreksi = {"jenis": "cashback", "cbFile": round(cb_now or 0), "cbModel": cb_m}
                daftar_koreksi.append(f"{kode_outlet} {nama_outlet} — cashback di file "
                                      f"Rp {cb_now or 0:,.0f}, hitungan Rp {cb_m:,.0f} "
                                      f"(realisasi {total:,.0f}{', ' + aturan if aturan else ''})")
            if aturan:
                koreksi["aturan"] = aturan
            rate_now, cb_now, zona_hitung = rate_m, cb_m, zona_m

        tgt_max = num(raw[kol["tgtMax"]]) if kol["tgtMax"] is not None else None
        if tgt_max is not None and max_per_minggu:
            tgt_max = round(tgt_max * len(WEEK_LABELS), 2)

        zona_now = rapikan(raw[kol["zona"]]) if kol["zona"] is not None else ""
        if zona_hitung is not None:
            zona_now = zona_hitung
        zona_tgt = rapikan(raw[kol["zonaTgt"]]) if kol["zonaTgt"] is not None else zona_tgt_strata

        tercapai = tgt > 0 and total >= tgt
        status = ("aman" if tercapai else
                  "retur" if total < 0 else
                  "nol" if total <= 0 else
                  "gugur" if not cb_now and not tercapai and zona_now in ("", "-") else
                  "kurang")

        baris = {
            "sales": sales,
            "wilayah": rapikan(raw[kol["wilayah"]]),
            "region": "",
            "kecamatan": rapikan(raw[kol["kecamatan"]]) if kol["kecamatan"] is not None else "",
            "kelurahan": rapikan(raw[kol["kelurahan"]]) if kol["kelurahan"] is not None else "",
            "no": int(num(raw[kol["no"]])),
            "nama": rapikan(raw[kol["nama"]]),
            "alamat": rapikan(raw[kol["alamat"]]) if kol["alamat"] is not None else "",
            "tipe": rapikan(raw[kol["tipe"]]) if kol["tipe"] is not None else "",
            "channel": rapikan(raw[kol["channel"]]) if kol["channel"] is not None else "",
            "ket": rapikan(raw[kol["ket"]]),
            "spk": rapikan(raw[kol["ket"]]).upper().startswith("FIX"),
            "zona": zona_tgt if zona_tgt not in ("", "-") else "",
            "diskon": None,
            "tgtWeek": num(raw[kol["tgtWeek"]]) if kol["tgtWeek"] is not None else None,
            "tgt": round(tgt, 2),
            "tgtMax": tgt_max,
            # Target final tiap outlet bisa memakai dasar MID atau MAX.
            "pilih": rapikan(raw[kol["pilih"]]).upper() if kol["pilih"] is not None else "",
            "weeks": weeks,
            "total": round(total, 2),
            # Komposisi ukuran utama (LM 1500+330), dipakai simulasi harga.
            "share": round(share, 4) if share != 1.0 else None,
            "history": riwayat(rows, hdr, raw),
            "koreksi": koreksi,
            "cb": {
                "tarif": round(rate_now or 0),
                "tarifTgt": round(rate_tgt),
                "zona": zona_now if zona_now != "-" else "",
                "zonaTgt": zona_tgt if zona_tgt != "-" else "",
                "now": round(cb_now or 0),
                "target": cb_tgt,
                "sisa": max(cb_tgt - round(cb_now or 0), 0),
                "kurangUnit": round(max(tgt - total, 0), 2),
                "status": status,
                "syaratAch": label == "Nipis Madu",
            },
        }
        titik = koordinat.get(baris["no"])
        if titik:
            baris["lat"], baris["lng"] = titik
        hasil.append(baris)

    for teks in daftar_koreksi:
        print(f"  ! {ws.title}: {teks}")
    return hasil, tanpa_sales, strata_web(strata), ukuran


def simulasi_tersimpan():
    """Data simulasi harga dari data.js yang sekarang, kalau ada."""
    lama = ROOT / "data.js"
    if not lama.exists():
        return None
    teks = lama.read_text(encoding="utf-8")
    try:
        awal = teks.index("=") + 1
        akhir = teks.rstrip().rstrip(";").rfind("}") + 1
        return json.loads(teks[awal:akhir]).get("simulasi")
    except ValueError:
        return None


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python3 web/tools/build_ikat.py <berkas.xlsx>")
    xlsx = Path(sys.argv[1])
    if not xlsx.exists():
        sys.exit(f"File tidak ditemukan: {xlsx}")

    wb = openpyxl.load_workbook(xlsx, data_only=True)
    koordinat = koordinat_tersimpan()
    if koordinat:
        print(f"  koordinat tersimpan: {len(koordinat)} outlet")

    products = []
    sheet_galon = []
    for ws in wb.worksheets:
        if simulasi.sheet_simulasi(ws.title):
            continue  # dibaca terpisah di bawah
        if galon.sheet_galon(ws.title):
            sheet_galon.append(ws)  # bentuknya lain, dibaca setelah IKAT
            continue
        label, satuan = label_produk(ws.title)
        if label is None:
            print(f"  ! sheet '{ws.title}' dilewati (produknya tidak dikenali)")
            continue
        rows, tanpa, strata, ukuran = baca_sheet(ws, label, satuan, koordinat)
        if not rows:
            continue
        products.append({
            "id": ws.title.strip(),
            "label": label,
            "satuan": satuan,
            "zonaLabel": "Zona",
            # Strata ikut ke web supaya simulasi harga bisa menghitung zona dan
            # tarif pada volume berapa pun, bukan cuma pada target.
            "strata": strata,
            "ukuran": ukuran,
            "rows": rows,
        })
        catatan = f"  (+{tanpa} tanpa salesman, dilewati)" if tanpa else ""
        print(f"  {label:<14} {len(rows):>4} outlet{catatan}")

    peta_sales = perbarui_salesman(salesman_tersimpan(), products)

    if sheet_galon:
        prod, lap = galon.baca(sheet_galon, WEEK_LABELS, peta_sales, koordinat)
        lewat = sum(lap["lewat"].values())
        if prod:
            products.append(prod)
            print(f"  {'Galon 15L':<14} {len(prod['rows']):>4} outlet  (+{lewat} tanpa salesman, dilewati)")
        for subdist, jml in sorted(lap["lewat"].items()):
            print(f"      dilewati {jml:>3} outlet {subdist}")
        cek = lap["cek"]
        print(f"      tarif tercetak vs strata: cocok {cek['cocok']}, beda {len(cek['beda'])}")
        for kode, nama, total, rate, model in cek["beda"]:
            print(f"      ! {kode} {nama}: {total:,.0f} galon, file Rp {rate:,.0f}, strata Rp {model:,.0f}")

    data = {
        "periode": PERIODE,
        "weekLabels": WEEK_LABELS,
        "labels": {"wilayah": "Rayon"},
        "sumber": re.sub(r"^[0-9a-f]{6,}-", "", xlsx.name),
        "tanggal": date.today().isoformat(),
        "products": products,
    }

    # Sheet "SIMULASI NETT ..." membawa price list, tangga DOF, dan bonus yang
    # tidak ada di sheet target; itulah dasar simulasi harga di web.
    sim = simulasi.baca(wb, len(WEEK_LABELS))
    if sim:
        data["simulasi"] = sim
        bagian = [k for k in ("tph", "lm") if sim.get(k)]
        print(f"  simulasi harga: {', '.join(bagian)}")
    else:
        # Update mingguan sering dikirim tanpa sheet simulasi. Price list dan
        # tabel program tidak berubah tiap minggu, jadi yang lama dipakai lagi
        # supaya simulasi harga di web tidak ikut hilang.
        lama = simulasi_tersimpan()
        if lama:
            lama["nweek"] = len(WEEK_LABELS)
            data["simulasi"] = lama
            print("  simulasi harga: tidak ada di workbook, dipakai yang tersimpan")
        else:
            print("  ! sheet simulasi harga tidak ada di workbook ini")
    out = ROOT / "data.js"
    out.write_text(
        "// Dibuat otomatis oleh tools/build_ikat.py — jangan diedit manual.\n"
        f"window.MASTER_DATA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    total = sum(len(p["rows"]) for p in products)
    sisa = sum(r["cb"]["sisa"] for p in products for r in p["rows"])
    print(f"-> web/data.js ({total} baris, sisa cashback Rp {sisa:,.0f})")


if __name__ == "__main__":
    main()
