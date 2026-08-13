#!/usr/bin/env python3
"""Gabungkan index.html + styles.css + app.js + data.js jadi satu berkas HTML.

Berguna untuk dikirim lewat WhatsApp/email atau dibuka langsung dari HP tanpa
server. Hasilnya ditulis ke dua tempat:

  web/dist/master-agustus.html  berkas siap kirim
  docs/index.html               yang dilayani GitHub Pages mode "deploy from a
                                branch" dengan folder /docs

Pakai:  python3 web/tools/build_single.py [--body-only]
        --body-only  buang <!doctype>/<html>/<head>/<body> (untuk host yang
                     sudah menyediakan kerangka halaman sendiri) dan jangan
                     sentuh docs/
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    body_only = "--body-only" in sys.argv

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    data = (ROOT / "data.js").read_text(encoding="utf-8")

    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        "<style>\n" + css + "\n</style>",
    )
    html = html.replace(
        '<script src="data.js"></script>\n<script src="app.js"></script>',
        "<script>\n" + data + "\n" + js + "\n</script>",
    )

    if body_only:
        title = re.search(r"<title>.*?</title>", html, re.S).group(0)
        style = re.search(r"<style>.*?</style>", html, re.S).group(0)
        body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
        html = title + "\n" + style + "\n" + body.strip() + "\n"

    out = ROOT / "dist" / ("master-agustus-body.html" if body_only else "master-agustus.html")
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"-> {out.relative_to(ROOT.parent)} ({out.stat().st_size // 1024} KB)")

    if body_only:
        return

    # Satu berkas mandiri juga dipakai sebagai isi situs, supaya GitHub Pages
    # bisa melayaninya langsung dari folder /docs tanpa perlu GitHub Actions.
    docs = ROOT.parent / "docs"
    docs.mkdir(exist_ok=True)
    (docs / "index.html").write_text(html, encoding="utf-8")
    (docs / ".nojekyll").write_text("", encoding="utf-8")
    print("-> docs/index.html")


if __name__ == "__main__":
    main()
