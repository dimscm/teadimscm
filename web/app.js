/* Master Target Outlet — penelusur target & realisasi outlet.
   Data dari window.MASTER_DATA (dibuat tools/build_data.py dari workbook target). */
(function () {
  "use strict";

  var DATA = window.MASTER_DATA || { products: [], weekLabels: [] };
  var WEEKS = DATA.weekLabels || [];
  var LABELS = DATA.labels || {};
  var LBL_WILAYAH = LABELS.wilayah || "Wilayah";

  /* Satu baris = satu outlet pada satu produk. */
  var ROWS = [];
  DATA.products.forEach(function (p) {
    p.rows.forEach(function (r, i) {
      r.produk = p.label;
      r.produkId = p.id;
      r.zonaLabel = p.zonaLabel;
      r.satuan = p.satuan || "";
      r.uid = p.id + "#" + i;
      r.ach = r.tgt > 0 ? r.total / r.tgt : null;
      r.kurang = Math.max(r.tgt - r.total, 0);
      // Workbook memberi dua target: MID yang realistis dan MAX yang ambisius.
      // MID dipakai sebagai angka utama, MAX selalu ikut ditampilkan.
      r.tgtMx = r.tgtMax || r.tgt;
      r.achMx = r.tgtMx > 0 ? r.total / r.tgtMx : null;
      r.kurangMx = Math.max(r.tgtMx - r.total, 0);
      r.duaTarget = r.tgtMx !== r.tgt;
      r.sisaCb = r.cb ? r.cb.sisa : 0;
      r.cari = (r.nama + " " + r.no + " " + r.alamat + " " + r.sales + " " +
        r.wilayah + " " + (r.tipe || "") + " " + (r.ket || "") + " " +
        (r.channel || "") + " " + (r.kecamatan || "") + " " +
        (r.kelurahan || "")).toLowerCase();
      ROWS.push(r);
    });
  });

  var state = {
    produk: "all",
    q: "",
    sales: "",
    wilayah: "",
    zona: "",
    tipe: "",
    pilih: "",
    ket: "",
    status: "",
    view: "outlet",
    sort: "kurang"
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    return nf0.format(Math.round(n));
  }

  function rp(n) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    return "Rp " + nf0.format(Math.round(n));
  }

  var CB_STATUS = {
    aman: { teks: "Target tercapai — cashback aman", kelas: "good" },
    kurang: { teks: "Belum tercapai — sisa masih bisa dikejar", kelas: "warn" },
    gugur: { teks: "Omset masih di bawah strata terendah", kelas: "crit" },
    nol: { teks: "Belum ada order — cashback hangus kalau dibiarkan", kelas: "crit" }
  };

  function pct(a) {
    if (a === null || a === undefined) return "–";
    return nf0.format(Math.round(a * 100)) + "%";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Kelas warna: merah belum jalan, kuning setengah jalan, hijau tercapai. */
  function achClass(a) {
    if (a === null || a === undefined) return "none";
    if (a >= 1) return "good";
    if (a >= 0.5) return "warn";
    return "crit";
  }

  function statusOf(r) {
    if (r.total <= 0) return "nol";
    if (r.ach === null) return "nol";
    if (r.ach >= 1) return "tercapai";
    if (r.ach >= 0.5) return "sedang";
    return "rendah";
  }

  /* ── Filter ───────────────────────────────────────────────────────── */
  function byProduct() {
    return state.produk === "all"
      ? ROWS
      : ROWS.filter(function (r) { return r.produkId === state.produk; });
  }

  /* skip = nama filter yang diabaikan, dipakai untuk mengisi pilihan dropdown
     agar isinya selalu kombinasi yang masih ada datanya. */
  function matches(r, skip) {
    if (skip !== "sales" && state.sales && r.sales !== state.sales) return false;
    if (skip !== "wilayah" && state.wilayah && r.wilayah !== state.wilayah) return false;
    if (skip !== "zona" && state.zona && r.zona !== state.zona) return false;
    if (skip !== "tipe" && state.tipe && r.tipe !== state.tipe) return false;
    if (skip !== "pilih" && state.pilih && r.pilih !== state.pilih) return false;
    if (skip !== "ket" && state.ket && r.ket !== state.ket) return false;
    if (skip !== "status" && state.status && statusOf(r) !== state.status) return false;

    var terms = state.q.trim().toLowerCase().split(/\s+/);
    for (var i = 0; i < terms.length; i++) {
      if (terms[i] && r.cari.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function filtered() {
    return byProduct().filter(function (r) { return matches(r, null); });
  }

  var SORTS = {
    kurang: function (a, b) { return b.kurang - a.kurang; },
    achAsc: function (a, b) { return (a.ach === null ? -1 : a.ach) - (b.ach === null ? -1 : b.ach); },
    achDesc: function (a, b) { return (b.ach === null ? -1 : b.ach) - (a.ach === null ? -1 : a.ach); },
    totalDesc: function (a, b) { return b.total - a.total; },
    kurangMax: function (a, b) { return b.kurangMx - a.kurangMx; },
    cbSisa: function (a, b) { return b.sisaCb - a.sisaCb; },
    achMaxAsc: function (a, b) { return (a.achMx === null ? -1 : a.achMx) - (b.achMx === null ? -1 : b.achMx); },
    tgtDesc: function (a, b) { return b.tgt - a.tgt; },
    nama: function (a, b) { return a.nama.localeCompare(b.nama); },
    sales: function (a, b) { return a.sales.localeCompare(b.sales) || a.wilayah.localeCompare(b.wilayah); }
  };

  /* ── Isi dropdown mengikuti produk yang dipilih ───────────────────── */
  // Beberapa filter punya urutan alami yang bukan alfabetis.
  var URUTAN = { pilih: ["MID", "MAX"] };

  function uniq(rows, key) {
    var set = {};
    rows.forEach(function (r) { if (r[key]) set[r[key]] = 1; });
    var nilai = Object.keys(set).sort();
    var urut = URUTAN[key];
    if (urut) {
      nilai.sort(function (a, b) {
        var ia = urut.indexOf(a), ib = urut.indexOf(b);
        return (ia < 0 ? urut.length : ia) - (ib < 0 ? urut.length : ib);
      });
    }
    return nilai;
  }

  function fillSelect(el, values, keep) {
    var first = el.options[0].textContent;
    el.innerHTML = "";
    el.appendChild(new Option(first, ""));
    values.forEach(function (v) { el.appendChild(new Option(v, v)); });
    el.value = values.indexOf(keep) > -1 ? keep : "";
    return el.value;
  }

  function optionsFor(key) {
    return uniq(byProduct().filter(function (r) { return matches(r, key); }), key);
  }

  function syncSelects() {
    state.sales = fillSelect($("#f-sales"), optionsFor("sales"), state.sales);

    // Filter yang cuma punya satu nilai tidak menyaring apa pun — sembunyikan
    // saja supaya baris filter tidak penuh, terutama di layar HP.
    ["wilayah", "zona", "tipe", "pilih", "ket"].forEach(function (key) {
      var nilai = optionsFor(key);
      var cukup = nilai.length > 1;
      $("#f-" + key + "-wrap").hidden = !cukup;
      state[key] = cukup ? fillSelect($("#f-" + key), nilai, state[key]) : "";
    });

    $("#view-wilayah").hidden = uniq(byProduct(), "wilayah").length < 2;
    if ($("#view-wilayah").hidden && state.view === "wilayah") {
      state.view = "outlet";
      Array.prototype.forEach.call($("#views").children, function (t) {
        t.setAttribute("aria-pressed", String(t.dataset.view === "outlet"));
      });
    }
  }

  /* ── Ringkasan ────────────────────────────────────────────────────── */
  function totals(rows) {
    var t = { n: rows.length, tgt: 0, tgtMx: 0, tot: 0, kur: 0, kurMx: 0, nol: 0, ok: 0, okMx: 0,
      cbNow: 0, cbTgt: 0, cbSisa: 0, cbGugur: 0 };
    rows.forEach(function (r) {
      if (r.cb) {
        t.cbNow += r.cb.now;
        t.cbTgt += r.cb.target;
        t.cbSisa += r.cb.sisa;
        if (r.cb.status === "gugur" || r.cb.status === "nol") t.cbGugur += r.cb.sisa;
      }
      t.tgt += r.tgt;
      t.tgtMx += r.tgtMx;
      t.tot += r.total;
      t.kur += r.kurang;
      t.kurMx += r.kurangMx;
      if (r.total <= 0) t.nol++;
      if (r.ach !== null && r.ach >= 1) t.ok++;
      if (r.achMx !== null && r.achMx >= 1) t.okMx++;
    });
    t.ach = t.tgt > 0 ? t.tot / t.tgt : null;
    t.achMx = t.tgtMx > 0 ? t.tot / t.tgtMx : null;
    t.duaTarget = Math.round(t.tgtMx) !== Math.round(t.tgt);
    return t;
  }

  function renderSummary(rows) {
    var t = totals(rows);
    var w = t.ach === null ? 0 : Math.min(t.ach, 1) * 100;
    $("#summary").innerHTML =
      card("Outlet", fmt(t.n), t.nol + " belum order") +
      card("Target", fmt(t.tgt), t.duaTarget ? "maks " + fmt(t.tgtMx) : periodeSingkat()) +
      card("Realisasi", fmt(t.tot), t.duaTarget
        ? t.ok + " capai target · " + t.okMx + " capai maks"
        : t.ok + " outlet tercapai") +
      card("Kekurangan", fmt(t.kur), t.duaTarget ? "maks " + fmt(t.kurMx) : "sisa ke target") +
      card("Sisa cashback", rp(t.cbSisa), "aman sekarang " + rp(t.cbNow)) +
      '<div class="card ach"><div class="k">Achievement</div><div class="v num">' + pct(t.ach) +
      '</div><div class="bar"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
      (t.duaTarget ? '<div class="m num">maks ' + pct(t.achMx) + "</div>" : "") + "</div>";

    // Galon dihitung per galon, produk lain per karton — kalau keduanya ikut
    // tersaring, angka gabungannya mencampur dua satuan.
    var satuan = uniq(rows, "satuan");
    var nota = $("#satuan-note");
    nota.hidden = satuan.length < 2;
    nota.textContent = "Angka gabungan mencampur satuan " + satuan.join(" dan ") + ".";
  }

  function card(k, v, m) {
    return '<div class="card"><div class="k">' + esc(k) + '</div><div class="v num">' + v +
      '</div><div class="m">' + esc(m) + "</div></div>";
  }

  /* ── Tampilan outlet ──────────────────────────────────────────────── */
  function renderOutlets(rows) {
    if (!rows.length) return empty();

    var head = '<div class="tr head"><div>Outlet</div><div>Salesman</div><div>' + esc(LBL_WILAYAH) +
      '</div><div class="r">Target<br>/ maks</div><div class="r">Realisasi</div>' +
      '<div class="r">Kurang<br>/ maks</div>' +
      '<div class="weeks">' + WEEKS.map(function (w) { return "<span>" + w + "</span>"; }).join("") +
      '</div><div class="r">ACH<br>/ maks</div></div>';

    var body = rows.map(function (r) {
      // data-w dipakai CSS untuk menempelkan nama minggu saat baris berubah
      // jadi kartu di HP, di mana baris judul kolom tidak ikut tampil.
      var wk = r.weeks.map(function (v, i) {
        return '<span class="' + (v ? "" : "zero") + '" data-w="' + WEEKS[i] + '">' +
          (v ? fmt(v) : "–") + "</span>";
      }).join("");

      return '<button class="tr" data-uid="' + esc(r.uid) + '">' +
        '<div class="c-outlet"><div class="outlet-name">' + esc(r.nama) + '</div>' +
        '<div class="outlet-meta">' +
        (state.produk === "all" ? '<span class="chip">' + esc(r.produk) + "</span>" : "") +
        (r.tipe ? '<span class="chip">' + esc(r.tipe) + "</span>" : "") +
        (r.spk ? '<span class="chip spk">SPK</span>' : "") +
        '<span class="no">' + r.no + "</span> · " + esc(r.alamat || "-") + "</div></div>" +
        '<div class="c-sales">' + esc(r.sales) + "</div>" +
        '<div class="c-wilayah">' + esc(r.wilayah) + "</div>" +
        '<div class="c-tgt r num"><span class="mlabel">Target </span>' + fmt(r.tgt) +
        (r.duaTarget ? '<div class="sub2">maks ' + fmt(r.tgtMx) + "</div>" : "") + "</div>" +
        '<div class="c-tot r num"><span class="mlabel">Realisasi </span>' + fmt(r.total) + "</div>" +
        '<div class="c-kur r num"><span class="mlabel">Kurang </span>' + fmt(r.kurang) +
        (r.duaTarget ? '<div class="sub2">maks ' + fmt(r.kurangMx) + "</div>" : "") + "</div>" +
        '<div class="c-weeks"><div class="weeks">' + wk + "</div></div>" +
        '<div class="c-ach r"><span class="pill ' + achClass(r.ach) + '">' + pct(r.ach) + "</span>" +
        (r.duaTarget ? '<div class="sub2">maks ' + pct(r.achMx) + "</div>" : "") + "</div>" +
        "</button>";
    }).join("");

    return '<div class="tbl">' + head + body + "</div>";
  }

  /* ── Rekap per salesman / wilayah ─────────────────────────────────── */
  function renderGroups(rows, key) {
    if (!rows.length) return empty();

    var map = {};
    rows.forEach(function (r) {
      var k = r[key] || "(kosong)";
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });

    var list = Object.keys(map).map(function (k) {
      var t = totals(map[k]);
      t.name = k;
      return t;
    }).sort(function (a, b) { return b.kur - a.kur; });

    var head = '<div class="grp head"><div>' + esc(key === "sales" ? "Salesman" : LBL_WILAYAH) +
      '</div><div class="r">Outlet</div><div class="r">Target / maks</div>' +
      '<div class="r">Realisasi</div><div class="r">Kurang / maks</div>' +
      '<div>Progres</div><div class="r">ACH / maks</div></div>';

    var body = list.map(function (t) {
      var w = t.ach === null ? 0 : Math.min(t.ach, 1) * 100;
      return '<div class="grp">' +
        '<div class="g-name name">' + esc(t.name) + "</div>" +
        '<div class="g-n r num"><span class="mlabel">Outlet </span>' + fmt(t.n) + "</div>" +
        '<div class="g-tgt r num"><span class="mlabel">Target </span>' + fmt(t.tgt) +
        (t.duaTarget ? '<div class="sub2">maks ' + fmt(t.tgtMx) + "</div>" : "") + "</div>" +
        '<div class="g-tot r num"><span class="mlabel">Realisasi </span>' + fmt(t.tot) + "</div>" +
        '<div class="g-kur r num"><span class="mlabel">Kurang </span>' + fmt(t.kur) +
        (t.duaTarget ? '<div class="sub2">maks ' + fmt(t.kurMx) + "</div>" : "") + "</div>" +
        '<div class="g-bar"><div class="bar"><i style="width:' + w.toFixed(1) + '%"></i></div></div>' +
        '<div class="g-ach r"><span class="pill ' + achClass(t.ach) + '">' + pct(t.ach) + "</span>" +
        (t.duaTarget ? '<div class="sub2">maks ' + pct(t.achMx) + "</div>" : "") + "</div>" +
        "</div>";
    }).join("");

    return '<div class="tbl">' + head + body + "</div>";
  }

  function empty() {
    return '<div class="tbl"><div class="empty">Tidak ada outlet yang cocok.<br>Coba ubah kata kunci atau kosongkan filter.</div></div>';
  }

  /* ── Panel detail outlet ──────────────────────────────────────────── */
  function openDetail(uid) {
    var r = ROWS.filter(function (x) { return x.uid === uid; })[0];
    if (!r) return;

    var maxWeek = Math.max.apply(null, r.weeks.map(function (v) { return v || 0; }).concat([r.tgtWeek || 0, 1]));
    var weeks = r.weeks.map(function (v, i) {
      return '<div class="wk"><span class="lbl">' + WEEKS[i] + '</span>' +
        '<span class="track"><i style="width:' + ((v || 0) / maxWeek * 100).toFixed(1) + '%"></i></span>' +
        '<span class="val">' + (v === null ? "–" : fmt(v)) + "</span></div>";
    }).join("");

    var hist = r.history.map(function (g) {
      var items = g.items.map(function (it, i) {
        var last = i === g.items.length - 1 && it.k.toLowerCase() === "total";
        return '<div class="hist' + (last ? " tot" : "") + '"><span class="k">' + esc(it.k) +
          '</span><span class="v">' + fmt(it.v) + "</span></div>";
      }).join("");
      return '<div class="sec">' + esc(g.title) + "</div>" + items;
    }).join("");

    var extra = "";
    if (r.duaTarget) {
      extra += kv("Target maks", fmt(r.tgtMx));
      extra += kv("Kekurangan maks", fmt(r.kurangMx));
      extra += '<div><div class="k">ACH vs maks</div><div class="v"><span class="pill ' +
        achClass(r.achMx) + '">' + pct(r.achMx) + "</span></div></div>";
    }
    if (r.kecamatan) extra += kv("Kecamatan", esc(r.kecamatan));
    if (r.kelurahan) extra += kv("Kelurahan", esc(r.kelurahan));
    if (r.tipe) extra += kv("Tipe outlet", esc(r.tipe));
    if (r.ket) extra += kv("Keterangan", esc(r.ket));
    if (r.zona) extra += kv(r.zonaLabel || "Zona", esc(r.zona));
    if (r.channel) extra += kv("Channel", esc(r.channel));

    // Sales memakai ini di jalan, jadi alamatnya dibuat bisa langsung dibuka
    // di aplikasi peta.
    var peta = r.lat && r.lng
      ? '<a class="maplink" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
        r.lat + "," + r.lng + '">Buka di Google Maps</a>'
      : "";
    // Simulasi harga dibuka dengan angka outlet ini, supaya sales bisa langsung
    // menawarkan "kalau ambil segini, harga nettnya segini".
    if (bandsSim(produkById(r.produkId) || {}, r.tipe).length) {
      peta += '<button class="maplink simlink" type="button" data-sim="' + esc(r.uid) +
        '">Simulasi harga</button>';
    }
    if (r.up !== null && r.up !== undefined) extra += kv("Up target", pct(r.up));
    if (r.tgtWeek) extra += kv("Target / week", fmt(r.tgtWeek));
    if (r.ebs) {
      var need = Math.max(r.tgt * r.ebs - r.total, 0);
      extra += kv("Kurang EBS " + pct(r.ebs), fmt(need));
    }

    var cb = "";
    if (r.cb) {
      var st = CB_STATUS[r.cb.status] || CB_STATUS.kurang;
      cb = '<div class="sec">Cashback bulan ini</div>' +
        '<div class="cb"><div class="cb-k">Sisa cashback</div>' +
        '<div class="cb-v num">' + rp(r.cb.sisa) + "</div>" +
        '<div class="pill ' + st.kelas + ' cb-st">' + esc(st.teks) + "</div>" +
        (r.cb.kurangUnit > 0
          ? '<div class="cb-m">Ambil <b>' + fmt(r.cb.kurangUnit) + " " + esc(r.satuan || "crt") +
            "</b> lagi sebelum akhir bulan.</div>"
          : '<div class="cb-m">Target bulan ini sudah terlampaui.</div>') +
        "</div>" +
        hist2("Cashback aman sekarang", rp(r.cb.now)) +
        hist2("Kalau target tercapai", rp(r.cb.target)) +
        hist2("Tarif sekarang", r.cb.tarif ? rp(r.cb.tarif) + " / " + esc(r.satuan || "crt") +
          (r.cb.zona ? " (zona " + esc(r.cb.zona) + ")" : "") : "belum masuk strata") +
        hist2("Tarif di target", r.cb.tarifTgt ? rp(r.cb.tarifTgt) + " / " + esc(r.satuan || "crt") +
          (r.cb.zonaTgt ? " (zona " + esc(r.cb.zonaTgt) + ")" : "") : "–") +
        (r.cb.syaratAch ? hist2("Syarat", "hanya dibayar kalau target tercapai") : "") +
        hist2("Dasar angka", r.spk
          ? "target sudah diikat SPK"
          : "masih potensi, belum diikat SPK") +
        '<div class="sec">Rincian outlet</div>';
    }

    $("#detail").innerHTML =
      '<button class="close" id="d-close" aria-label="Tutup">✕</button>' +
      "<h2>" + esc(r.nama) + "</h2>" +
      '<div class="addr">' + esc(r.alamat || "-") + "</div>" + peta +
      cb +
      '<div class="kv">' +
      kv("Produk", esc(r.produk)) +
      kv("No outlet", r.no) +
      kv("Salesman", esc(r.sales)) +
      kv(LBL_WILAYAH, esc(r.wilayah)) +
      kv("Target" + (r.satuan ? " (" + r.satuan + ")" : "") +
        (r.pilih ? " · " + esc(r.pilih) : ""), fmt(r.tgt)) +
      kv("Realisasi", fmt(r.total)) +
      kv("Kekurangan", fmt(r.kurang)) +
      '<div><div class="k">ACH vs target</div><div class="v"><span class="pill ' + achClass(r.ach) +
      '">' + pct(r.ach) + "</span></div></div>" +
      extra +
      "</div>" +
      '<div class="sec">Realisasi mingguan</div>' + weeks +
      hist;

    $("#detail").hidden = false;
    $("#scrim").hidden = false;
    document.body.style.overflow = "hidden";
    $("#d-close").focus();
    $("#d-close").addEventListener("click", closeDetail);
  }

  function hist2(k, v) {
    return '<div class="hist"><span class="k">' + esc(k) + '</span><span class="v">' + v + "</span></div>";
  }

  function kv(k, v) {
    return '<div><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
  }

  function closeDetail() {
    $("#detail").hidden = true;
    $("#scrim").hidden = true;
    document.body.style.overflow = "";
  }

  /* ── Ekspor CSV sesuai filter aktif ───────────────────────────────── */
  function exportCsv() {
    if (state.view === "simulasi") return exportSim();
    var rows = filtered().sort(SORTS[state.sort]);
    var head = ["Produk", "Satuan", "Salesman", LBL_WILAYAH, "No Outlet", "Nama Outlet",
      "Alamat", "Kecamatan", "Kelurahan", "Tipe Outlet", "Channel", "Keterangan", "Zona",
      "Target", "Target Maks"]
      .concat(WEEKS, ["Realisasi", "Kurang MID", "Kurang Maks", "ACH MID %", "ACH Maks %",
        "Tarif Cashback", "Cashback Sekarang", "Cashback Jika Target", "Sisa Cashback",
        "Status Cashback", "Latitude", "Longitude"]);

    var lines = [head].concat(rows.map(function (r) {
      return [r.produk, r.satuan, r.sales, r.wilayah, r.no, r.nama, r.alamat,
        r.kecamatan || "", r.kelurahan || "", r.tipe, r.channel, r.ket, r.zona, r.tgt, r.tgtMx]
        .concat(r.weeks.map(function (v) { return v === null ? "" : v; }),
          [r.total, r.kurang, r.kurangMx,
            r.ach === null ? "" : Math.round(r.ach * 100),
            r.achMx === null ? "" : Math.round(r.achMx * 100),
            r.cb ? r.cb.tarif : "", r.cb ? r.cb.now : "", r.cb ? r.cb.target : "",
            r.cb ? r.cb.sisa : "", r.cb ? r.cb.status : "",
            r.lat || "", r.lng || ""]);
    })).map(function (cols) {
      return cols.map(function (c) {
        var s = c === null || c === undefined ? "" : String(c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    }).join("\r\n");

    saveFile(namaBerkas("csv"), "﻿" + lines);
  }

  /* Di dalam viewer claude.ai, berkas hanya bisa disimpan lewat
     window.claude.downloads; di browser biasa pakai tautan blob. */
  function saveFile(name, text) {
    var dl = window.claude && window.claude.downloads;
    if (dl) {
      dl.save({ filename: name, data: text })
        .catch(function (err) {
          var code = err && err.code;
          if (code === "declined") return;
          if (code === "extension_not_enabled" || code === "rejected_extension") {
            return dl.save({ filename: name.replace(/\.csv$/, ".txt"), data: text })
              .catch(function (e) { if (e && e.code !== "declined") saveViaLink(name, text); });
          }
          saveViaLink(name, text);
        });
      return;
    }
    saveViaLink(name, text);
  }

  function saveViaLink(name, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ── Simulasi harga ───────────────────────────────────────────────────
     Sheet "SIMULASI NETT ..." di workbook membawa price list, tangga DOF,
     tabel ikat target, dan bonus — jadi halaman ini bisa menjawab pertanyaan
     toko secara lengkap: "kalau ambil segini, nett akhirnya berapa?"

     Rumusnya persis yang ditulis di sheet itu:
       TPH  nett akhir = PL − DOF − cashback/crt − bonus/crt
       LM   nett akhir = nett DOF − cashback/crt − bonus triwulan/crt
     Zona TPH dari total mix sebulan; zona LM dari rata-rata mingguan.

     Produk yang tidak punya sheet simulasi (Nipis Madu) tetap dapat simulasi
     sederhana: strata cashback, dengan harga diisi sendiri. */
  var SIM = DATA.simulasi || null;
  var NWEEK = (SIM && SIM.nweek) || WEEKS.length || 4;
  var HARGA_KEY = "mt.harga.v1";
  var hargaSimpan = bacaHarga();

  var sim = {
    produk: "", siap: "",
    minggu: 0,
    channel: "", pl: "baru",
    q1: 0, q2: 0, qLain: 0,
    tw: "BELUM", capai: true, w03: true, syarat: false,
    share: 1, vol: 0, tgt: 0, outlet: ""
  };

  /* Jumlah minggu bulan yang disimulasikan. Tabel program menyebut minimum
     PER MINGGU, jadi band bulanannya bergeser: Okt-Nov 4 minggu, Des 5. Sheet
     simulasi menuliskan ambang TPH sudah dikali 4; di web ambang itu
     dikembalikan ke per minggu lalu dikali jumlah minggu yang dipilih. */
  function minggu() {
    return sim.minggu || NWEEK;
  }

  function skalaMinggu() {
    return minggu() / NWEEK;
  }

  /* Band untuk tabel yang ambangnya bulanan (TPH dan strata produk). */
  function bandBulanan(tabel, nilai) {
    var s = skalaMinggu();
    for (var i = 0; i < tabel.length; i++) {
      if (nilai >= tabel[i].min * s) return tabel[i];
    }
    return null;
  }

  function minBulan(b) {
    return b.min * skalaMinggu();
  }

  function bacaHarga() {
    try { return JSON.parse(localStorage.getItem(HARGA_KEY)) || {}; } catch (e) { return {}; }
  }

  function simpanHarga() {
    try { localStorage.setItem(HARGA_KEY, JSON.stringify(hargaSimpan)); } catch (e) { /* mode privat */ }
  }

  /* Harga manual disimpan per nama produk, bukan per id sheet: nama sheet ikut
     berubah tiap kuartal, namanya tidak. */
  function hargaProduk(p) {
    var h = hargaSimpan[p.label] || {};
    return { crt: Number(h.crt) || 0, isi: Number(h.isi) || 0 };
  }

  function setHarga(p, k, v) {
    if (!hargaSimpan[p.label]) hargaSimpan[p.label] = {};
    hargaSimpan[p.label][k] = Math.max(Number(v) || 0, 0);
    simpanHarga();
  }

  /* Diskon efektif biasanya di bawah 10%, jadi satu angka desimal. */
  function pct1(a) {
    if (a === null || a === undefined || isNaN(a)) return "–";
    var n = a * 100;
    return (n < 10 ? n.toFixed(1).replace(".", ",") : String(Math.round(n))) + "%";
  }

  function produkById(id) {
    return DATA.products.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* Produk mana memakai model yang mana. */
  function jenisSim(p) {
    var l = (p.label || "").toUpperCase();
    if (SIM && SIM.tph && l.indexOf("TPH") > -1) return "tph";
    if (SIM && SIM.lm && l.indexOf("LM 600") > -1) return "lm600";
    if (SIM && SIM.lm && l.indexOf("1500") > -1) return "lmmix";
    return "umum";
  }

  function produkBerstrata() {
    return DATA.products.filter(function (p) {
      if (jenisSim(p) !== "umum") return true;
      var s = p.strata || {};
      return Object.keys(s).some(function (k) { return s[k] && s[k].length; });
    });
  }

  function produkSim() {
    var list = produkBerstrata();
    if (!list.length) return null;
    var pilih = sim.produk || (state.produk !== "all" ? state.produk : "");
    return list.filter(function (p) { return p.id === pilih; })[0] || list[0];
  }

  /* Channel yang tersedia: TPH ikut tabel ikatnya, LM ikut kolom harga. */
  function channelSim(jenis, p) {
    if (jenis === "tph") return Object.keys(SIM.tph.ikat).sort();
    if (jenis === "lm600" || jenis === "lmmix") {
      var baris = SIM.lm.nett[0];
      return Object.keys((baris.harga["600"] || baris.harga["1500"] || {})).sort();
    }
    var s = p.strata || {};
    return Object.keys(s).filter(function (k) { return k && s[k].length; }).sort();
  }

  /* Tipe outlet di data target (SO / GROMIN / GROSIR) dipetakan ke channel
     harga; yang bukan SO/GROMIN masuk harga retail. */
  function channelDari(tipe, daftar) {
    var t = (tipe || "").toUpperCase();
    if (daftar.indexOf(t) > -1) return t;
    if (daftar.indexOf("RETAIL") > -1) return "RETAIL";
    return daftar[0] || "";
  }

  function bandPada(tabel, nilai) {
    for (var i = 0; i < tabel.length; i++) {
      if (nilai >= tabel[i].min) return tabel[i];
    }
    return null;
  }

  /* ── Model tiap program (rumusnya dari sheet simulasi) ──────────────── */
  function dofTph(mix, syarat) {
    var pilih = { min: 0, disc: 0 };
    SIM.tph.dof.forEach(function (b) {
      if (mix >= b.min && (!b.syarat || syarat) && b.disc >= pilih.disc) pilih = b;
    });
    return pilih;
  }

  function hitungTph() {
    var q350 = sim.q1, q500 = sim.q2, mix = q350 + q500;
    var dof = dofTph(mix, sim.syarat);
    var harga = SIM.tph.pl[sim.channel] || {};
    var pl350 = (harga["350"] || {})[sim.pl] || 0;
    var pl500 = (harga["500"] || {})[sim.pl] || 0;
    var nett350 = pl350 - dof.disc, nett500 = pl500 - dof.disc;
    var band = bandBulanan(SIM.tph.ikat[sim.channel] || [], mix);
    var cb = sim.capai && band ? band.cb : 0;
    var bonusCrt = (sim.capai && sim.w03 && band) ? band.bonus : 0;
    var nilaiBonus = bonusCrt * nett350;
    var bonusCrtRp = mix ? nilaiBonus / mix : 0;
    return {
      mix: mix, dof: dof.disc, pl350: pl350, pl500: pl500,
      nett350: nett350, nett500: nett500, band: band,
      zona: band ? band.zona : "", cb: cb, totalCb: mix * cb,
      bonusCrt: bonusCrt, nilaiBonus: nilaiBonus, bonusCrtRp: bonusCrtRp,
      akhir350: nett350 - cb - bonusCrtRp, akhir500: nett500 - cb - bonusCrtRp,
      benefit: dof.disc * mix + mix * cb + nilaiBonus
    };
  }

  function nettLm(mix, sku, channel, pl) {
    var baris = bandPada(SIM.lm.nett, mix);
    // Tabel sudah berisi harga nett, bukan potongan. Tier yang lebih tinggi
    // tidak boleh lebih mahal, jadi dipakai yang termurah sampai qty itu.
    var harga = 0;
    SIM.lm.nett.forEach(function (b) {
      if (mix >= b.min) {
        var h = (b.harga[sku] || {})[channel];
        if (h && (!harga || h < harga)) harga = h;
      }
    });
    if (!harga && baris) harga = (baris.harga[sku] || {})[channel] || 0;
    if (pl === "lama") harga -= SIM.lm.kenaikan[sku] || 0;
    return harga;
  }

  function bonusTw(band, tw, kunci90, kunci100) {
    if (!band) return 0;
    if (tw === "≥100%") return band[kunci100] || 0;
    if (tw === "90-99%") return band[kunci90] || 0;
    return 0;
  }

  function hitungLm600() {
    var q = sim.q1, mix = q + sim.qLain;
    var nett = nettLm(mix, "600", sim.channel, sim.pl);
    var perWk = q / minggu();
    var band = bandPada(SIM.lm.ikat600, perWk);
    var cb = band ? band.cb : 0;
    var bonus = bonusTw(band, sim.tw, "tw90", "tw100");
    return {
      mix: mix, perWk: perWk, nett: nett, band: band,
      zona: band ? band.zona : "", cb: cb, bonus: bonus,
      akhir: nett - cb - bonus, totalCb: q * cb, totalBonus: q * bonus,
      benefit: q * cb + q * bonus
    };
  }

  function hitungLmMix() {
    var q1500 = sim.q1, q330 = sim.q2, mix = q1500 + q330 + sim.qLain;
    var n1500 = nettLm(mix, "1500", sim.channel, sim.pl);
    var n330 = nettLm(mix, "330", sim.channel, sim.pl);
    var perWk = (q1500 + q330) / minggu();
    var band = bandPada(SIM.lm.ikatMix, perWk);
    var cb1500 = band ? band.cb : 0, cb330 = band ? band.cb330 : 0;
    var b1500 = bonusTw(band, sim.tw, "tw90", "tw100");
    // Bonus 330 berlaku sejak pencapaian 90%, jadi sama untuk dua status.
    var b330 = band && sim.tw !== "BELUM" ? band.tw330 || 0 : 0;
    return {
      mix: mix, perWk: perWk, nett1500: n1500, nett330: n330, band: band,
      zona: band ? band.zona : "", cb1500: cb1500, cb330: cb330,
      bonus1500: b1500, bonus330: b330,
      akhir1500: n1500 - cb1500 - b1500, akhir330: n330 - cb330 - b330,
      totalCb: q1500 * cb1500 + q330 * cb330,
      totalBonus: q1500 * b1500 + q330 * b330,
      benefit: q1500 * (cb1500 + b1500) + q330 * (cb330 + b330)
    };
  }

  /* ── Nilai awal: diambil dari outlet produk itu sendiri ─────────────── */
  function siapkanSim(p) {
    if (sim.siap === p.id) return;
    var jenis = jenisSim(p);
    var rows = ROWS.filter(function (r) { return r.produkId === p.id; });
    var daftar = channelSim(jenis, p);

    var hitung = {};
    rows.forEach(function (r) {
      var c = channelDari(r.tipe, daftar);
      hitung[c] = (hitung[c] || 0) + 1;
    });
    sim.channel = daftar.sort(function (a, b) { return (hitung[b] || 0) - (hitung[a] || 0); })[0] || "";

    var tgt = rows.map(function (r) { return r.tgt; })
      .filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    var tengah = Math.round(tgt.length ? tgt[Math.floor(tgt.length / 2)] : 100);

    var share = rows.map(function (r) { return r.share; })
      .filter(function (v) { return v !== null && v !== undefined; });
    sim.share = share.length
      ? share.reduce(function (a, b) { return a + b; }, 0) / share.length
      : 1;

    if (jenis === "lmmix") {
      sim.q1 = Math.round(tengah * sim.share);
      sim.q2 = tengah - sim.q1;
    } else {
      sim.q1 = tengah;
      sim.q2 = jenis === "tph" ? Math.round(tengah * 0.3) : 0;
    }
    sim.qLain = 0;
    sim.vol = tengah;
    sim.tgt = tengah;
    if (!sim.minggu) sim.minggu = NWEEK;
    sim.outlet = "";
    sim.produk = p.id;
    sim.siap = p.id;
  }

  /* ── Potongan HTML yang dipakai berulang ───────────────────────────── */
  function fieldNum(id, label, nilai, langkah) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + "</label>" +
      '<input id="' + id + '" type="number" inputmode="numeric" min="0" step="' +
      (langkah || 1) + '" value="' + nilai + '"></div>';
  }

  function fieldSel(id, label, pilihan, aktif) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + "</label><select id=\"" +
      id + '">' + pilihan.map(function (o) {
        var nilai = o.v === undefined ? o : o.v;
        var teks = o.t === undefined ? o : o.t;
        return '<option value="' + esc(nilai) + '"' + (String(nilai) === String(aktif) ? " selected" : "") +
          ">" + esc(teks) + "</option>";
      }).join("") + "</select></div>";
  }

  function besar(k, v, m) {
    return '<div class="card besar"><div class="k">' + esc(k) + '</div><div class="v num">' + v +
      '</div><div class="m">' + esc(m) + "</div></div>";
  }

  function PL_PILIHAN() {
    return [{ v: "baru", t: "Baru" }, { v: "lama", t: "Lama" }];
  }

  var YA_TIDAK = [{ v: "ya", t: "Ya" }, { v: "tidak", t: "Tidak" }];

  /* ── Formulir tiap jenis ───────────────────────────────────────────── */
  function formSim(p, jenis) {
    var daftar = channelSim(jenis, p);
    var f = "";
    if (daftar.length > 1) f += fieldSel("s-channel", "Channel", daftar, sim.channel);
    // Sheet simulasi punya sel "JML WEEK BULAN"; di web jadi pilihan, supaya
    // bulan 5 minggu (mis. Desember) bisa dihitung tanpa menunggu file baru.
    f += fieldSel("s-minggu", "Jumlah minggu", [
      { v: 4, t: "4 minggu" }, { v: 5, t: "5 minggu" }
    ], minggu());

    if (jenis === "tph") {
      f += fieldSel("s-pl", "Price list", PL_PILIHAN(), sim.pl);
      f += fieldNum("s-q1", "Qty TPH 350 (crt/bln)", sim.q1);
      f += fieldNum("s-q2", "Qty TPH 500 (crt/bln)", sim.q2);
      f += fieldSel("s-capai", "Capai 100% target", YA_TIDAK, sim.capai ? "ya" : "tidak");
      f += fieldSel("s-w03", "W03 ≥ 70%", YA_TIDAK, sim.w03 ? "ya" : "tidak");
      f += fieldSel("s-syarat", "Syarat DOF Rp900", YA_TIDAK, sim.syarat ? "ya" : "tidak");
    } else if (jenis === "lm600") {
      f += fieldSel("s-pl", "Price list", PL_PILIHAN(), sim.pl);
      f += fieldNum("s-q1", "Qty LM 600 (crt/bln)", sim.q1);
      f += fieldNum("s-qlain", "Qty LM lain (tier DOF)", sim.qLain);
      f += fieldSel("s-tw", "Status triwulan", ["BELUM", "90-99%", "≥100%"], sim.tw);
    } else if (jenis === "lmmix") {
      f += fieldSel("s-pl", "Price list", PL_PILIHAN(), sim.pl);
      f += fieldNum("s-q1", "Qty LM 1500 (crt/bln)", sim.q1);
      f += fieldNum("s-q2", "Qty LM 330 (crt/bln)", sim.q2);
      f += fieldNum("s-qlain", "Qty LM lain (tier DOF)", sim.qLain);
      f += fieldSel("s-tw", "Status triwulan", ["BELUM", "90-99%", "≥100%"], sim.tw);
    } else {
      var h = hargaProduk(p);
      var satuan = p.satuan || "crt";
      f += fieldNum("s-harga", "Harga jual / " + satuan + " (Rp)", h.crt || 0, 500);
      f += fieldNum("s-isi", "Isi / " + satuan + " (opsional)", h.isi || 0);
      f += fieldNum("s-vol", "Volume (" + satuan + ")", sim.vol);
      if (p.rows.length && p.rows[0].cb && p.rows[0].cb.syaratAch) {
        f += fieldNum("s-tgt", "Target bulan ini", sim.tgt);
      }
    }
    return f;
  }

  function renderSimulasi() {
    var p = produkSim();
    if (!p) {
      return '<div class="tbl"><div class="empty">Belum ada tabel program untuk disimulasikan.</div></div>';
    }
    siapkanSim(p);
    var jenis = jenisSim(p);
    var list = produkBerstrata();

    var head = '<div class="field"><label for="s-produk">Produk</label><select id="s-produk">' +
      list.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" +
          esc(x.label) + "</option>";
      }).join("") + "</select></div>";

    var geser = jenis === "umum"
      ? '<label class="sim-range"><span>Geser volume</span><input id="s-range" type="range" min="0" max="' +
        Math.max(Math.round(volMaksUmum(p) * 1.25), sim.vol) + '" step="1" value="' + sim.vol +
        '" aria-label="Volume"></label>'
      : "";

    return '<div class="sim">' +
      (sim.outlet ? '<div class="sim-from">Prasetel dari <b>' + esc(sim.outlet) + "</b></div>" : "") +
      '<div class="sim-form">' + head + formSim(p, jenis) + "</div>" +
      geser +
      '<div id="sim-out"></div>' +
      "</div>";
  }

  function volMaksUmum(p) {
    var bands = bandsSim(p, sim.channel);
    return bands.length ? minBulan(bands[0]) : 1000;
  }

  function bandsSim(p, tipe) {
    var s = p.strata || {};
    return s[(tipe || "").toUpperCase()] || s[""] || [];
  }

  /* ── Hasil ─────────────────────────────────────────────────────────── */
  function drawSim() {
    var p = produkSim();
    if (!p || !$("#sim-out")) return;
    var jenis = jenisSim(p);
    if (jenis === "tph") $("#sim-out").innerHTML = hasilTph(p);
    else if (jenis === "lm600") $("#sim-out").innerHTML = hasilLm600(p);
    else if (jenis === "lmmix") $("#sim-out").innerHTML = hasilLmMix(p);
    else $("#sim-out").innerHTML = hasilUmum(p);
  }

  function catatanSim(jenis) {
    var isi = jenis === "tph" ? (SIM.tph.catatan || []) : (SIM.lm.catatan || []);
    return isi.length
      ? '<p class="note">' + isi.map(esc).join("<br>") + "</p>"
      : "";
  }

  function hasilTph(p) {
    var h = hitungTph();
    var kartu =
      besar("Nett 350 akhir", rp(h.akhir350), "setelah DOF, cashback, bonus") +
      besar("Nett 500 akhir", rp(h.akhir500), "setelah DOF, cashback, bonus") +
      besar("Total benefit", rp(h.benefit), "DOF + cashback + bonus");

    var rinci =
      hist2("Total mix (350 + 500)", fmt(h.mix) + " crt") +
      hist2("Price list 350 / 500", rp(h.pl350) + " / " + rp(h.pl500)) +
      hist2("DOF per crt", rp(h.dof)) +
      hist2("Nett setelah DOF", rp(h.nett350) + " / " + rp(h.nett500)) +
      hist2("Zona ikat target", h.zona || "belum masuk strata") +
      hist2("Cashback per crt", rp(h.cb) + (sim.capai ? "" : " (target belum tercapai)")) +
      hist2("Total cashback", rp(h.totalCb)) +
      hist2("Bonus TPH 350", h.bonusCrt ? fmt(h.bonusCrt) + " crt · " + rp(h.nilaiBonus) : "tidak dapat") +
      hist2("Bonus per crt", rp(h.bonusCrtRp));

    var naik = naikBandBulanan(SIM.tph.ikat[sim.channel] || [], h.mix);
    var hint = "";
    if (naik) {
      var cbNaik = sim.capai ? naik.cb : 0;
      var bonusNaik = (sim.capai && sim.w03) ? naik.bonus * h.nett350 : 0;
      var minNaik = minBulan(naik);
      var perCrt = minNaik ? bonusNaik / minNaik : 0;
      hint = '<div class="sim-hint"><b>Tambah ' + fmt(minNaik - h.mix) +
        " crt</b> (jadi " + fmt(minNaik) + " mix) → zona " + esc(naik.zona) + ", cashback " +
        rp(cbNaik) + " /crt" + (naik.bonus ? ", bonus " + fmt(naik.bonus) + " crt TPH 350" : "") +
        ". Nett 350 jadi " + rp(h.nett350 - cbNaik - perCrt) +
        ". Tarif zona baru berlaku untuk seluruh volume.</div>";
    }

    var dofNaik = naikDof(h.mix);
    if (dofNaik) {
      hint += '<div class="sim-hint">Tangga DOF berikutnya di ' + fmt(dofNaik.min) +
        " crt mix (tambah " + fmt(dofNaik.min - h.mix) + "): potongan " + rp(dofNaik.disc) +
        " /crt" + (dofNaik.syarat ? " — butuh syarat tambahan" : "") + ".</div>";
    }

    var tangga = '<div class="sec">Tangga DOF TPH</div><div class="tbl">' +
      '<div class="lad head"><div>Min mix</div><div class="r">Potongan /crt</div>' +
      '<div class="r">Nett 350</div><div class="r">Nett 500</div><div class="r">Dari mix ini</div></div>' +
      SIM.tph.dof.map(function (b) {
        var aktif = b.disc === h.dof;
        return '<div class="lad' + (aktif ? " on" : "") + '">' +
          "<div>" + fmt(b.min) + " crt" + (b.syarat ? '<div class="sub2">+ syarat</div>' : "") + "</div>" +
          '<div class="r num"><span class="mlabel">Potongan </span>' + rp(b.disc) + "</div>" +
          '<div class="r num"><span class="mlabel">Nett 350 </span>' + rp(h.pl350 - b.disc) + "</div>" +
          '<div class="r num"><span class="mlabel">Nett 500 </span>' + rp(h.pl500 - b.disc) + "</div>" +
          '<div class="r num"><span class="mlabel">Selisih </span>' +
          (b.syarat && !sim.syarat ? "butuh syarat"
            : b.min > h.mix ? "+" + fmt(b.min - h.mix) + " crt"
              : aktif ? "dipakai" : "terlampaui") +
          "</div></div>";
      }).join("") + "</div>";

    tangga += '<div class="sec">Ikat target TPH · ' + esc(sim.channel) + "</div><div class=\"tbl\">" +
      '<div class="lad head"><div>Zona</div><div class="r">Min mix /bln</div>' +
      '<div class="r">Cashback /crt</div><div class="r">Bonus 350</div><div class="r">Nett 350 akhir</div></div>' +
      (SIM.tph.ikat[sim.channel] || []).slice().reverse().map(function (b) {
        var aktif = h.band && b.zona === h.band.zona;
        var cb = sim.capai ? b.cb : 0;
        var minB = minBulan(b);
        var bonusRp = (sim.capai && sim.w03 && minB) ? b.bonus * h.nett350 / minB : 0;
        return '<div class="lad' + (aktif ? " on" : "") + '">' +
          '<div><span class="pill ' + (aktif ? "good" : "none") + '">' + esc(b.zona) + "</span></div>" +
          '<div class="r num"><span class="mlabel">Min mix </span>' + fmt(minB) + " crt" +
          '<div class="sub2">' + fmt(b.min / NWEEK) + " /minggu</div></div>" +
          '<div class="r num"><span class="mlabel">Cashback </span>' + rp(b.cb) + "</div>" +
          '<div class="r num"><span class="mlabel">Bonus </span>' + fmt(b.bonus) + " crt</div>" +
          '<div class="r num"><span class="mlabel">Nett 350 </span>' + rp(h.nett350 - cb - bonusRp) + "</div>" +
          "</div>";
      }).join("") + "</div>";

    return '<section class="cards sim-cards">' + kartu + "</section>" + hint +
      '<div class="sec">Rincian</div>' + rinci + tangga + catatanSim("tph");
  }

  function hasilLm600(p) {
    var h = hitungLm600();
    var kartu =
      besar("Nett 600 akhir", rp(h.akhir), "setelah DOF, cashback, bonus TW") +
      besar("Total cashback", rp(h.totalCb), fmt(sim.q1) + " crt x " + rp(h.cb)) +
      besar("Bonus triwulan", rp(h.totalBonus), sim.tw === "BELUM" ? "belum memenuhi" : "status " + sim.tw);

    var rinci =
      hist2("Total mix DOF", fmt(h.mix) + " crt") +
      hist2("Nett setelah DOF", rp(h.nett)) +
      hist2("Rata-rata per minggu", fmt(h.perWk) + " crt (" + minggu() + " minggu)") +
      hist2("Zona ikat target", h.zona || "belum masuk strata") +
      hist2("Cashback per crt", rp(h.cb)) +
      hist2("Bonus triwulan per crt", rp(h.bonus)) +
      hist2("Nett akhir", rp(h.akhir));

    return '<section class="cards sim-cards">' + kartu + "</section>" +
      hintLm(h, SIM.lm.ikat600, sim.q1, h.nett, "600") +
      '<div class="sec">Rincian</div>' + rinci +
      tanggaNettLm(h.mix, ["600"]) +
      tanggaIkatLm(SIM.lm.ikat600, h, [{ sku: "600", nett: h.nett, cb: "cb" }]) +
      catatanSim("lm");
  }

  function hasilLmMix(p) {
    var h = hitungLmMix();
    var kartu =
      besar("Nett 1500 akhir", rp(h.akhir1500), "setelah DOF, cashback, bonus TW") +
      besar("Nett 330 akhir", rp(h.akhir330), "setelah DOF, cashback, bonus TW") +
      besar("Total cashback", rp(h.totalCb), "bonus TW " + rp(h.totalBonus));

    var rinci =
      hist2("Total mix DOF", fmt(h.mix) + " crt") +
      hist2("Nett setelah DOF", rp(h.nett1500) + " / " + rp(h.nett330)) +
      hist2("Rata-rata per minggu", fmt(h.perWk) + " crt (" + minggu() + " minggu)") +
      hist2("Zona ikat target", h.zona || "belum masuk strata") +
      hist2("Cashback per crt", rp(h.cb1500) + " / " + rp(h.cb330)) +
      hist2("Bonus triwulan per crt", rp(h.bonus1500) + " / " + rp(h.bonus330)) +
      hist2("Nett akhir 1500 / 330", rp(h.akhir1500) + " / " + rp(h.akhir330));

    return '<section class="cards sim-cards">' + kartu + "</section>" +
      hintLm(h, SIM.lm.ikatMix, sim.q1 + sim.q2, h.nett1500, "1500") +
      '<div class="sec">Rincian</div>' + rinci +
      tanggaNettLm(h.mix, ["1500", "330"]) +
      tanggaIkatLm(SIM.lm.ikatMix, h, [{ sku: "1500", nett: h.nett1500, cb: "cb" },
        { sku: "330", nett: h.nett330, cb: "cb330" }]) +
      catatanSim("lm");
  }

  /* Band berikutnya di atas nilai sekarang. */
  function naikBand(tabel, nilai) {
    for (var i = tabel.length - 1; i >= 0; i--) {
      if (tabel[i].min > nilai) return tabel[i];
    }
    return null;
  }

  function naikBandBulanan(tabel, nilai) {
    var s = skalaMinggu();
    for (var i = tabel.length - 1; i >= 0; i--) {
      if (tabel[i].min * s > nilai) return tabel[i];
    }
    return null;
  }

  function naikDof(mix) {
    var hasil = null;
    SIM.tph.dof.forEach(function (b) {
      if (b.min > mix && (!hasil || b.min < hasil.min)) hasil = b;
    });
    return hasil;
  }

  function hintLm(h, tabel, qty, nett, sku) {
    var naik = naikBand(tabel, h.perWk);
    var out = "";
    if (naik) {
      var tambah = Math.ceil(naik.min * minggu() - qty);
      var bonus = bonusTw(naik, sim.tw, "tw90", "tw100");
      out += '<div class="sim-hint"><b>Tambah ' + fmt(tambah) + " crt</b> (jadi " +
        fmt(qty + tambah) + " crt/bulan, " + fmt(naik.min) + " /minggu) → zona " + esc(naik.zona) +
        ", cashback " + rp(naik.cb) + " /crt. Nett " + esc(sku) + " jadi " +
        rp(nett - naik.cb - bonus) + ". Tarif zona baru berlaku untuk seluruh volume.</div>";
    }
    var tierNaik = null;
    SIM.lm.nett.forEach(function (b) {
      if (b.min > h.mix && (!tierNaik || b.min < tierNaik.min)) tierNaik = b;
    });
    if (tierNaik) {
      var hargaNaik = nettLm(tierNaik.min, sku, sim.channel, sim.pl);
      if (hargaNaik && hargaNaik < nett) {
        out += '<div class="sim-hint">Tier DOF berikutnya di ' + fmt(tierNaik.min) +
          " crt mix (tambah " + fmt(tierNaik.min - h.mix) + "): nett " + esc(sku) + " turun ke " +
          rp(hargaNaik) + ".</div>";
      }
    }
    return out;
  }

  function tanggaNettLm(mix, skus) {
    var head = '<div class="lad head"><div>Min mix</div>' +
      skus.map(function (s) { return '<div class="r">Nett ' + esc(s) + "</div>"; }).join("") +
      '<div class="r">Dari mix ini</div></div>';
    var aktifMin = -1;
    SIM.lm.nett.forEach(function (b) { if (mix >= b.min && b.min > aktifMin) aktifMin = b.min; });
    var body = SIM.lm.nett.slice().reverse().map(function (b) {
      var aktif = b.min === aktifMin;
      return '<div class="lad' + (aktif ? " on" : "") + '">' +
        "<div>" + fmt(b.min) + " crt</div>" +
        skus.map(function (s) {
          // Harga di tier itu dihitung lewat nettLm, bukan dibaca mentah, supaya
          // tangga yang tampil sama persis dengan angka yang dipakai hasil.
          return '<div class="r num"><span class="mlabel">Nett ' + esc(s) + " </span>" +
            rp(nettLm(b.min, s, sim.channel, sim.pl)) + "</div>";
        }).join("") +
        '<div class="r num"><span class="mlabel">Selisih </span>' +
        (b.min > mix ? "+" + fmt(b.min - mix) + " crt" : aktif ? "dipakai" : "terlampaui") +
        "</div></div>";
    }).join("");
    return '<div class="sec">Tangga nett DOF · ' + esc(sim.channel) + " · PL " +
      (sim.pl === "lama" ? "lama" : "baru") + "</div><div class=\"tbl\">" + head + body + "</div>";
  }

  function tanggaIkatLm(tabel, h, skus) {
    var head = '<div class="lad head"><div>Zona</div><div class="r">Min /minggu</div>' +
      '<div class="r">Cashback /crt</div>' +
      skus.map(function (s) { return '<div class="r">Nett ' + esc(s.sku) + " akhir</div>"; }).join("") +
      "</div>";
    var body = tabel.slice().reverse().map(function (b) {
      var aktif = h.band && b.zona === h.band.zona;
      var bonus = bonusTw(b, sim.tw, "tw90", "tw100");
      return '<div class="lad' + (aktif ? " on" : "") + '">' +
        '<div><span class="pill ' + (aktif ? "good" : "none") + '">' + esc(b.zona) + "</span></div>" +
        '<div class="r num"><span class="mlabel">Min </span>' + fmt(b.min) + " crt" +
        '<div class="sub2">' + fmt(b.min * minggu()) + " /bulan</div></div>" +
        '<div class="r num"><span class="mlabel">Cashback </span>' + rp(b.cb) +
        (skus.length > 1 ? " / " + rp(b.cb330 || 0) : "") + "</div>" +
        skus.map(function (s) {
          var cb = b[s.cb] || 0;
          var bn = s.sku === "330" ? (sim.tw !== "BELUM" ? b.tw330 || 0 : 0) : bonus;
          return '<div class="r num"><span class="mlabel">Nett ' + esc(s.sku) + " </span>" +
            rp(s.nett - cb - bn) + "</div>";
        }).join("") +
        "</div>";
    }).join("");
    return '<div class="sec">Ikat target · zona per minggu</div><div class="tbl">' + head + body + "</div>";
  }

  /* ── Simulasi sederhana untuk produk tanpa sheet harga ─────────────── */
  function tarifPada(bands, vol, share) {
    var skala = skalaMinggu();
    for (var i = 0; i < bands.length; i++) {
      if (vol >= bands[i].min * skala) {
        var b = bands[i];
        var rate = (b.rate2 === null || b.rate2 === undefined)
          ? b.rate
          : b.rate * share + b.rate2 * (1 - share);
        return { rate: rate, zona: b.zona, min: b.min * skala };
      }
    }
    return { rate: 0, zona: "", min: 0 };
  }

  function hasilUmum(p) {
    var satuan = p.satuan || "crt";
    var h = hargaProduk(p);
    var bands = bandsSim(p, sim.channel);
    var vol = sim.vol;
    var kini = tarifPada(bands, vol, sim.share);
    var syaratAch = p.rows.length && p.rows[0].cb && p.rows[0].cb.syaratAch;
    var gugurAch = syaratAch && sim.tgt > 0 && vol < sim.tgt;
    var rate = gugurAch ? 0 : kini.rate;
    var cb = Math.round(vol * rate);
    var nett = h.crt ? h.crt - rate : null;
    var bayar = h.crt ? h.crt * vol - cb : null;

    var kartu =
      '<div class="card besar"><div class="k">Zona</div><div class="v"><span class="pill ' +
      (gugurAch || !kini.zona ? "crit" : "good") + '">' +
      (gugurAch ? "tertahan" : kini.zona || "–") + "</span></div>" +
      '<div class="m">' + fmt(vol) + " " + esc(satuan) + " / bulan</div></div>" +
      besar("Harga nett /" + satuan, nett === null ? "–" : rp(nett),
        h.crt ? "dari " + rp(h.crt) + (h.isi ? " · " + rp(nett / h.isi) + " /pcs" : "")
          : "isi harga jual dulu") +
      besar("Total cashback", rp(cb), gugurAch ? "tertahan: target belum tercapai"
        : kini.zona ? "zona " + kini.zona : "di bawah strata terendah");

    var rinci =
      hist2("Tarif cashback", rp(rate) + " / " + esc(satuan)) +
      hist2("Diskon efektif", h.crt ? pct1(rate / h.crt) : "–") +
      hist2("Total bayar", bayar === null ? "–" : rp(bayar));

    var naik = naikBandBulanan(bands, vol);
    var hint = "";
    if (naik) {
      var minNaik = minBulan(naik);
      var rNaik = tarifPada(bands, minNaik, sim.share).rate;
      var cbNaik = Math.round(minNaik * rNaik);
      hint = '<div class="sim-hint"><b>Tambah ' + fmt(minNaik - vol) + " " + esc(satuan) +
        "</b> lagi (jadi " + fmt(minNaik) + ") → zona " + esc(naik.zona) + ", tarif " +
        rp(rNaik) + " /" + esc(satuan) + ". Total cashback " + rp(cbNaik) +
        " (naik " + rp(cbNaik - cb) + ")" +
        (h.crt ? ", harga nett " + rp(h.crt - rNaik) + " /" + esc(satuan) : "") +
        ". Tarif zona baru berlaku untuk seluruh volume.</div>";
    } else if (bands.length) {
      hint = '<div class="sim-hint">Sudah di zona tertinggi program ini.</div>';
    }

    var ladHead = '<div class="lad head"><div>Zona</div><div class="r">Minimal</div>' +
      '<div class="r">Tarif /' + esc(satuan) + '</div><div class="r">Harga nett</div>' +
      '<div class="r">Dari volume ini</div></div>';
    var ladBody = bands.slice().reverse().map(function (b) {
      var minB = minBulan(b);
      var r2 = tarifPada(bands, minB, sim.share).rate;
      var aktif = b.zona === kini.zona && !gugurAch;
      var selisih = minB - vol;
      return '<div class="lad' + (aktif ? " on" : "") + '">' +
        '<div><span class="pill ' + (aktif ? "good" : "none") + '">' + esc(b.zona || "–") + "</span></div>" +
        '<div class="r num"><span class="mlabel">Minimal </span>' + fmt(minB) + " " + esc(satuan) +
        '<div class="sub2">' + fmt(b.min / NWEEK) + " /minggu</div></div>" +
        '<div class="r num"><span class="mlabel">Tarif </span>' + rp(r2) + "</div>" +
        '<div class="r num"><span class="mlabel">Nett </span>' + (h.crt ? rp(h.crt - r2) : "–") + "</div>" +
        '<div class="r num"><span class="mlabel">Selisih </span>' +
        (selisih > 0 ? "+" + fmt(selisih) + " " + esc(satuan)
          : aktif ? "zona sekarang" : "terlampaui") + "</div>" +
        "</div>";
    }).join("");

    return '<section class="cards sim-cards">' + kartu + "</section>" + hint +
      (syaratAch
        ? '<p class="note">' + esc(p.label) +
          " hanya dibayar kalau target bulan itu tercapai, jadi volume di bawah target tidak menghasilkan cashback.</p>"
        : "") +
      '<div class="sec">Rincian</div>' + rinci +
      '<div class="sec">Strata ' + esc(p.label) + " — " + minggu() + " minggu</div>" +
      '<div class="tbl">' + ladHead + ladBody + "</div>" +
      '<p class="note">Produk ini belum punya sheet simulasi harga di workbook, jadi harga jualnya' +
      " diisi sendiri dan hanya tersimpan di peramban ini. Tarif dan zonanya tetap dari tabel strata di file.</p>";
  }

  /* ── Ekspor tangga simulasi ────────────────────────────────────────── */
  function exportSim() {
    var p = produkSim();
    if (!p) return;
    var jenis = jenisSim(p);
    var baris = [["Produk", p.label], ["Channel", sim.channel || "semua"]];
    var satuan = p.satuan || "crt";

    if (jenis === "tph") {
      var t = hitungTph();
      baris.push(["Price list", sim.pl], ["Qty 350", sim.q1], ["Qty 500", sim.q2],
        ["Total mix", t.mix], ["DOF /crt", t.dof], ["Zona", t.zona],
        ["Cashback /crt", t.cb], ["Bonus 350 (crt)", t.bonusCrt],
        ["Nett 350 akhir", Math.round(t.akhir350)], ["Nett 500 akhir", Math.round(t.akhir500)],
        ["Total benefit", Math.round(t.benefit)], [],
        ["Zona", "Min mix", "Cashback /crt", "Bonus crt", "Nett 350 akhir"]);
      (SIM.tph.ikat[sim.channel] || []).slice().reverse().forEach(function (b) {
        var bonusRp = (sim.capai && sim.w03 && b.min) ? b.bonus * t.nett350 / minBulan(b) : 0;
        baris.push([b.zona, minBulan(b), b.cb, b.bonus,
          Math.round(t.nett350 - (sim.capai ? b.cb : 0) - bonusRp)]);
      });
    } else if (jenis === "lm600" || jenis === "lmmix") {
      var m = jenis === "lm600" ? hitungLm600() : hitungLmMix();
      baris.push(["Price list", sim.pl], ["Status triwulan", sim.tw],
        ["Qty utama", sim.q1], ["Qty kedua", sim.q2], ["Qty LM lain", sim.qLain],
        ["Total mix DOF", m.mix], ["Rata-rata /minggu", Math.round(m.perWk)],
        ["Zona", m.zona]);
      if (jenis === "lm600") {
        baris.push(["Nett DOF", m.nett], ["Cashback /crt", m.cb], ["Bonus TW /crt", m.bonus],
          ["Nett akhir", Math.round(m.akhir)]);
      } else {
        baris.push(["Nett DOF 1500 / 330", m.nett1500 + " / " + m.nett330],
          ["Cashback /crt 1500 / 330", m.cb1500 + " / " + m.cb330],
          ["Bonus TW /crt 1500 / 330", m.bonus1500 + " / " + m.bonus330],
          ["Nett akhir 1500", Math.round(m.akhir1500)],
          ["Nett akhir 330", Math.round(m.akhir330)]);
      }
      baris.push(["Total cashback", Math.round(m.totalCb)], ["Bonus triwulan", Math.round(m.totalBonus)],
        [], ["Zona", "Min /minggu", "Min /bulan", "Cashback /crt"]);
      (jenis === "lm600" ? SIM.lm.ikat600 : SIM.lm.ikatMix).slice().reverse().forEach(function (b) {
        baris.push([b.zona, b.min, b.min * minggu(), b.cb]);
      });
    } else {
      var h = hargaProduk(p);
      var bands = bandsSim(p, sim.channel);
      baris.push(["Satuan", satuan], ["Jumlah minggu", minggu()],
        ["Harga jual / " + satuan, h.crt || ""], ["Volume disimulasikan", sim.vol], [],
        ["Zona", "Minimal (" + satuan + ")", "Minimal / minggu", "Tarif /" + satuan,
          "Harga nett /" + satuan, "Total cashback di minimal"]);
      bands.slice().reverse().forEach(function (b) {
        var r = tarifPada(bands, minBulan(b), sim.share).rate;
        baris.push([b.zona, minBulan(b), Math.round(b.min / NWEEK), Math.round(r),
          h.crt ? Math.round(h.crt - r) : "", Math.round(minBulan(b) * r)]);
      });
    }

    var teks = baris.map(function (cols) {
      return cols.map(function (c) {
        var s = c === null || c === undefined ? "" : String(c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    }).join("\r\n");

    saveFile("simulasi-harga-" + p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv",
      "﻿" + teks);
  }

  /* ── Pemasangan isian ──────────────────────────────────────────────── */
  function bindSim() {
    var p = produkSim();
    if (!p) return;
    var jenis = jenisSim(p);
    drawSim();

    function pasang(id, fn, peristiwa) {
      var el = $("#" + id);
      if (el) el.addEventListener(peristiwa || "input", function () { fn(el); });
    }

    pasang("s-produk", function (el) {
      sim.produk = el.value;
      sim.siap = "";
      sim.outlet = "";
      render();
    }, "change");

    pasang("s-channel", function (el) { sim.channel = el.value; drawSim(); }, "change");
    pasang("s-minggu", function (el) { sim.minggu = Number(el.value) || NWEEK; drawSim(); }, "change");
    pasang("s-pl", function (el) { sim.pl = el.value; drawSim(); }, "change");
    pasang("s-tw", function (el) { sim.tw = el.value; drawSim(); }, "change");
    pasang("s-capai", function (el) { sim.capai = el.value === "ya"; drawSim(); }, "change");
    pasang("s-w03", function (el) { sim.w03 = el.value === "ya"; drawSim(); }, "change");
    pasang("s-syarat", function (el) { sim.syarat = el.value === "ya"; drawSim(); }, "change");
    pasang("s-q2", function (el) { sim.q2 = angka(el.value); drawSim(); });
    pasang("s-qlain", function (el) { sim.qLain = angka(el.value); drawSim(); });
    pasang("s-isi", function (el) { setHarga(p, "isi", el.value); drawSim(); });
    pasang("s-harga", function (el) { setHarga(p, "crt", el.value); drawSim(); });
    pasang("s-tgt", function (el) { sim.tgt = angka(el.value); drawSim(); });

    if (jenis === "umum") {
      var vol = $("#s-vol"), rng = $("#s-range");
      var setVol = function (v, dari) {
        sim.vol = angka(v);
        if (dari !== "vol") vol.value = sim.vol;
        if (dari !== "range" && sim.vol <= Number(rng.max)) rng.value = sim.vol;
        drawSim();
      };
      vol.addEventListener("input", function () { setVol(vol.value, "vol"); });
      rng.addEventListener("input", function () { setVol(rng.value, "range"); });
    } else {
      pasang("s-q1", function (el) { sim.q1 = angka(el.value); drawSim(); });
    }
  }

  function angka(v) {
    return Math.max(Math.round(Number(v) || 0), 0);
  }

  /* Buka simulasi dengan angka satu outlet. */
  function simDariOutlet(uid) {
    var r = ROWS.filter(function (x) { return x.uid === uid; })[0];
    if (!r) return;
    var p = produkById(r.produkId);
    if (!p) return;
    var jenis = jenisSim(p);
    sim.produk = p.id;
    sim.siap = p.id;
    sim.channel = channelDari(r.tipe, channelSim(jenis, p));
    sim.share = r.share === null || r.share === undefined ? 1 : r.share;
    var tgt = Math.round(r.tgt || r.total || 0);
    if (jenis === "lmmix") {
      sim.q1 = Math.round(tgt * sim.share);
      sim.q2 = tgt - sim.q1;
    } else if (jenis === "tph") {
      sim.q1 = tgt;
      sim.q2 = 0;
    } else {
      sim.q1 = tgt;
    }
    sim.qLain = 0;
    sim.vol = tgt;
    sim.tgt = Math.round(r.tgt || 0);
    sim.outlet = r.nama + " — target " + fmt(r.tgt) + " " + (r.satuan || "crt") +
      ", realisasi " + fmt(r.total);
    closeDetail();
    pilihView("simulasi");
  }

  function pilihView(nama) {
    state.view = nama;
    Array.prototype.forEach.call($("#views").children, function (t) {
      t.setAttribute("aria-pressed", String(t.dataset.view === nama));
    });
    render();
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  function render() {
    syncSelects();

    // Simulasi harga tidak memakai daftar outlet, jadi filter dan ringkasannya
    // ikut disembunyikan supaya layarnya bersih — terutama di HP.
    var simView = state.view === "simulasi";
    $(".filters").hidden = simView;
    $("#summary").hidden = simView;

    var rows = filtered();
    if (simView) $("#satuan-note").hidden = true;
    else renderSummary(rows);

    var html;
    if (simView) html = renderSimulasi();
    else if (state.view === "sales") html = renderGroups(rows, "sales");
    else if (state.view === "wilayah") html = renderGroups(rows, "wilayah");
    else html = renderOutlets(rows.slice().sort(SORTS[state.sort]));

    $("#list").innerHTML = html;
    if (simView) bindSim();
    $("#count").textContent = simView ? "" : rows.length + " dari " + byProduct().length + " outlet";
    $("#sort-wrap").hidden = state.view !== "outlet";
  }

  /* ── Pemasangan UI ────────────────────────────────────────────────── */
  function buildTabs() {
    var tabs = [{ id: "all", label: "Semua Produk", n: ROWS.length }].concat(
      DATA.products.map(function (p) { return { id: p.id, label: p.label, n: p.rows.length }; })
    );
    $("#tabs").innerHTML = tabs.map(function (t) {
      return '<button class="tab" role="tab" data-id="' + esc(t.id) + '" aria-selected="' +
        (t.id === state.produk) + '">' + esc(t.label) + '<span class="n">' + t.n + "</span></button>";
    }).join("");
  }

  /* master-target-september-2026.csv — namanya ikut periode datanya. */
  function namaBerkas(ext) {
    var slug = (DATA.periode || "target").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return "master-target-" + slug + "." + ext;
  }

  function periodeSingkat() {
    var w = WEEKS.length ? WEEKS[0] + "–" + WEEKS[WEEKS.length - 1] : "";
    return (DATA.periode || "") + (w ? " (" + w + ")" : "");
  }

  /* Sales perlu tahu data ini seumur apa sebelum memakainya di lapangan. */
  function stampData() {
    if (!DATA.tanggal) return;
    var bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
      "Agustus", "September", "Oktober", "November", "Desember"];
    var d = DATA.tanggal.split("-");
    $("#stamp").textContent = "Data per " + Number(d[2]) + " " + bulan[Number(d[1]) - 1] + " " + d[0] +
      (DATA.sumber ? ", dari " + DATA.sumber : "") + ".";
  }

  function init() {
    // Jumlah minggu ikut workbook (Agustus 4 minggu, September 5), jadi lebar
    // kolom mingguan diatur lewat variabel CSS, bukan angka tetap.
    document.documentElement.style.setProperty("--nweek", WEEKS.length || 4);
    $("#periode").textContent = periodeSingkat();
    $("#f-wilayah-label").textContent = LBL_WILAYAH;
    $("#f-wilayah").options[0].textContent = "Semua " + LBL_WILAYAH.toLowerCase();
    $("#view-wilayah").textContent = "Per " + LBL_WILAYAH;

    buildTabs();
    stampData();

    $("#tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (!b) return;
      state.produk = b.dataset.id;
      Array.prototype.forEach.call($("#tabs").children, function (t) {
        t.setAttribute("aria-selected", String(t === b));
      });
      render();
    });

    var q = $("#f-q"), timer;
    q.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = q.value; render(); }, 120);
    });

    ["sales", "wilayah", "zona", "tipe", "pilih", "ket", "status"].forEach(function (k) {
      $("#f-" + k).addEventListener("change", function (e) { state[k] = e.target.value; render(); });
    });

    $("#f-sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });

    $("#reset").addEventListener("click", function () {
      state.q = state.sales = state.wilayah = state.zona = "";
      state.tipe = state.pilih = state.ket = state.status = "";
      q.value = "";
      $("#f-status").value = "";
      render();
      q.focus();
    });

    $("#views").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b) pilihView(b.dataset.view);
    });

    $("#list").addEventListener("click", function (e) {
      var row = e.target.closest(".tr[data-uid]");
      if (row) openDetail(row.dataset.uid);
    });

    $("#detail").addEventListener("click", function (e) {
      var b = e.target.closest("[data-sim]");
      if (b) simDariOutlet(b.dataset.sim);
    });

    // Produk tanpa tabel strata tidak bisa disimulasikan.
    $("#view-simulasi").hidden = !produkBerstrata().length;

    $("#export").addEventListener("click", exportCsv);
    $("#scrim").addEventListener("click", closeDetail);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDetail();
    });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
