#!/usr/bin/env python3
"""Uji tabel strata di cashback.py terhadap form monitoring resmi.

Form monitoring sudah memuat kolom cashback yang dihitung kantor. Skrip ini
menghitung ulang angka itu dari tabel strata, lalu membandingkannya baris per
baris. Kalau ada tabel yang salah ketik, selisihnya langsung kelihatan di sini
alih-alih diam-diam masuk ke web.

Pakai:  python3 web/tools/uji_cashback.py <folder berisi form monitoring>
"""

import sys
from pathlib import Path

import openpyxl
import xlrd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cashback  # noqa: E402

# Nama berkas dicocokkan sebagian karena unggahan sering diberi awalan acak.
FORM = {
    "lm600": "IKAT_TARGET_LM_600",
    "lm1500": "IKAT_TARGET_LM_1500",
    "tph": "IKAT_TARGET_TPH",
    "nmad": "IKAT_TARGET_NIPIS_MADU",
    "galon": "CASHBACK_DISCOUNT_SO_GRM",
}


def angka(x):
    return x if isinstance(x, (int, float)) else None


def cari_berkas(folder, potongan):
    for p in sorted(Path(folder).iterdir()):
        if potongan.lower() in p.name.lower():
            return p
    return None


def uji(nama, baris):
    """baris: (omset, ach, cashback_tercetak, tarif_model, syarat_ach)"""
    cocok = beda = 0
    contoh = []
    for omset, ach, tercetak, tarif, syarat in baris:
        lolos = (not syarat) or (ach is not None and ach >= 1)
        hitung = round(omset * tarif) if (tarif and lolos) else 0
        if abs(hitung - (tercetak or 0)) < 1:
            cocok += 1
        else:
            beda += 1
            if len(contoh) < 3:
                contoh.append((omset, ach, tercetak, hitung))
    print(f"  {nama:22} {cocok:4} cocok / {cocok + beda:4} baris" +
          ("" if not beda else f"   <-- {beda} BEDA"))
    for omset, ach, tercetak, hitung in contoh:
        a = "-" if ach is None else f"{ach:.3f}"
        print(f"      omset={omset:9,.0f} ach={a} tercetak={tercetak:,.0f} model={hitung:,.0f}")
    return beda


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    total_beda = 0

    p = cari_berkas(folder, FORM["lm600"])
    if p:
        s = xlrd.open_workbook(p).sheet_by_name("MONITORING LM Q3.2026")
        baris = []
        for i in range(7, s.nrows):
            if not str(s.cell_value(i, 5)).strip():
                continue
            omset = angka(s.cell_value(i, 56)) or 0
            # Baris GUGUR diuji lewat aturan turun zona, bukan lewat tabel tarif.
            if not omset or str(s.cell_value(i, 64)).strip() == "GUGUR":
                continue
            # Kolom Agustus memakai band Jul-Aug, bukan band September.
            t = tarif_julaug("LM600", omset)
            baris.append((omset, angka(s.cell_value(i, 58)), angka(s.cell_value(i, 62)) or 0, t, False))
        total_beda += uji("LM 600 (Agustus)", baris)

    p = cari_berkas(folder, FORM["lm1500"])
    if p:
        s = xlrd.open_workbook(p).sheet_by_name("MONITORING LM Q3.2026")
        b15, b33 = [], []
        for i in range(7, s.nrows):
            if not str(s.cell_value(i, 5)).strip():
                continue
            total = angka(s.cell_value(i, 69)) or 0
            if not total or str(s.cell_value(i, 78)).strip() == "GUGUR":
                continue
            t15, t33 = tarif_julaug("LM1500", total, dua=True)
            ach = angka(s.cell_value(i, 71))
            b15.append((angka(s.cell_value(i, 63)) or 0, ach, angka(s.cell_value(i, 75)) or 0, t15, False))
            b33.append((angka(s.cell_value(i, 68)) or 0, ach, angka(s.cell_value(i, 76)) or 0, t33, False))
        total_beda += uji("LM 1500ML (Agustus)", b15)
        total_beda += uji("LM 330ML (Agustus)", b33)

    p = cari_berkas(folder, FORM["tph"])
    if p:
        wb = xlrd.open_workbook(p)
        for sheet, tabel in [("SO", "TPH_SO"), ("GROMIN", "TPH_GROMIN")]:
            s = wb.sheet_by_name(sheet)
            baris = []
            for i in range(7, s.nrows):
                if not str(s.cell_value(i, 5)).strip():
                    continue
                omset = angka(s.cell_value(i, 37)) or 0
                if not omset:
                    continue
                t, _ = cashback.tarif(tabel, omset)
                baris.append((omset, angka(s.cell_value(i, 38)), angka(s.cell_value(i, 43)) or 0, t, False))
            total_beda += uji(f"TPH {sheet} (Agustus)", baris)

    p = cari_berkas(folder, FORM["nmad"])
    if p:
        ws = openpyxl.load_workbook(p, data_only=True)["MON.IKAT TARGET NMAD"]
        baris = []
        for r in list(ws.iter_rows(values_only=True))[5:]:
            if not r[5]:
                continue
            omset = angka(r[36]) or 0
            if not omset:
                continue
            t, _ = cashback.tarif("NMAD", omset)
            baris.append((omset, angka(r[37]), angka(r[40]) or 0, t, True))
        total_beda += uji("Nipis Madu (Agustus)", baris)

    p = cari_berkas(folder, FORM["galon"])
    if p:
        wb = xlrd.open_workbook(p)
        for sheet, tabel in [("CASHBACK_SO_GALON", "GALON_SO"), ("CASHBACK_GRM_GALON", "GALON_GROMIN")]:
            s = wb.sheet_by_name(sheet)
            baris = []
            for i in range(13, s.nrows):
                if not str(s.cell_value(i, 4)).strip():
                    continue
                omset = angka(s.cell_value(i, 13)) or 0
                if not omset:
                    continue
                t, _ = cashback.tarif(tabel, omset)
                baris.append((omset, None, angka(s.cell_value(i, 15)) or 0, t, False))
            total_beda += uji(f"{sheet} (Agustus)", baris)

    print()
    print("Semua cocok." if not total_beda else f"{total_beda} baris tidak cocok — periksa tabel strata.")
    return 1 if total_beda else 0


# Band volume bulan Juli-Agustus berbeda dari September (September 5 minggu),
# sedangkan cashback.py menyimpan band September yang dipakai web.
BAND_JULAUG = {
    "LM600": [(10000, 1100), (6000, 900), (2600, 800), (1000, 700), (400, 600)],
    "LM1500": [(6000, 1100, 500), (4000, 900, 500), (2000, 800, 400), (1000, 700, 400), (400, 600, 300)],
}


def tarif_julaug(tabel, omset, dua=False):
    for baris in BAND_JULAUG[tabel]:
        if omset >= baris[0]:
            return (baris[1], baris[2]) if dua else baris[1]
    return (0, 0) if dua else 0


if __name__ == "__main__":
    sys.exit(main())
