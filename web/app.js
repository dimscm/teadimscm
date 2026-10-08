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
     Workbook target tidak memuat harga jual, jadi harganya diisi di halaman
     ini dan diingat per produk di peramban. Yang datang dari data adalah
     tabel strata: volume sebulan menentukan zona, zona menentukan tarif
     cashback per karton — dan tarif itu berlaku untuk SELURUH volume, jadi
     naik satu zona memurahkan semua karton, bukan cuma tambahannya. */
  var HARGA_KEY = "mt.harga.v1";
  var hargaSimpan = bacaHarga();
  var sim = { produk: "", siap: "", tipe: "", share: 1, vol: 0, tgt: 0, outlet: "" };

  function bacaHarga() {
    try { return JSON.parse(localStorage.getItem(HARGA_KEY)) || {}; } catch (e) { return {}; }
  }

  function simpanHarga() {
    try { localStorage.setItem(HARGA_KEY, JSON.stringify(hargaSimpan)); } catch (e) { /* mode privat */ }
  }

  /* Harga disimpan per nama produk, bukan per id sheet: nama sheet ikut
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

  function produkBerstrata() {
    return DATA.products.filter(function (p) {
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

  function tipeSim(p) {
    var s = p.strata || {};
    return Object.keys(s).filter(function (k) { return k && s[k].length; }).sort();
  }

  function bandsSim(p, tipe) {
    var s = p.strata || {};
    return s[(tipe || "").toUpperCase()] || s[""] || [];
  }

  function produkById(id) {
    return DATA.products.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* Band tersusun dari ambang terbesar ke terkecil, jadi yang pertama cocok
     adalah zona yang berlaku. */
  function tarifPada(bands, vol, share) {
    for (var i = 0; i < bands.length; i++) {
      if (vol >= bands[i].min) {
        var b = bands[i];
        var rate = (b.rate2 === null || b.rate2 === undefined)
          ? b.rate
          : b.rate * share + b.rate2 * (1 - share);
        return { rate: rate, zona: b.zona, min: b.min };
      }
    }
    return { rate: 0, zona: "", min: 0 };
  }

  function barisProduk(id) {
    return ROWS.filter(function (r) { return r.produkId === id; });
  }

  /* Nilai awal yang masuk akal diambil dari outlet produk itu sendiri. */
  function siapkanSim(p) {
    if (sim.siap === p.id) return;
    var rows = barisProduk(p.id);
    var tipes = tipeSim(p);
    var hitung = {};
    rows.forEach(function (r) {
      var t = (r.tipe || "").toUpperCase();
      if (tipes.indexOf(t) > -1) hitung[t] = (hitung[t] || 0) + 1;
    });
    sim.tipe = tipes.sort(function (a, b) { return (hitung[b] || 0) - (hitung[a] || 0); })[0] || "";

    var share = rows.map(function (r) { return r.share; })
      .filter(function (v) { return v !== null && v !== undefined; });
    sim.share = share.length
      ? share.reduce(function (a, b) { return a + b; }, 0) / share.length
      : 1;

    var tgt = rows.map(function (r) { return r.tgt; })
      .filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    var bands = bandsSim(p, sim.tipe);
    sim.vol = Math.round(tgt.length
      ? tgt[Math.floor(tgt.length / 2)]
      : (bands.length ? bands[bands.length - 1].min : 100));
    sim.tgt = sim.vol;
    sim.outlet = "";
    sim.produk = p.id;
    sim.siap = p.id;
  }

  function renderSimulasi() {
    var p = produkSim();
    if (!p) {
      return '<div class="tbl"><div class="empty">Tabel strata produk ini belum ada di data,' +
        "<br>jadi simulasi harganya belum bisa dihitung.</div></div>";
    }
    siapkanSim(p);

    var list = produkBerstrata();
    var tipes = tipeSim(p);
    var h = hargaProduk(p);
    var satuan = p.satuan || "crt";
    var bands = bandsSim(p, sim.tipe);
    var maxVol = Math.max(Math.round((bands.length ? bands[0].min : 100) * 1.25), sim.vol);
    var syaratAch = p.rows.length && p.rows[0].cb && p.rows[0].cb.syaratAch;
    var duaUkuran = (p.ukuran || []).length > 1;

    var f = "";
    f += '<div class="field"><label for="s-produk">Produk</label><select id="s-produk">' +
      list.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" +
          esc(x.label) + "</option>";
      }).join("") + "</select></div>";

    if (tipes.length > 1) {
      f += '<div class="field"><label for="s-tipe">Tipe outlet</label><select id="s-tipe">' +
        tipes.map(function (t) {
          return '<option value="' + esc(t) + '"' + (t === sim.tipe ? " selected" : "") + ">" +
            esc(t) + "</option>";
        }).join("") + "</select></div>";
    }

    f += '<div class="field"><label for="s-harga">Harga jual / ' + esc(satuan) + ' (Rp)</label>' +
      '<input id="s-harga" type="number" inputmode="numeric" min="0" step="1000" placeholder="isi harga" value="' +
      (h.crt || "") + '"></div>';
    f += '<div class="field"><label for="s-isi">Isi / ' + esc(satuan) + ' (opsional)</label>' +
      '<input id="s-isi" type="number" inputmode="numeric" min="0" step="1" placeholder="mis. 24" value="' +
      (h.isi || "") + '"></div>';
    f += '<div class="field"><label for="s-vol">Volume (' + esc(satuan) + ')</label>' +
      '<input id="s-vol" type="number" inputmode="numeric" min="0" step="1" value="' + sim.vol + '"></div>';
    if (syaratAch) {
      f += '<div class="field"><label for="s-tgt">Target bulan ini</label>' +
        '<input id="s-tgt" type="number" inputmode="numeric" min="0" step="1" value="' + sim.tgt + '"></div>';
    }
    if (duaUkuran) {
      f += '<div class="field"><label for="s-share">Porsi ' + esc(p.ukuran[0]) + ' (%)</label>' +
        '<input id="s-share" type="number" inputmode="numeric" min="0" max="100" step="5" value="' +
        Math.round(sim.share * 100) + '"></div>';
    }

    return '<div class="sim">' +
      (sim.outlet ? '<div class="sim-from">Prasetel dari <b>' + esc(sim.outlet) + "</b></div>" : "") +
      '<div class="sim-form">' + f + "</div>" +
      '<label class="sim-range"><span>Geser volume</span>' +
      '<input id="s-range" type="range" min="0" max="' + maxVol + '" step="1" value="' + sim.vol +
      '" aria-label="Volume"></label>' +
      '<div id="sim-out"></div>' +
      "</div>";
  }

  /* Hanya bagian hasil yang digambar ulang saat angka diketik, supaya kursor
     tidak lompat keluar dari kotak isian. */
  function drawSim() {
    var p = produkSim();
    if (!p || !$("#sim-out")) return;
    var satuan = p.satuan || "crt";
    var h = hargaProduk(p);
    var bands = bandsSim(p, sim.tipe);
    var vol = sim.vol;
    var kini = tarifPada(bands, vol, sim.share);
    var syaratAch = p.rows.length && p.rows[0].cb && p.rows[0].cb.syaratAch;
    var gugurAch = syaratAch && sim.tgt > 0 && vol < sim.tgt;
    var rate = gugurAch ? 0 : kini.rate;
    var cb = Math.round(vol * rate);
    var nett = h.crt ? h.crt - rate : null;
    var bayar = h.crt ? h.crt * vol - cb : null;

    var catatanTarif = gugurAch
      ? "tertahan: target belum tercapai"
      : (kini.zona ? "zona " + kini.zona : "di bawah strata terendah");

    var kartu =
      '<div class="card"><div class="k">Zona</div><div class="v"><span class="pill ' +
      (gugurAch ? "crit" : kini.zona ? "good" : "crit") + '">' +
      (gugurAch ? "tertahan" : kini.zona || "–") + "</span></div>" +
      '<div class="m">' + fmt(vol) + " " + esc(satuan) + " / bulan</div></div>" +
      card("Tarif cashback", rp(rate) + " /" + satuan, catatanTarif) +
      card("Total cashback", rp(cb), vol > 0 ? "untuk " + fmt(vol) + " " + satuan : "belum ada volume") +
      card("Harga nett /" + satuan, nett === null ? "–" : rp(nett),
        h.crt ? "dari " + rp(h.crt) + (h.isi ? " · " + rp(nett / h.isi) + " /pcs" : "")
          : "isi harga jual dulu") +
      card("Diskon efektif", h.crt ? pct1(rate / h.crt) : "–",
        h.crt ? "potongan dari harga jual" : "butuh harga jual") +
      card("Total bayar", bayar === null ? "–" : rp(bayar),
        h.crt ? "setelah cashback" : "butuh harga jual");

    // Band berikutnya di atas volume sekarang: inilah tawaran yang dipakai di
    // depan toko, karena tarif baru berlaku untuk seluruh volume.
    var naik = null;
    for (var i = bands.length - 1; i >= 0; i--) {
      if (bands[i].min > vol) { naik = bands[i]; break; }
    }
    var hint = "";
    if (naik) {
      var rNaik = tarifPada(bands, naik.min, sim.share).rate;
      var cbNaik = Math.round(naik.min * rNaik);
      hint = '<div class="sim-hint"><b>Tambah ' + fmt(naik.min - vol) + " " + esc(satuan) +
        "</b> lagi (jadi " + fmt(naik.min) + ") → zona " + esc(naik.zona) + ", tarif " +
        rp(rNaik) + " /" + esc(satuan) + ". Total cashback " + rp(cbNaik) +
        " (naik " + rp(cbNaik - cb) + ")" +
        (h.crt ? ", harga nett " + rp(h.crt - rNaik) + " /" + esc(satuan) : "") +
        ". Tarif zona baru berlaku untuk seluruh volume, bukan cuma tambahannya.</div>";
    } else if (bands.length) {
      hint = '<div class="sim-hint">Sudah di zona tertinggi program ini.</div>';
    }

    var ladHead = '<div class="lad head"><div>Zona</div><div class="r">Minimal</div>' +
      '<div class="r">Tarif /' + esc(satuan) + '</div><div class="r">Harga nett</div>' +
      '<div class="r">Dari volume ini</div></div>';
    var ladBody = bands.slice().reverse().map(function (b) {
      var r2 = tarifPada(bands, b.min, sim.share).rate;
      var aktif = b.zona === kini.zona && !gugurAch;
      var selisih = b.min - vol;
      return '<div class="lad' + (aktif ? " on" : "") + '">' +
        '<div><span class="pill ' + (aktif ? "good" : "none") + '">' + esc(b.zona || "–") + "</span></div>" +
        '<div class="r num"><span class="mlabel">Minimal </span>' + fmt(b.min) + " " + esc(satuan) +
        '<div class="sub2">' + fmt(b.min / (WEEKS.length || 4)) + " /minggu</div></div>" +
        '<div class="r num"><span class="mlabel">Tarif </span>' + rp(r2) + "</div>" +
        '<div class="r num"><span class="mlabel">Nett </span>' + (h.crt ? rp(h.crt - r2) : "–") + "</div>" +
        '<div class="r num"><span class="mlabel">Selisih </span>' +
        (selisih > 0 ? "+" + fmt(selisih) + " " + esc(satuan)
          : aktif ? "zona sekarang" : "terlampaui") + "</div>" +
        "</div>";
    }).join("");

    $("#sim-out").innerHTML =
      '<section class="cards sim-cards">' + kartu + "</section>" +
      hint +
      (syaratAch
        ? '<p class="note">Nipis Madu hanya dibayar kalau target bulan itu tercapai, jadi volume di bawah target tidak menghasilkan cashback.</p>'
        : "") +
      '<div class="sec">Strata ' + esc(p.label) +
      (sim.tipe ? " · " + esc(sim.tipe) : "") + " — " + (WEEKS.length || 4) + " minggu</div>" +
      '<div class="tbl">' + ladHead + ladBody + "</div>" +
      '<p class="note">Harga jual tidak ada di workbook target, jadi angka harga yang dipakai di sini' +
      " adalah yang diisi sendiri dan tersimpan di peramban ini saja. Tarif cashback, zona, dan" +
      " ambangnya datang dari tabel strata program di file.</p>";
  }

  /* Tangga strata hasil simulasi, buat dibawa ke toko atau ditempel di grup. */
  function exportSim() {
    var p = produkSim();
    if (!p) return;
    var h = hargaProduk(p);
    var satuan = p.satuan || "crt";
    var bands = bandsSim(p, sim.tipe);
    var baris = [["Produk", p.label], ["Tipe outlet", sim.tipe || "semua"],
      ["Satuan", satuan], ["Jumlah minggu", WEEKS.length || 4],
      ["Harga jual / " + satuan, h.crt || ""], ["Isi / " + satuan, h.isi || ""],
      ["Volume disimulasikan", sim.vol], [],
      ["Zona", "Minimal (" + satuan + ")", "Minimal / minggu", "Tarif /" + satuan,
        "Harga nett /" + satuan, "Total cashback di minimal", "Selisih dari volume"]];

    bands.slice().reverse().forEach(function (b) {
      var r = tarifPada(bands, b.min, sim.share).rate;
      baris.push([b.zona, b.min, Math.round(b.min / (WEEKS.length || 4)), Math.round(r),
        h.crt ? Math.round(h.crt - r) : "", Math.round(b.min * r), Math.round(b.min - sim.vol)]);
    });

    var teks = baris.map(function (cols) {
      return cols.map(function (c) {
        var s = c === null || c === undefined ? "" : String(c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    }).join("\r\n");

    saveFile("simulasi-harga-" + p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv",
      "﻿" + teks);
  }

  function bindSim() {
    var p = produkSim();
    if (!p) return;
    drawSim();

    var ps = $("#s-produk");
    if (ps) {
      ps.addEventListener("change", function () {
        sim.produk = ps.value;
        sim.siap = "";
        render();
      });
    }
    var ts = $("#s-tipe");
    if (ts) {
      ts.addEventListener("change", function () { sim.tipe = ts.value; drawSim(); });
    }

    var vol = $("#s-vol"), rng = $("#s-range");
    function setVol(v, dari) {
      sim.vol = Math.max(Math.round(Number(v) || 0), 0);
      if (dari !== "vol") vol.value = sim.vol;
      if (dari !== "range" && sim.vol <= Number(rng.max)) rng.value = sim.vol;
      drawSim();
    }
    vol.addEventListener("input", function () { setVol(vol.value, "vol"); });
    rng.addEventListener("input", function () { setVol(rng.value, "range"); });

    $("#s-harga").addEventListener("input", function (e) {
      setHarga(p, "crt", e.target.value);
      drawSim();
    });
    $("#s-isi").addEventListener("input", function (e) {
      setHarga(p, "isi", e.target.value);
      drawSim();
    });
    var tg = $("#s-tgt");
    if (tg) {
      tg.addEventListener("input", function () {
        sim.tgt = Math.max(Math.round(Number(tg.value) || 0), 0);
        drawSim();
      });
    }
    var sh = $("#s-share");
    if (sh) {
      sh.addEventListener("input", function () {
        sim.share = Math.min(Math.max(Number(sh.value) || 0, 0), 100) / 100;
        drawSim();
      });
    }
  }

  /* Buka simulasi dengan angka satu outlet: tipe, komposisi, dan targetnya. */
  function simDariOutlet(uid) {
    var r = ROWS.filter(function (x) { return x.uid === uid; })[0];
    if (!r) return;
    var p = produkById(r.produkId);
    if (!p) return;
    sim.produk = p.id;
    sim.siap = p.id;
    var tipes = tipeSim(p);
    sim.tipe = tipes.indexOf((r.tipe || "").toUpperCase()) > -1 ? (r.tipe || "").toUpperCase() : (tipes[0] || "");
    sim.share = r.share === null || r.share === undefined ? 1 : r.share;
    sim.vol = Math.round(r.tgt || r.total || 0);
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
