"""Aturan cashback ikat target, hasil pembacaan form monitoring resmi.

Tiap program punya tabel strata: volume omset sebulan menentukan zona, dan
zona menentukan tarif rupiah per karton (atau per galon). Cashback = omset x
tarif — bukan target x tarif — jadi tarifnya ikut naik/turun mengikuti berapa
banyak yang benar-benar diambil toko.

Model ini diuji ulang terhadap kolom cashback yang sudah tercetak di form
monitoring Agustus 2026 region JUP (lihat tools/uji_cashback.py):

    LM 600            53 dari 53 baris cocok
    LM 1500ML          41 dari 42     (1 baris GUGUR karena turun 4 zona)
    LM 330ML           42 dari 42
    TPH SO              9 dari 9
    TPH GROMIN         48 dari 48
    Nipis Madu         75 dari 75     (hanya dibayar kalau ACH >= 100%)
    Galon 15L SO       20 dari 20
    Galon 15L GROMIN   90 dari 90

Sumber tarif:
    LM 600 / LM 1500+330  sheet 'STRATA LM' (kolom September)
    TPH                   sheet 'STRATA TPH'
    Nipis Madu            sheet 'MASTER' form NMAD
    Galon 15L             sheet 'MASTER' form cashback galon
"""

# Tiap baris: (batas bawah omset, zona, tarif Rp/crt). Urut dari besar ke kecil.
STRATA = {
    "LM600": [(12500, "A", 1100), (7500, "B", 900), (3250, "C", 800),
              (1250, "D", 700), (500, "E", 600)],
    # LM 1500+330 punya dua tarif: (batas, zona, tarif 1500ML, tarif 330ML)
    "LM1500": [(7500, "A", 1100, 500), (5000, "B", 900, 500), (2500, "C", 800, 400),
               (1250, "D", 700, 400), (500, "E", 600, 300)],
    "TPH_SO": [(40000, "A+", 2000), (28000, "A", 1750), (20000, "B", 1400),
               (10000, "C", 1100), (4000, "D", 900)],
    "TPH_GROMIN": [(1000, "E", 1000), (400, "F", 800), (200, "G", 600)],
    "NMAD": [(2400, "A", 1000), (1600, "B", 900), (800, "C", 700),
             (250, "D", 500), (150, "E", 300)],
    "GALON_SO": [(100000, "", 750), (25000, "", 600), (10000, "", 550),
                 (7500, "", 500), (5000, "", 400), (1500, "", 300)],
    "GALON_GROMIN": [(1000, "", 600), (500, "", 500), (300, "", 350)],
}

# Urutan zona dipakai untuk aturan turun zona pada LM.
PERINGKAT = {"E": 1, "D": 2, "C": 3, "B": 4, "A": 5, "A+": 6, "G": 1, "F": 2}

# Nipis Madu hanya membayar cashback kalau target bulan itu tercapai; program
# lain membayar mengikuti volume berapa pun.
SYARAT_ACH = {"NMAD"}

# LM menggugurkan cashback kalau zona akhir jatuh dua tingkat atau lebih di
# bawah zona SPK. Turun satu tingkat masih dibayar ("TURUN ZONA").
MAKS_TURUN_ZONA = 1


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


def tarif(tabel, omset, share1500=None):
    """Tarif rupiah per karton/galon untuk suatu volume. 0 kalau tidak dapat."""
    baris = baris_strata(tabel, omset)
    if baris is None:
        return 0, None
    if tabel == "LM1500":
        # Ukuran 1500ML dan 330ML tarifnya beda, sedangkan omset di file target
        # sudah tergabung. Komposisinya diambil dari riwayat outlet itu sendiri.
        s = 1.0 if share1500 is None else share1500
        return baris[2] * s + baris[3] * (1 - s), baris[1]
    return baris[2], baris[1]


def hitung(produk, tipe_outlet, target, omset, share1500=None):
    """Cashback bulan berjalan untuk satu outlet.

    Mengembalikan tarif sekarang, cashback yang sudah aman, cashback kalau
    target tercapai, dan selisihnya — yaitu yang masih bisa dikejar bulan ini.
    """
    tabel = tabel_untuk(produk, tipe_outlet)
    target = target or 0
    omset = omset or 0

    tarif_now, zona_now = tarif(tabel, omset, share1500)
    tarif_tgt, zona_tgt = tarif(tabel, target, share1500)

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
