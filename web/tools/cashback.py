"""Aturan cashback ikat target, hasil pembacaan form monitoring resmi.

Tiap program punya tabel strata: volume omset sebulan menentukan zona, dan
zona menentukan tarif rupiah per karton (atau per galon). Cashback = omset x
tarif — bukan target x tarif — jadi tarifnya ikut naik/turun mengikuti berapa
banyak yang benar-benar diambil toko.

Tabel di bawah adalah strata SEPTEMBER 2026. Bandnya berubah tiap bulan
mengikuti jumlah minggu (September 5 minggu, Juli/Agustus 4), jadi tabel ini
harus disegarkan tiap kali form monitoring bulan baru datang, lalu diuji
ulang dengan tools/uji_cashback.py.

Model ini diuji terhadap kolom cashback yang sudah tercetak di form
monitoring Q3 JAKTIM & BEKASI update W37 — 294 baris September, semuanya
cocok.

Sumber tarif di workbook itu:
    LM 600 / LM 1500+330  sheet 'STRATA LM ...' (kolom September)
    TPH                   sheet 'STRATA TPH (3)'
    Nipis Madu            sheet 'MASTER (5)' kolom 'SEP (5 WEEK)'
    Galon 15L             kolom 'POT. DISCOUNT/GALON' di sheet galon
"""

# Tiap baris: (batas bawah omset, zona, tarif Rp/crt). Urut dari besar ke kecil.
STRATA = {
    "LM600": [(12500, "A", 1100), (7500, "B", 900), (3250, "C", 800),
              (1250, "D", 700), (500, "E", 600)],
    # September menyamakan tarif LM 1500ML dan 330ML; Agustus masih membedakan.
    "LM1500": [(7500, "A", 1100), (5000, "B", 900), (2500, "C", 800),
               (1250, "D", 700), (500, "E", 600)],
    "TPH_SO": [(50000, "A+", 2000), (35000, "A", 1750), (25000, "B", 1400),
               (12500, "C", 1100), (5000, "D", 900)],
    "TPH_GROMIN": [(1250, "E", 1000), (500, "F", 800), (250, "G", 600)],
    "NMAD": [(3000, "A", 1000), (2000, "B", 900), (1000, "C", 700),
             (325, "D", 500), (200, "E", 300)],
    "GALON_SO": [(100000, "", 750), (25000, "", 600), (10000, "", 550),
                 (7500, "", 500), (5000, "", 400), (1500, "", 300)],
    "GALON_GROMIN": [(1000, "", 600), (500, "", 500), (300, "", 350)],
}

# Urutan zona dipakai untuk aturan turun zona pada LM.
PERINGKAT = {"E": 1, "D": 2, "C": 3, "B": 4, "A": 5, "A+": 6, "G": 1, "F": 2}

# Nipis Madu hanya membayar cashback kalau target bulan itu tercapai; program
# lain membayar mengikuti volume berapa pun.
SYARAT_ACH = {"NMAD"}

# LM tetap membayar meski zona akhir turun dari zona SPK — di form monitoring
# September ada 19 baris turun satu tingkat dan 2 baris turun dua tingkat yang
# semuanya tetap dibayar sebagai "TURUN ZONA". Yang benar-benar menggugurkan
# adalah omset yang jatuh di bawah band terendah, dan turun tiga tingkat atau
# lebih (satu-satunya contoh: baris GUGUR di form Agustus yang turun empat).
MAKS_TURUN_ZONA = 2


def tabel_untuk(produk, tipe_outlet):
    """Nama tabel strata untuk satu produk, sebagian tergantung tipe outlet."""
    t = (tipe_outlet or "").upper()
    if produk == "TPH":
        return "TPH_SO" if t == "SO" else "TPH_GROMIN"
    if produk == "GALON":
        return "GALON_SO" if t == "SO" else "GALON_GROMIN"
    return produk


def baris_strata(tabel, omset):
    """Baris strata untuk suatu volume, atau None kalau di bawah band terendah."""
    for baris in STRATA[tabel]:
        if omset >= baris[0]:
            return baris
    return None


def tarif(tabel, omset):
    """Tarif rupiah per karton/galon untuk suatu volume. 0 kalau tidak dapat."""
    baris = baris_strata(tabel, omset)
    if baris is None:
        return 0, None
    return baris[2], baris[1]


def hitung(produk, tipe_outlet, target, omset):
    """Cashback bulan berjalan untuk satu outlet.

    Mengembalikan tarif sekarang, cashback yang sudah aman, cashback kalau
    target tercapai, dan selisihnya — yaitu yang masih bisa dikejar bulan ini.
    """
    tabel = tabel_untuk(produk, tipe_outlet)
    target = target or 0
    omset = omset or 0

    tarif_now, zona_now = tarif(tabel, omset)
    tarif_tgt, zona_tgt = tarif(tabel, target)

    # Turun zona terlalu jauh dari zona SPK menggugurkan cashback (khusus LM).
    gugur = False
    if produk in ("LM600", "LM1500") and zona_tgt and omset:
        turun = PERINGKAT.get(zona_tgt, 0) - PERINGKAT.get(zona_now, 0)
        if turun > MAKS_TURUN_ZONA:
            gugur = True

    tercapai = target > 0 and omset >= target
    butuh_ach = produk in SYARAT_ACH

    cb_now = 0 if (gugur or (butuh_ach and not tercapai)) else round(omset * tarif_now)
    cb_tgt = round(target * tarif_tgt)
    sisa = max(cb_tgt - cb_now, 0)

    if gugur:
        status = "gugur"
    elif omset <= 0:
        status = "nol"
    elif tercapai:
        status = "aman"
    else:
        status = "kurang"

    return {
        "tarif": round(tarif_now),
        "tarifTgt": round(tarif_tgt),
        "zona": zona_now or "",
        "zonaTgt": zona_tgt or "",
        "now": cb_now,
        "target": cb_tgt,
        "sisa": sisa,
        "kurangUnit": round(max(target - omset, 0), 2),
        "status": status,
        "syaratAch": butuh_ach,
    }
