"""Baca sheet "SIMULASI NETT ..." jadi data simulasi harga untuk web.

Workbook target memuat dua sheet simulasi yang disusun dari surat program:

    SIMULASI NETT TPH OKT   price list TPH per channel, tangga DOF, dan tabel
                            ikat target SO/GROMIN beserta bonus produk TPH350
    SIMULASI NETT LM OKT    tabel nett DOF LM (sudah berupa harga, bukan
                            potongan), kenaikan price list, serta tabel ikat
                            target LM 600 dan LM 1500+330 beserta bonus triwulan

Yang dibaca hanya tabel acuannya — baris contoh outlet di sebelah kiri tidak
ikut, karena web menghitung sendiri dari angka yang diisi sales.

Semua tabel dicari lewat JUDULNYA, bukan posisinya, supaya sheet boleh digeser
atau ditambah kolom tanpa merusak pembacaan.
"""

import re

JUDUL_SHEET = ("SIMULASI NETT TPH", "SIMULASI NETT LM")


def rapikan(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def kunci(v):
    return rapikan(v).upper()


def num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return round(float(v), 4)


def angka_dalam(v):
    """Angka di dalam teks seperti '≥500 + syarat*' -> 500."""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    cocok = re.search(r"\d+(?:[.,]\d+)?", str(v or ""))
    return float(cocok.group().replace(",", ".")) if cocok else None


def cari_sel(rows, awalan):
    """Posisi (baris, kolom) sel pertama yang judulnya diawali teks ini."""
    besar = awalan.upper()
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            if kunci(v).startswith(besar):
                return i, j
    return None, None


def tabel_di(rows, baris_judul, kolom, lebar):
    """Baris tabel di bawah satu baris judul, berhenti di baris kosong.

    Kembalikan (daftar judul kolom, daftar baris nilai).
    """
    judul = [rapikan(rows[baris_judul][kolom + k]) if kolom + k < len(rows[baris_judul]) else ""
             for k in range(lebar)]
    isi = []
    for r in rows[baris_judul + 1:]:
        sel = [r[kolom + k] if kolom + k < len(r) else None for k in range(lebar)]
        if all(v is None or rapikan(v) == "" for v in sel):
            break
        isi.append(sel)
    return judul, isi


def catatan_kiri(rows, kolom=1):
    """Catatan aturan yang ditulis di kolom kiri sheet."""
    hasil = []
    for r in rows:
        teks = rapikan(r[kolom]) if kolom < len(r) else ""
        if teks.startswith(("*", "•", "Source:")):
            hasil.append(teks)
    return hasil


# ── TPH ──────────────────────────────────────────────────────────────────
def baca_tph(ws):
    rows = list(ws.iter_rows(values_only=True))

    # Price list: satu baris per channel, kolom LAMA/BARU tiap ukuran.
    i, j = cari_sel(rows, "PRICE LIST TPH")
    if i is None:
        return None
    judul, isi = tabel_di(rows, i + 1, j, 5)
    pl = {}
    for baris in isi:
        channel = kunci(baris[0])
        if not channel:
            continue
        harga = {}
        for k in range(1, 5):
            # Judul kolom: '350 LAMA (s/d 6 Okt)' -> ukuran 350, versi lama.
            bagian = kunci(judul[k]).split()
            nilai = num(baris[k])
            if len(bagian) >= 2 and nilai is not None:
                harga.setdefault(bagian[0], {})[bagian[1].lower()] = nilai
        pl[channel] = harga

    # Tangga DOF: potongan rupiah per karton menurut qty mix 350+500.
    # Judul lengkap, supaya tidak tertukar dengan kalimat pengantar sheet.
    i, j = cari_sel(rows, "DOF TPH (QTY MIX")
    _, isi = tabel_di(rows, i + 1, j, 2)
    dof = []
    for baris in isi:
        minimum = angka_dalam(baris[0])
        potong = num(baris[1])
        if minimum is None or potong is None:
            continue
        # Baris terakhir ('≥500 + syarat*') memakai ambang yang sama tetapi
        # butuh syarat tambahan, jadi ditandai supaya web bisa menanyakannya.
        syarat = not isinstance(baris[0], (int, float))
        dof.append({"min": minimum, "disc": potong, "syarat": syarat})

    ikat = {}
    for tipe in ("SO", "GROMIN"):
        i, j = cari_sel(rows, "IKAT TARGET " + tipe)
        if i is None:
            continue
        _, isi = tabel_di(rows, i + 1, j, 4)
        tabel = []
        for baris in isi:
            minimum, zona, cb, bonus = (num(baris[0]), rapikan(baris[1]),
                                        num(baris[2]), num(baris[3]))
            if minimum is None or not zona or zona == "-":
                continue
            tabel.append({"min": minimum, "zona": zona, "cb": cb or 0,
                          "bonus": bonus or 0})
        ikat[tipe] = sorted(tabel, key=lambda b: b["min"], reverse=True)

    return {"pl": pl, "dof": sorted(dof, key=lambda b: (b["min"], b["syarat"])),
            "ikat": ikat, "catatan": catatan_kiri(rows)}


# ── Le Minerale ──────────────────────────────────────────────────────────
def baca_lm(ws):
    rows = list(ws.iter_rows(values_only=True))

    # Tabel nett DOF: isinya HARGA setelah DOF, per ukuran x channel,
    # bertingkat menurut qty mix empat SKU.
    i, j = cari_sel(rows, "NETT DOF LM")
    if i is None:
        return None
    judul, isi = tabel_di(rows, i + 1, j, 10)
    kolom = []
    for k in range(1, 10):
        bagian = kunci(judul[k]).split()      # '600 RETAIL' -> ukuran, channel
        kolom.append(tuple(bagian[:2]) if len(bagian) >= 2 else None)

    nett, kenaikan = [], {}
    for baris in isi:
        if kunci(baris[0]).startswith("KENAIKAN"):
            for k, info in enumerate(kolom, start=1):
                if info and num(baris[k]) is not None:
                    kenaikan[info[0]] = num(baris[k])
            continue
        minimum = num(baris[0])
        if minimum is None:
            continue
        harga = {}
        for k, info in enumerate(kolom, start=1):
            if info and num(baris[k]) is not None:
                harga.setdefault(info[0], {})[info[1]] = num(baris[k])
        nett.append({"min": minimum, "harga": harga})
    nett.sort(key=lambda b: b["min"], reverse=True)

    def ikat(awalan, kunci_rate):
        i, j = cari_sel(rows, awalan)
        if i is None:
            return []
        _, isi = tabel_di(rows, i + 1, j, 1 + len(kunci_rate))
        tabel = []
        for baris in isi:
            minimum, zona = num(baris[0]), rapikan(baris[1])
            if minimum is None or not zona or zona == "-":
                continue
            b = {"min": minimum, "zona": zona}
            for k, nama in enumerate(kunci_rate[2:], start=2):
                b[nama] = num(baris[k]) or 0
            tabel.append(b)
        return sorted(tabel, key=lambda b: b["min"], reverse=True)

    # Kolom tabel ikat: MIN CRT/WK, ZONA, lalu tarif dan bonus triwulan.
    ikat600 = ikat("IKAT TARGET LM 600", ["min", "zona", "cb", "tw90", "tw100"])
    ikatMix = ikat("IKAT TARGET LM 1500",
                   ["min", "zona", "cb", "cb330", "tw90", "tw100", "tw330"])

    return {"nett": nett, "kenaikan": kenaikan, "ikat600": ikat600,
            "ikatMix": ikatMix, "catatan": catatan_kiri(rows)}


def baca(wb, minggu):
    """Kumpulkan data simulasi dari workbook, kalau sheetnya ada."""
    hasil = {"nweek": minggu}
    for ws in wb.worksheets:
        atas = ws.title.upper()
        if atas.startswith("SIMULASI NETT TPH"):
            hasil["tph"] = baca_tph(ws)
        elif atas.startswith("SIMULASI NETT LM"):
            hasil["lm"] = baca_lm(ws)
    if "tph" not in hasil and "lm" not in hasil:
        return None
    return hasil


def sheet_simulasi(nama):
    return nama.upper().startswith(JUDUL_SHEET)
