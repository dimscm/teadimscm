"""Uji simulasi harga di web terhadap baris contoh di sheet simulasi.

Tiap contoh di sheet "SIMULASI NETT ..." sudah berisi hasil yang dihitung
kantor, jadi dipakai sebagai kunci jawaban: isian yang sama di web harus
menghasilkan angka yang sama sampai rupiah terakhir.

Pakai:  python3 web/tools/uji_simulasi.py
        (butuh playwright + chromium; keluar dengan kode 1 kalau ada yang beda)
"""
import sys
import re
from playwright.sync_api import sync_playwright


# (nama, produk, isian, harapan {label rincian: nilai})
CONTOH = [
    ("TPH S3 (SO)", "TPH",
     {"s-channel": "SO", "s-pl": "baru", "s-q1": 20000, "s-q2": 20000,
      "s-capai": "ya", "s-w03": "ya", "s-syarat": "ya"},
     {"Total mix (350 + 500)": "40.000 crt", "DOF per crt": "Rp 900 — potongan di faktur",
      "Harga faktur 350 / 500": "Rp 60.600 / Rp 56.600", "Zona ikat target": "A+",
      "Cashback per crt": "Rp 2.000 — cair bulan depan", "Total cashback": "Rp 80.000.000 — cair bulan depan",
      "Bonus TPH 350": "65 crt · Rp 3.939.000", "Bonus per crt": "Rp 98"},
     {"Nett 350 akhir": "Rp 58.502", "Nett 500 akhir": "Rp 54.502",
      "Total benefit": "Rp 119.939.000"}),

    ("TPH GROMIN", "TPH",
     {"s-channel": "GROMIN", "s-pl": "baru", "s-q1": 600, "s-q2": 400,
      "s-capai": "ya", "s-w03": "ya", "s-syarat": "tidak"},
     {"Total mix (350 + 500)": "1.000 crt", "DOF per crt": "Rp 700 — potongan di faktur",
      "Harga faktur 350 / 500": "Rp 61.300 / Rp 57.300", "Zona ikat target": "E",
      "Cashback per crt": "Rp 1.000 — cair bulan depan", "Total cashback": "Rp 1.000.000 — cair bulan depan",
      "Bonus TPH 350": "8 crt · Rp 490.400", "Bonus per crt": "Rp 490"},
     {"Nett 350 akhir": "Rp 59.810", "Nett 500 akhir": "Rp 55.810",
      "Total benefit": "Rp 2.190.400"}),

    ("TPH SO 2 (W03 tidak)", "TPH",
     {"s-channel": "SO", "s-pl": "baru", "s-q1": 8000, "s-q2": 4000,
      "s-capai": "ya", "s-w03": "tidak", "s-syarat": "tidak"},
     {"Total mix (350 + 500)": "12.000 crt", "DOF per crt": "Rp 700 — potongan di faktur",
      "Harga faktur 350 / 500": "Rp 60.800 / Rp 56.800", "Zona ikat target": "C",
      "Cashback per crt": "Rp 1.100 — cair bulan depan", "Total cashback": "Rp 13.200.000 — cair bulan depan",
      "Bonus TPH 350": "tidak dapat"},
     {"Nett 350 akhir": "Rp 59.700", "Nett 500 akhir": "Rp 55.700",
      "Total benefit": "Rp 21.600.000"}),

    ("LM600 EKA JAYA (GROMIN)", "LM 600",
     {"s-channel": "GROMIN", "s-pl": "baru", "s-q1": 3860, "s-qlain": 500, "s-tw": "≥100%"},
     {"Total mix DOF": "4.360 crt", "Harga faktur (nett DOF)": "Rp 43.600",
      "Rata-rata per minggu": "965 crt (4 minggu)", "Zona ikat target": "C",
      "Cashback per crt": "Rp 800 — cair bulan depan", "Bonus triwulan per crt": "Rp 400 — cair setelah triwulan tutup",
      "Nett akhir": "Rp 42.400"},
     {"Nett 600 akhir": "Rp 42.400", "Total cashback": "Rp 3.088.000",
      "Bonus triwulan": "Rp 1.544.000"}),

    ("LM600 S3 (SO, 90-99%)", "LM 600",
     {"s-channel": "SO", "s-pl": "baru", "s-q1": 12292, "s-qlain": 1000, "s-tw": "90-99%"},
     {"Total mix DOF": "13.292 crt", "Harga faktur (nett DOF)": "Rp 42.300",
      "Rata-rata per minggu": "3.073 crt (4 minggu)", "Zona ikat target": "A",
      "Cashback per crt": "Rp 1.100 — cair bulan depan", "Bonus triwulan per crt": "Rp 500 — cair setelah triwulan tutup",
      "Nett akhir": "Rp 40.700"},
     {"Nett 600 akhir": "Rp 40.700", "Total cashback": "Rp 13.521.200",
      "Bonus triwulan": "Rp 6.146.000"}),

    ("LMMIX GROSERINDO (SO, ≥100%)", "LM 1500+330",
     {"s-channel": "SO", "s-pl": "baru", "s-q1": 6000, "s-q2": 1500,
      "s-qlain": 500, "s-tw": "≥100%"},
     {"Total mix DOF": "8.000 crt", "Harga faktur 1500 / 330 (nett DOF)": "Rp 47.600 / Rp 35.100",
      "Rata-rata per minggu": "1.875 crt (4 minggu)", "Zona ikat target": "A",
      "Cashback per crt": "Rp 1.100 / Rp 500 — cair bulan depan",
      "Bonus triwulan per crt": "Rp 700 / Rp 300 — cair setelah triwulan tutup",
      "Nett akhir 1500 / 330": "Rp 45.800 / Rp 34.300"},
     {"Nett 1500 akhir": "Rp 45.800", "Nett 330 akhir": "Rp 34.300",
      "Total cashback": "Rp 7.350.000"}),

    ("LMMIX GROMIN (BELUM)", "LM 1500+330",
     {"s-channel": "GROMIN", "s-pl": "baru", "s-q1": 1200, "s-q2": 400,
      "s-qlain": 200, "s-tw": "BELUM"},
     {"Total mix DOF": "1.800 crt", "Harga faktur 1500 / 330 (nett DOF)": "Rp 50.100 / Rp 36.100",
      "Rata-rata per minggu": "400 crt (4 minggu)", "Zona ikat target": "D",
      "Cashback per crt": "Rp 700 / Rp 400 — cair bulan depan",
      "Bonus triwulan per crt": "Rp 0 / Rp 0 — cair setelah triwulan tutup",
      "Nett akhir 1500 / 330": "Rp 49.400 / Rp 35.700"},
     {"Nett 1500 akhir": "Rp 49.400", "Nett 330 akhir": "Rp 35.700",
      "Total cashback": "Rp 1.000.000"}),
]


