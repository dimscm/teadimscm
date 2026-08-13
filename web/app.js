/* Master Agustus — penelusur target & realisasi outlet.
   Data dari window.MASTER_DATA (dibuat tools/build_data.py dari MASTER_AGUSTUS.xlsx). */
(function () {
  "use strict";

  var DATA = window.MASTER_DATA || { products: [], weekLabels: [] };
  var WEEKS = DATA.weekLabels || ["W31", "W32", "W33", "W34"];

  /* Satu baris = satu outlet pada satu produk. */
  var ROWS = [];
  DATA.products.forEach(function (p) {
    p.rows.forEach(function (r, i) {
      r.produk = p.label;
      r.produkId = p.id;
      r.zonaLabel = p.zonaLabel;
      r.uid = p.id + "#" + i;
      r.ach = r.tgt > 0 ? r.total / r.tgt : null;
      r.kurang = Math.max(r.tgt - r.total, 0);
      r.cari = (r.nama + " " + r.no + " " + r.alamat + " " + r.sales + " " + r.rayon).toLowerCase();
      ROWS.push(r);
    });
  });

  var state = {
    produk: "all",
    q: "",
    sales: "",
    rayon: "",
    zona: "",
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
    if (skip !== "rayon" && state.rayon && r.rayon !== state.rayon) return false;
    if (skip !== "zona" && state.zona && r.zona !== state.zona) return false;
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
    tgtDesc: function (a, b) { return b.tgt - a.tgt; },
    nama: function (a, b) { return a.nama.localeCompare(b.nama); },
    sales: function (a, b) { return a.sales.localeCompare(b.sales) || a.rayon.localeCompare(b.rayon); }
  };

  /* ── Isi dropdown mengikuti produk yang dipilih ───────────────────── */
  function uniq(rows, key) {
    var set = {};
    rows.forEach(function (r) { if (r[key]) set[r[key]] = 1; });
    return Object.keys(set).sort();
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
    state.rayon = fillSelect($("#f-rayon"), optionsFor("rayon"), state.rayon);

    var zonas = optionsFor("zona");
    var zwrap = $("#f-zona-wrap");
    if (zonas.length) {
      zwrap.hidden = false;
      var labels = {};
      byProduct().forEach(function (r) { if (r.zonaLabel) labels[r.zonaLabel] = 1; });
      $("#f-zona-label").textContent = Object.keys(labels).join(" / ") || "Zona";
      state.zona = fillSelect($("#f-zona"), zonas, state.zona);
    } else {
      zwrap.hidden = true;
      state.zona = "";
    }
  }

  /* ── Ringkasan ────────────────────────────────────────────────────── */
  function totals(rows) {
    var t = { n: rows.length, tgt: 0, tot: 0, kur: 0, nol: 0, ok: 0 };
    rows.forEach(function (r) {
      t.tgt += r.tgt;
      t.tot += r.total;
      t.kur += r.kurang;
      if (r.total <= 0) t.nol++;
      if (r.ach !== null && r.ach >= 1) t.ok++;
    });
    t.ach = t.tgt > 0 ? t.tot / t.tgt : null;
    return t;
  }

  function renderSummary(rows) {
    var t = totals(rows);
    var w = t.ach === null ? 0 : Math.min(t.ach, 1) * 100;
    $("#summary").innerHTML =
      card("Outlet", fmt(t.n), t.nol + " belum order") +
      card("Target", fmt(t.tgt), "Agustus (W31–W34)") +
      card("Realisasi", fmt(t.tot), t.ok + " outlet tercapai") +
      card("Kekurangan", fmt(t.kur), "sisa ke target") +
      '<div class="card ach"><div class="k">Achievement</div><div class="v num">' + pct(t.ach) +
      '</div><div class="bar"><i style="width:' + w.toFixed(1) + '%"></i></div></div>';
  }

  function card(k, v, m) {
    return '<div class="card"><div class="k">' + esc(k) + '</div><div class="v num">' + v +
      '</div><div class="m">' + esc(m) + "</div></div>";
  }

  /* ── Tampilan outlet ──────────────────────────────────────────────── */
  function renderOutlets(rows) {
    if (!rows.length) return empty();

    var head = '<div class="tr head"><div>Outlet</div><div>Salesman</div><div>Rayon</div>' +
      '<div class="r">Target</div><div class="r">Realisasi</div><div class="r">Kurang</div>' +
      '<div class="weeks">' + WEEKS.map(function (w) { return "<span>" + w + "</span>"; }).join("") +
      '</div><div class="r">ACH</div></div>';

    var body = rows.map(function (r) {
      var wk = r.weeks.map(function (v) {
        return '<span class="' + (v ? "" : "zero") + '">' + (v ? fmt(v) : "–") + "</span>";
      }).join("");

      return '<button class="tr" data-uid="' + esc(r.uid) + '">' +
        '<div class="c-outlet"><div class="outlet-name">' + esc(r.nama) + '</div>' +
        '<div class="outlet-meta">' +
        (state.produk === "all" ? '<span class="chip">' + esc(r.produk) + "</span>" : "") +
        '<span class="no">' + r.no + "</span> · " + esc(r.alamat || "-") + "</div></div>" +
        '<div class="c-sales">' + esc(r.sales) + "</div>" +
        '<div class="c-rayon">' + esc(r.rayon) + "</div>" +
        '<div class="c-tgt r num"><span class="mlabel">Target </span>' + fmt(r.tgt) + "</div>" +
        '<div class="c-tot r num"><span class="mlabel">Realisasi </span>' + fmt(r.total) + "</div>" +
        '<div class="c-kur r num"><span class="mlabel">Kurang </span>' + fmt(r.kurang) + "</div>" +
        '<div class="c-weeks"><div class="weeks">' + wk + "</div></div>" +
        '<div class="c-ach r"><span class="pill ' + achClass(r.ach) + '">' + pct(r.ach) + "</span></div>" +
        "</button>";
    }).join("");

    return '<div class="tbl">' + head + body + "</div>";
  }

  /* ── Rekap per salesman / rayon ───────────────────────────────────── */
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

    var head = '<div class="grp head"><div>' + (key === "sales" ? "Salesman" : "Rayon") +
      '</div><div class="r">Outlet</div><div class="r">Target</div><div class="r">Realisasi</div>' +
      '<div class="r">Kurang</div><div>Progres</div><div class="r">ACH</div></div>';

    var body = list.map(function (t) {
      var w = t.ach === null ? 0 : Math.min(t.ach, 1) * 100;
      return '<div class="grp">' +
        '<div class="g-name name">' + esc(t.name) + "</div>" +
        '<div class="g-n r num"><span class="mlabel">Outlet </span>' + fmt(t.n) + "</div>" +
        '<div class="g-tgt r num"><span class="mlabel">Target </span>' + fmt(t.tgt) + "</div>" +
        '<div class="g-tot r num"><span class="mlabel">Realisasi </span>' + fmt(t.tot) + "</div>" +
        '<div class="g-kur r num"><span class="mlabel">Kurang </span>' + fmt(t.kur) + "</div>" +
        '<div class="g-bar"><div class="bar"><i style="width:' + w.toFixed(1) + '%"></i></div></div>' +
        '<div class="g-ach r"><span class="pill ' + achClass(t.ach) + '">' + pct(t.ach) + "</span></div>" +
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
    if (r.zona) extra += kv(r.zonaLabel || "Zona", esc(r.zona));
    if (r.up !== null && r.up !== undefined) extra += kv("Up target", pct(r.up));
    if (r.tgtWeek) extra += kv("Target / week", fmt(r.tgtWeek));
    if (r.ebs) {
      var need = Math.max(r.tgt * r.ebs - r.total, 0);
      extra += kv("Kurang EBS " + pct(r.ebs), fmt(need));
    }

    $("#detail").innerHTML =
      '<button class="close" id="d-close" aria-label="Tutup">✕</button>' +
      "<h2>" + esc(r.nama) + "</h2>" +
      '<div class="addr">' + esc(r.alamat || "-") + "</div>" +
      '<div class="kv">' +
      kv("Produk", esc(r.produk)) +
      kv("No outlet", r.no) +
      kv("Salesman", esc(r.sales)) +
      kv("Rayon", esc(r.rayon)) +
      kv("Target Agustus", fmt(r.tgt)) +
      kv("Realisasi", fmt(r.total)) +
      kv("Kekurangan", fmt(r.kurang)) +
      '<div><div class="k">Achievement</div><div class="v"><span class="pill ' + achClass(r.ach) +
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
    var rows = filtered().sort(SORTS[state.sort]);
    var head = ["Produk", "Salesman", "Rayon", "No Outlet", "Nama Outlet", "Alamat", "Zona",
      "Target"].concat(WEEKS, ["Realisasi", "Kekurangan", "ACH %"]);

    var lines = [head].concat(rows.map(function (r) {
      return [r.produk, r.sales, r.rayon, r.no, r.nama, r.alamat, r.zona, r.tgt]
        .concat(r.weeks.map(function (v) { return v === null ? "" : v; }),
          [r.total, r.kurang, r.ach === null ? "" : Math.round(r.ach * 100)]);
    })).map(function (cols) {
      return cols.map(function (c) {
        var s = c === null || c === undefined ? "" : String(c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    }).join("\r\n");

    saveFile("master-agustus.csv", "﻿" + lines);
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

  /* ── Render ───────────────────────────────────────────────────────── */
  function render() {
    syncSelects();
    var rows = filtered();
    renderSummary(rows);

    var html;
    if (state.view === "sales") html = renderGroups(rows, "sales");
    else if (state.view === "rayon") html = renderGroups(rows, "rayon");
    else html = renderOutlets(rows.slice().sort(SORTS[state.sort]));

    $("#list").innerHTML = html;
    $("#count").textContent = rows.length + " dari " + byProduct().length + " outlet";
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

    ["sales", "rayon", "zona", "status"].forEach(function (k) {
      $("#f-" + k).addEventListener("change", function (e) { state[k] = e.target.value; render(); });
    });

    $("#f-sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });

    $("#reset").addEventListener("click", function () {
      state.q = state.sales = state.rayon = state.zona = state.status = "";
      q.value = "";
      $("#f-status").value = "";
      render();
      q.focus();
    });

    $("#views").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      state.view = b.dataset.view;
      Array.prototype.forEach.call($("#views").children, function (t) {
        t.setAttribute("aria-pressed", String(t === b));
      });
      render();
    });

    $("#list").addEventListener("click", function (e) {
      var row = e.target.closest(".tr[data-uid]");
      if (row) openDetail(row.dataset.uid);
    });

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