def bersih(t):
    return re.sub(r"\s+", " ", t).strip()


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    pg = b.new_page(viewport={"width": 1280, "height": 1000})
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)))
    pg.goto("file:///home/user/teadimscm/web/dist/master-target.html")
    pg.wait_for_selector("#list .tr")
    pg.click('#views button[data-view="simulasi"]')
    pg.wait_for_selector("#sim-out")

    gagal = 0
    for nama, produk, isian, rinci, kartu in CONTOH:
        pg.select_option("#s-produk", label=produk)
        pg.wait_for_timeout(120)
        for sel, nilai in isian.items():
            if isinstance(nilai, int):
                pg.fill("#" + sel, str(nilai))
            else:
                pg.select_option("#" + sel, nilai)
            pg.wait_for_timeout(30)
        pg.wait_for_timeout(120)

        dapat_rinci = dict(pg.eval_on_selector_all(
            "#sim-out .hist",
            "els => els.map(e => [e.querySelector('.k').textContent, e.querySelector('.v').textContent])"))
        dapat_kartu = dict(pg.eval_on_selector_all(
            "#sim-out .card",
            "els => els.map(e => [e.querySelector('.k').textContent, e.querySelector('.v').textContent])"))

        print("--", nama)
        for k, v in list(rinci.items()) + list(kartu.items()):
            sumber = dapat_rinci if k in rinci else dapat_kartu
            ada = bersih(sumber.get(k, "(tidak ada)"))
            ok = ada == v
            if not ok:
                gagal += 1
            print(("   ok  " if ok else "   BEDA") + f" {k}: {ada}" + ("" if ok else f"  (harusnya {v})"))

    print("\ngagal:", gagal, "| galat:", galat)
    pg.select_option("#s-produk", label="TPH")
    pg.wait_for_timeout(200)
    pg.set_viewport_size({"width": 390, "height": 844})
    pg.wait_for_timeout(200)
    print("HP overflow-x:", pg.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"))
    b.close()

if gagal or galat:
    sys.exit(1)
