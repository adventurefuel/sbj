// SUM-BOURBON JOE — Audience Dashboard (admin only).
// Follower counts are logged by hand once a day (sbj_audience_snapshots);
// website visits come from the site's own page-view log, rolled up daily into
// sbj_daily_visits so the history survives "Clear Log". Charts are plain SVG,
// no outside libraries. Loaded by admin.html only.
(function () {
  "use strict";

  const GOALS = { youtube: 2000, facebook: 1000, instagram: 1000 };
  const PLAT = {
    youtube:   { label: "YouTube",   unit: "subscribers", color: "#ff5252", icon: "&#9654;", cls: "yt" },
    facebook:  { label: "Facebook",  unit: "followers",   color: "#4d8dff", icon: "f",       cls: "fb" },
    instagram: { label: "Instagram", unit: "followers",   color: "#ee4f93", icon: "&#9678;", cls: "ig" },
  };
  const ORDER = ["youtube", "facebook", "instagram"];
  const RANGES = [
    ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"],
    ["180", "Last 6 months"], ["365", "Last year"], ["all", "All time"],
  ];

  let root = null;
  let snaps = { youtube: [], facebook: [], instagram: [] }; // [{d:'YYYY-MM-DD', v}] sorted
  let visits = [];                                            // [{d, v}] sorted
  let range = "30";
  let chartSeq = 0;
  let redrawFns = [];
  let firstRender = true;

  // ---------- small helpers ----------
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $id = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (dt, n) => { const x = new Date(dt.getTime()); x.setDate(x.getDate() + n); return x; };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const todayStr = () => ymd(new Date());
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const short = (s, withYear) => { const d = parse(s); return MON[d.getMonth()] + " " + d.getDate() + (withYear ? ", " + d.getFullYear() : ""); };

  function windowStart() {
    if (range === "all") return null;
    return ymd(addDays(new Date(), -(Number(range) - 1)));
  }
  function inWindow(d) { const s = windowStart(); return (!s || d >= s) && d <= todayStr(); }

  function niceNum(x, round) {
    const exp = Math.floor(Math.log10(x)); const f = x / Math.pow(10, exp); let nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }
  function niceScale(min, max, n) {
    if (min === max) { if (min === 0) max = 1; else { const p = Math.max(1, Math.abs(min) * 0.1); min -= p; max += p; } }
    const step = Math.max(1, niceNum(niceNum(max - min, false) / (n - 1), true));
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
    return { min: lo, max: hi, ticks };
  }

  // ---------- SVG charts ----------
  function tipHtml(title, items) {
    return "<b>" + esc(title) + "</b>" + items.map((i) => '<div><i style="background:' + i.color + '"></i>' + esc(i.name) + ": <strong>" + esc(i.value) + "</strong></div>").join("");
  }

  function attachHover(box, cols, plot, W, H) {
    const svg = box.querySelector("svg"); if (!svg || !cols.length) return;
    const guide = svg.querySelector(".dc-guide");
    const tip = document.createElement("div"); tip.className = "dash-tip hidden"; box.appendChild(tip);
    function move(ev) {
      const r = svg.getBoundingClientRect(); const scale = W / r.width;
      const x = (ev.clientX - r.left) * scale;
      let best = cols[0]; for (const c of cols) if (Math.abs(c.x - x) < Math.abs(best.x - x)) best = c;
      guide.setAttribute("x1", best.x); guide.setAttribute("x2", best.x); guide.style.display = "";
      tip.innerHTML = tipHtml(best.title, best.items); tip.classList.remove("hidden");
      const px = best.x / scale; const tw = tip.offsetWidth;
      tip.style.left = Math.max(tw / 2, Math.min(r.width - tw / 2, px)) + "px";
      tip.style.top = Math.max(0, plot.t / scale + 6) + "px";
      tip.style.transform = "translate(-50%, 0)";
    }
    function leave() { tip.classList.add("hidden"); guide.style.display = "none"; }
    const hit = svg.querySelector(".dc-hit");
    hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move); hit.addEventListener("pointerleave", leave);
  }

  // series: [{name, color, points:[{t, y}]}]  (t = ms)
  function lineChart(box, cfg) {
    const id = "dc" + (++chartSeq);
    const draw = () => {
      const series = cfg.series.filter((s) => s.points.length);
      if (!series.length) { box.innerHTML = '<div class="chart-empty">' + (cfg.empty || "Nothing logged for this timeframe yet.") + "</div>"; return; }
      const W = Math.max(280, box.clientWidth || 600), H = cfg.height || 230;
      const m = { l: 46, r: 16, t: 14, b: 28 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
      const all = series.flatMap((s) => s.points);
      let xmin = Math.min(...all.map((p) => p.t)), xmax = Math.max(...all.map((p) => p.t));
      const single = xmin === xmax; const onlyT = xmin;
      if (single) { xmin -= 43200000; xmax += 43200000; }
      const ys = all.map((p) => p.y); const ysc = niceScale(Math.min(...ys), Math.max(...ys), 5);
      const X = (t) => m.l + ((t - xmin) / (xmax - xmin)) * pw;
      const Y = (v) => m.t + ph - ((v - ysc.min) / (ysc.max - ysc.min)) * ph;
      let g = '<defs>' + series.map((s, i) => '<linearGradient id="' + id + 'g' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".38"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>').join("") + "</defs>";
      g += '<g class="dc-axis">';
      ysc.ticks.forEach((v) => { g += '<line class="dc-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (m.l - 8) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + fmt(v) + "</text>"; });
      const nl = Math.min(6, Math.max(2, Math.floor(pw / 90)));
      const spanDays = (xmax - xmin) / 86400000; const withYear = spanDays > 300;
      let lastLb = "";
      if (single) g += '<text x="' + X(onlyT) + '" y="' + (H - 8) + '" text-anchor="middle">' + short(ymd(new Date(onlyT)), withYear) + "</text>";
      for (let i = 0; i < (single ? 0 : nl); i++) {
        const t = xmin + ((xmax - xmin) * i) / (nl - 1 || 1); const dt = new Date(t);
        const lb = short(ymd(dt), withYear); if (lb === lastLb) continue; lastLb = lb;
        const anchor = i === 0 ? "start" : i === nl - 1 ? "end" : "middle";
        g += '<text x="' + X(t) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + lb + "</text>";
      }
      g += "</g>";
      series.forEach((s, i) => {
        const pts = s.points.map((p) => [X(p.t), Y(p.y)]);
        const d = pts.map((p, k) => (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
        if (pts.length > 1) {
          g += '<path class="dc-area" d="' + d + " L" + pts[pts.length - 1][0] + " " + (m.t + ph) + " L" + pts[0][0] + " " + (m.t + ph) + ' Z" fill="url(#' + id + "g" + i + ')"/>';
          g += '<path class="dc-line" pathLength="1" d="' + d + '" stroke="' + s.color + '" style="filter:drop-shadow(0 0 6px ' + s.color + '88)"/>';
        }
        const showAll = pts.length <= 45;
        pts.forEach((p, k) => { if (showAll || k === pts.length - 1) g += '<circle class="dc-dot dc-hl" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (k === pts.length - 1 ? 5.5 : 3.5) + '" fill="' + s.color + '"/>'; });
      });
      if (cfg.goal && cfg.goal >= ysc.min && cfg.goal <= ysc.max) {
        g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(cfg.goal) + '" y2="' + Y(cfg.goal) + '" stroke="#f0b23e" stroke-dasharray="6 5" stroke-width="1.5"/><text class="dc-axis" x="' + (W - m.r) + '" y="' + (Y(cfg.goal) - 6) + '" text-anchor="end" style="fill:#f0b23e;font-family:var(--font-mono);font-size:10.5px">GOAL ' + fmt(cfg.goal) + "</text>";
      }
      g += '<line class="dc-guide" y1="' + m.t + '" y2="' + (m.t + ph) + '" style="display:none"/><rect class="dc-hit" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
      box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(cfg.label || "Line chart") + '">' + g + "</svg>";
      // hover columns: every distinct timestamp
      const times = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);
      const cols = times.map((t) => ({
        x: X(t), title: short(ymd(new Date(t)), true),
        items: series.map((s) => { const p = s.points.find((q) => q.t === t); return p ? { name: s.name, color: s.color, value: (cfg.fmtY || fmt)(p.y) } : null; }).filter(Boolean),
      }));
      attachHover(box, cols, { t: m.t }, W, H);
    };
    draw(); redrawFns.push(draw);
  }

  // groups: [{label}], series: [{name,color,values:[]}], bar chart w/ optional line overlay
  function barChart(box, cfg) {
    const id = "dc" + (++chartSeq);
    const draw = () => {
      const n = cfg.labels.length;
      const hasData = n && cfg.series.some((s) => s.values.some((v) => v !== 0 && v != null));
      if (!n || (!hasData && !cfg.alwaysDraw)) { box.innerHTML = '<div class="chart-empty">' + (cfg.empty || "Nothing to show for this timeframe yet.") + "</div>"; return; }
      const W = Math.max(280, box.clientWidth || 600), H = cfg.height || 240;
      const m = { l: 46, r: 12, t: 14, b: 30 }; const pw = W - m.l - m.r, ph = H - m.t - m.b;
      const vals = cfg.series.flatMap((s) => s.values).concat((cfg.line ? cfg.line.values : []), [0]);
      const ysc = niceScale(Math.min(...vals), Math.max(...vals), 5);
      const Y = (v) => m.t + ph - ((v - ysc.min) / (ysc.max - ysc.min)) * ph;
      const band = pw / n, k = cfg.series.length; const bw = Math.max(2, Math.min(30, (band * 0.78) / k));
      let g = '<defs>' + cfg.series.map((s, i) => '<linearGradient id="' + id + 'b' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s.color + '"/><stop offset="1" stop-color="' + s.color + '" stop-opacity=".55"/></linearGradient>').join("") + "</defs>";
      g += '<g class="dc-axis">';
      ysc.ticks.forEach((v) => { g += '<line class="' + (v === 0 ? "dc-base" : "dc-grid") + '" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (m.l - 8) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end">' + fmt(v) + "</text>"; });
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 62))));
      cfg.labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1 && (n - 1) % every === 0) g += '<text x="' + (m.l + band * i + band / 2) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(lb) + "</text>"; });
      g += "</g>";
      const y0 = Y(0);
      cfg.series.forEach((s, si) => {
        s.values.forEach((v, i) => {
          if (!v) return;
          const x = m.l + band * i + band / 2 - (k * bw) / 2 + si * bw; const top = Math.min(Y(v), y0), h = Math.max(2, Math.abs(Y(v) - y0));
          g += '<rect class="dc-bar" x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + (bw - (k > 1 ? 1.5 : 0)).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + (v < 0 ? "#ff8a6b" : "url(#" + id + "b" + si + ")") + '" style="animation-delay:' + Math.min(900, i * 22) + 'ms"/>';
        });
      });
      if (cfg.line && cfg.line.values.length > 1) {
        const d = cfg.line.values.map((v, i) => (i ? "L" : "M") + (m.l + band * i + band / 2).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
        g += '<path class="dc-line" pathLength="1" d="' + d + '" stroke="' + cfg.line.color + '" style="filter:drop-shadow(0 0 5px ' + cfg.line.color + '99)"/>';
      }
      g += '<line class="dc-guide" y1="' + m.t + '" y2="' + (m.t + ph) + '" style="display:none"/><rect class="dc-hit" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
      box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(cfg.label || "Bar chart") + '">' + g + "</svg>";
      const cols = cfg.labels.map((lb, i) => ({
        x: m.l + band * i + band / 2, title: (cfg.titles && cfg.titles[i]) || lb,
        items: cfg.series.map((s) => ({ name: s.name, color: s.color, value: (cfg.fmtV || fmt)(s.values[i] || 0) }))
          .concat(cfg.line ? [{ name: cfg.line.name, color: cfg.line.color, value: fmt(cfg.line.values[i] || 0) }] : []),
      }));
      attachHover(box, cols, { t: m.t }, W, H);
    };
    draw(); redrawFns.push(draw);
  }

  // ---------- data shaping ----------
  function windowSnaps(p) { return snaps[p].filter((s) => inWindow(s.d)); }
  function baseline(p) {
    // last snapshot on/before the window start, else the first one inside it
    const arr = snaps[p]; if (!arr.length) return null; const s = windowStart();
    if (s) { const before = arr.filter((x) => x.d < s); if (before.length) return before[before.length - 1]; }
    return arr.find((x) => inWindow(x.d)) || null;
  }
  function stats(p) {
    const arr = snaps[p]; if (!arr.length) return null;
    const cur = arr[arr.length - 1]; const base = baseline(p);
    const gain = base ? cur.v - base.v : 0; const days = base ? daysBetween(base.d, cur.d) : 0;
    let perDay = null, eta = null;
    // pace: use the selected window, falling back to all history when it's too thin to say anything
    let pBase = base, pDays = days, pGain = gain;
    if (!(pDays >= 1)) { const first = arr[0]; pBase = first; pDays = daysBetween(first.d, cur.d); pGain = cur.v - first.v; }
    if (pDays >= 1 && pGain > 0) {
      perDay = pGain / pDays; const goal = GOALS[p];
      if (cur.v < goal) { const need = Math.ceil((goal - cur.v) / perDay); if (need <= 730) eta = ymd(addDays(parse(todayStr()), need)); }
    }
    return { cur, gain, days, perDay, eta, base };
  }
  function stageText(pct) {
    const label = pct >= 100 ? "Goal hit!" : pct >= 75 ? "Last stretch." : pct >= 50 ? "Past halfway." : pct >= 25 ? "Warming up." : "First pour.";
    const sub = pct >= 100 ? "Time to set the next one." : pct >= 75 ? "The finish line is in sight." : pct >= 50 ? "Keep pouring." : pct >= 25 ? "Building momentum." : "Every follower counts.";
    return "<b>" + label + "</b> " + Math.min(100, pct).toFixed(1) + "% of the goal. " + sub;
  }

  function bucketMode() {
    let span = range === "all" ? 0 : Number(range);
    if (range === "all") {
      const firsts = [...ORDER.map((p) => snaps[p][0] && snaps[p][0].d), visits[0] && visits[0].d].filter(Boolean).sort();
      span = firsts.length ? daysBetween(firsts[0], todayStr()) + 1 : 30;
    }
    return span <= 31 ? "day" : span <= 120 ? "week" : "month";
  }
  function bucketKey(d, mode) {
    if (mode === "day") return d;
    const dt = parse(d);
    if (mode === "month") return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-01";
    const dow = (dt.getDay() + 6) % 7; return ymd(addDays(dt, -dow)); // Monday
  }
  function bucketLabel(k, mode) { return mode === "month" ? MON[parse(k).getMonth()] + " " + String(parse(k).getFullYear()).slice(2) : short(k); }
  function bucketList(mode) {
    let start = windowStart();
    if (!start) { const firsts = [...ORDER.map((p) => snaps[p][0] && snaps[p][0].d), visits[0] && visits[0].d].filter(Boolean).sort(); start = firsts[0] || todayStr(); }
    const keys = []; let cur = parse(start); const end = parse(todayStr());
    while (cur <= end) { const k = bucketKey(ymd(cur), mode); if (!keys.length || keys[keys.length - 1] !== k) keys.push(k); cur = addDays(cur, 1); }
    return keys;
  }

  // ---------- rendering ----------
  function pourHtml(p, cur, goal) {
    const pct = Math.min(100, (cur / goal) * 100);
    const ticks = [25, 50, 75].map((t) => '<span class="pour-tick" style="left:' + t + '%"></span>').join("");
    const labels = [0, 25, 50, 75, 100].map((t) => "<span style=\"left:" + t + "%\">" + fmt((goal * t) / 100) + "</span>").join("");
    return '<div class="pour" role="progressbar" aria-valuemin="0" aria-valuemax="' + goal + '" aria-valuenow="' + cur + '"><div class="pour-fill" data-pct="' + pct.toFixed(1) + '"></div>' + ticks + '</div><div class="pour-labels">' + labels + "</div>";
  }
  function chipsHtml(p, st) {
    const goal = GOALS[p]; const out = [];
    const togo = Math.max(0, goal - st.cur.v);
    out.push('<span class="chip"><b>' + fmt(togo) + "</b> to go</span>");
    const periodTxt = range === "all" ? "all time" : RANGES.find((r) => r[0] === range)[1].toLowerCase();
    out.push('<span class="chip ' + (st.gain > 0 ? "up" : st.gain < 0 ? "down" : "") + '"><b>' + (st.gain > 0 ? "+" : "") + fmt(st.gain) + "</b> " + periodTxt + "</span>");
    if (st.perDay) out.push('<span class="chip"><b>' + (st.perDay >= 10 ? fmt(st.perDay) : st.perDay.toFixed(1)) + "</b> per day</span>");
    if (st.cur.v >= goal) out.push('<span class="chip">&#127942; <b>Goal reached</b></span>');
    else if (st.eta) out.push('<span class="chip">&#127919; On pace for <b>' + short(st.eta, true) + "</b></span>");
    else out.push('<span class="chip">Log a few more days to see your pace</span>');
    out.push('<span class="chip">Updated <b>' + short(st.cur.d) + "</b></span>");
    return '<div class="chips">' + out.join("") + "</div>";
  }

  function platformSeries(p) {
    return [{ name: PLAT[p].label, color: PLAT[p].color, points: windowSnaps(p).map((s) => ({ t: parse(s.d).getTime(), y: s.v })) }];
  }

  function render() {
    redrawFns = []; chartSeq = 0;
    const animate = firstRender;
    const hero = $id("dashHero"), pair = $id("dashPair");
    // YouTube hero
    const yt = stats("youtube"), P = PLAT.youtube, goalYt = GOALS.youtube;
    if (yt) {
      const pct = Math.min(100, (yt.cur.v / goalYt) * 100);
      hero.className = "yt-hero" + (yt.cur.v >= goalYt ? " reached" : "");
      hero.innerHTML =
        '<div><span class="badge-line"><i style="background:' + P.color + '">' + P.icon + "</i>YouTube subscribers &middot; goal " + fmt(goalYt) + "</span>" +
        '<div class="yt-count"><span class="big" id="ytBig" data-to="' + yt.cur.v + '">0</span><span class="of">/ ' + fmt(goalYt) + "</span></div>" +
        '<div class="stage">' + stageText(pct) + "</div>" +
        pourHtml("youtube", yt.cur.v, goalYt) + chipsHtml("youtube", yt) + "</div>" +
        '<div><div class="panel-h"><h3>Subscribers over time</h3></div><div class="chart-box" id="ytChart"></div></div>';
    } else {
      hero.className = "yt-hero";
      hero.innerHTML = '<div><span class="badge-line"><i style="background:' + P.color + '">' + P.icon + "</i>YouTube subscribers &middot; goal " + fmt(goalYt) + "</span>" +
        '<div class="yt-count"><span class="big dim">0</span><span class="of">/ ' + fmt(goalYt) + "</span></div>" +
        '<div class="stage"><b>Ready for the first pour.</b> Tap &ldquo;Log today&rsquo;s numbers&rdquo; and enter your current subscriber count.</div>' + pourHtml("youtube", 0, goalYt) + "</div>" +
        '<div><div class="chart-box" id="ytChart"></div></div>';
    }
    lineChart($id("ytChart"), { series: platformSeries("youtube"), height: 250, label: "YouTube subscribers over time", empty: "No YouTube numbers in this timeframe yet.", goal: goalYt });

    // Facebook + Instagram
    pair.innerHTML = ["facebook", "instagram"].map((p) => {
      const st = stats(p), pl = PLAT[p], goal = GOALS[p];
      const pct = st ? Math.min(100, (st.cur.v / goal) * 100) : 0;
      return '<div class="plat-card ' + pl.cls + (st && st.cur.v >= goal ? " reached" : "") + '">' +
        '<span class="badge-line"><i style="background:' + (p === "instagram" ? "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)" : pl.color) + '">' + pl.icon + "</i>" + pl.label + " &middot; goal " + fmt(goal) + "</span>" +
        '<div class="plat-count"><span class="big' + (st ? "" : " dim") + '" ' + (st ? 'data-to="' + st.cur.v + '"' : "") + ">0" + '</span><span class="of">/ ' + fmt(goal) + "</span></div>" +
        '<div class="stage">' + (st ? stageText(pct) : "<b>Ready for the first pour.</b> Log your current " + pl.unit + " count.") + "</div>" +
        pourHtml(p, st ? st.cur.v : 0, goal) + (st ? chipsHtml(p, st) : "") +
        '<div class="chart-box" style="margin-top:14px" id="chart_' + p + '"></div></div>';
    }).join("");
    ["facebook", "instagram"].forEach((p) => lineChart($id("chart_" + p), { series: platformSeries(p), height: 190, label: PLAT[p].label + " followers over time", empty: "No " + PLAT[p].label + " numbers in this timeframe yet.", goal: GOALS[p] }));

    renderNet(); renderVisits(); renderHistory();

    // animations: count-up + pour fill
    requestAnimationFrame(() => {
      root.querySelectorAll(".pour-fill").forEach((el) => { el.style.width = el.getAttribute("data-pct") + "%"; });
      root.querySelectorAll("[data-to]").forEach((el) => countUp(el, Number(el.getAttribute("data-to")), animate));
    });
    firstRender = false;
  }

  function countUp(el, to, animate) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !animate) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 1100;
    (function step(now) { const k = Math.min(1, (now - t0) / dur); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  function renderNet() {
    const mode = bucketMode(), keys = bucketList(mode); const idx = {}; keys.forEach((k, i) => (idx[k] = i));
    const series = ORDER.map((p) => {
      const values = keys.map(() => 0); const arr = snaps[p];
      for (let i = 1; i < arr.length; i++) { if (!inWindow(arr[i].d)) continue; const k = bucketKey(arr[i].d, mode); if (k in idx) values[idx[k]] += arr[i].v - arr[i - 1].v; }
      return { name: PLAT[p].label, color: PLAT[p].color, values };
    });
    const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
    $id("netLegend").innerHTML = ORDER.map((p, i) => '<span><i style="background:' + PLAT[p].color + '"></i>' + PLAT[p].label + " <b style=\"color:var(--cream)\">" + (totals[i] > 0 ? "+" : "") + fmt(totals[i]) + "</b></span>").join("");
    $id("netTitle").textContent = "New followers per " + mode + (mode === "week" ? " (weeks start Monday)" : "");
    barChart($id("netChart"), { labels: keys.map((k) => bucketLabel(k, mode)), titles: keys.map((k) => (mode === "day" ? short(k, true) : mode === "week" ? "Week of " + short(k) : MON[parse(k).getMonth()] + " " + parse(k).getFullYear())), series, height: 240, label: "New followers per " + mode, empty: "Log at least two days of numbers to see growth bars." });
  }

  function renderVisits() {
    const mode = bucketMode(), keys = bucketList(mode); const idx = {}; keys.forEach((k, i) => (idx[k] = i));
    const vals = keys.map(() => 0);
    visits.forEach((v) => { if (!inWindow(v.d)) return; const k = bucketKey(v.d, mode); if (k in idx) vals[idx[k]] += v.v; });
    const inWin = visits.filter((v) => inWindow(v.d));
    const total = inWin.reduce((a, v) => a + v.v, 0);
    const best = inWin.reduce((b, v) => (v.v > (b ? b.v : -1) ? v : b), null);
    const today = (visits.find((v) => v.d === todayStr()) || { v: 0 }).v;
    const days = Math.max(1, range === "all" ? (inWin.length ? daysBetween(inWin[0].d, todayStr()) + 1 : 1) : Number(range));
    $id("visTiles").innerHTML =
      '<div class="vis-tile"><div class="num">' + fmt(today) + '</div><div class="lbl">Today</div></div>' +
      '<div class="vis-tile"><div class="num">' + fmt(total) + '</div><div class="lbl">In this timeframe</div></div>' +
      '<div class="vis-tile"><div class="num">' + fmt(total / days) + '</div><div class="lbl">Average per day</div></div>' +
      '<div class="vis-tile"><div class="num">' + (best ? fmt(best.v) : "&mdash;") + '</div><div class="lbl">Best day' + (best ? " &middot; " + short(best.d) : "") + "</div></div>";
    let line = null;
    if (mode === "day" && keys.length >= 7) {
      const avg = vals.map((_, i) => { const a = vals.slice(Math.max(0, i - 6), i + 1); return a.reduce((x, y) => x + y, 0) / a.length; });
      line = { name: "7-day average", color: "#ffd98a", values: avg.map((v) => Math.round(v * 10) / 10) };
    }
    $id("visTitle").textContent = "Website visits per " + mode;
    barChart($id("visChart"), { labels: keys.map((k) => bucketLabel(k, mode)), titles: keys.map((k) => (mode === "day" ? short(k, true) : mode === "week" ? "Week of " + short(k) : MON[parse(k).getMonth()] + " " + parse(k).getFullYear())), series: [{ name: "Visits", color: "#f0b23e", values: vals }], line, height: 240, label: "Website visits per " + mode, empty: "No website visits recorded in this timeframe yet." });
    $id("visLegend").innerHTML = '<span><i style="background:#f0b23e"></i>Page views</span>' + (line ? '<span><i style="background:#ffd98a"></i>7-day average</span>' : "");
  }

  function renderHistory() {
    const dates = new Set(); ORDER.forEach((p) => snaps[p].forEach((s) => dates.add(s.d)));
    const list = [...dates].sort().reverse().slice(0, 21);
    const get = (p, d) => { const s = snaps[p].find((x) => x.d === d); return s ? fmt(s.v) : "&mdash;"; };
    $id("dashHistory").innerHTML = list.length
      ? '<div class="tbl-wrap" style="max-height:300px"><table><thead><tr><th>Date</th><th class="num">YouTube</th><th class="num">Facebook</th><th class="num">Instagram</th><th></th></tr></thead><tbody>' +
        list.map((d) => "<tr><td style=\"white-space:nowrap\">" + short(d, true) + '</td><td class="num">' + get("youtube", d) + '</td><td class="num">' + get("facebook", d) + '</td><td class="num">' + get("instagram", d) + '</td><td style="text-align:right"><button class="icon-btn" data-del="' + d + '" type="button">Delete</button></td></tr>').join("") +
        "</tbody></table></div>"
      : '<div class="chart-empty">Nothing logged yet. Your first entry starts the charts.</div>';
  }

  // ---------- page skeleton + events ----------
  function build() {
    root.innerHTML =
      '<div class="dash-top"><div><h2>Audience Dashboard</h2><div class="desc" style="margin:4px 0 0">Followers across YouTube, Facebook and Instagram, plus website visits. Log the counts once a day and watch the growth.</div></div>' +
      '<div class="dash-controls"><label class="dash-range"><span>Timeframe</span><select id="dashRange">' + RANGES.map((r) => '<option value="' + r[0] + '"' + (r[0] === range ? " selected" : "") + ">" + r[1] + "</option>").join("") + "</select></label>" +
      '<button class="btn btn-gold" id="dashLogToggle" type="button">+ Log today&rsquo;s numbers</button></div></div>' +
      '<div class="dash-nudge hidden" id="dashNudge"></div>' +
      '<form class="dash-log hidden" id="dashLog" novalidate><div class="dash-log-grid">' +
      '<label>Date<input type="date" id="dlDate"></label>' +
      ORDER.map((p) => '<label class="dl-' + PLAT[p].cls + '"><span>' + PLAT[p].label + " " + PLAT[p].unit + '</span><input type="number" inputmode="numeric" min="0" step="1" id="dl_' + p + '" placeholder="Current count"></label>').join("") +
      '<div class="dl-btn"><button class="btn btn-gold" type="submit" style="width:100%;justify-content:center;min-height:44px">Save</button></div></div>' +
      '<div class="dash-log-msg" id="dashLogMsg">Fill in any or all. Saving a date again just updates it.</div></form>' +
      '<div class="yt-hero" id="dashHero"></div><div class="dash-pair" id="dashPair"></div>' +
      '<div class="chart-panel"><div class="panel-h"><h3 id="netTitle">New followers</h3><div class="legend" id="netLegend"></div></div><div class="chart-box" id="netChart"></div></div>' +
      '<div class="chart-panel"><div class="panel-h"><h3 id="visTitle">Website visits</h3><div class="legend" id="visLegend"></div></div><div class="vis-tiles" id="visTiles"></div><div class="chart-box" id="visChart"></div>' +
      '<div class="desc" style="margin:10px 0 0;font-size:11.5px">Visits are page views logged by this site, kept as a daily history even after you clear the log.</div></div>' +
      '<div class="chart-panel dash-history"><div class="panel-h"><h3>Recent entries</h3></div><div id="dashHistory"></div></div>';

    $id("dashRange").addEventListener("change", (e) => { range = e.target.value; try { localStorage.setItem("sbjDashRange", range); } catch (_) {} render(); });
    $id("dashLogToggle").addEventListener("click", () => toggleLog());
    $id("dashLog").addEventListener("submit", saveLog);
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]"); if (!b) return;
      const d = b.getAttribute("data-del");
      if (!confirm("Delete all follower numbers logged for " + short(d, true) + "?")) return;
      const { error } = await db.from("sbj_audience_snapshots").delete().eq("snap_date", d);
      if (error) { alert("Couldn't delete: " + error.message); return; }
      await fetchData(); render(); nudge();
    });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => redrawFns.forEach((f) => f()), 160); });
  }

  function toggleLog(force) {
    const f = $id("dashLog"); const open = force !== undefined ? force : f.classList.contains("hidden");
    f.classList.toggle("hidden", !open);
    if (open) {
      $id("dlDate").value = todayStr();
      ORDER.forEach((p) => { const a = snaps[p]; $id("dl_" + p).placeholder = a.length ? "Last: " + fmt(a[a.length - 1].v) : "Current count"; });
      $id("dl_youtube").focus();
    }
  }

  async function saveLog(e) {
    e.preventDefault(); const msg = $id("dashLogMsg"); msg.className = "dash-log-msg";
    const d = $id("dlDate").value; const rows = [];
    if (!d) { msg.textContent = "Pick a date."; msg.className = "dash-log-msg err"; return; }
    if (d > todayStr()) { msg.textContent = "That date is in the future."; msg.className = "dash-log-msg err"; return; }
    for (const p of ORDER) {
      const raw = $id("dl_" + p).value.trim(); if (raw === "") continue;
      const n = Number(raw); if (!Number.isInteger(n) || n < 0 || n > 99999999) { msg.textContent = PLAT[p].label + " needs a whole number, 0 or more."; msg.className = "dash-log-msg err"; return; }
      rows.push({ snap_date: d, platform: p, followers: n });
    }
    if (!rows.length) { msg.textContent = "Enter at least one number."; msg.className = "dash-log-msg err"; return; }
    msg.textContent = "Saving...";
    const { error } = await db.from("sbj_audience_snapshots").upsert(rows, { onConflict: "snap_date,platform" });
    if (error) { msg.textContent = "Couldn't save: " + error.message; msg.className = "dash-log-msg err"; return; }
    ORDER.forEach((p) => ($id("dl_" + p).value = ""));
    msg.textContent = "Saved " + rows.length + " number" + (rows.length > 1 ? "s" : "") + " for " + short(d, true) + ".";
    msg.className = "dash-log-msg ok";
    await fetchData(); render(); nudge();
  }

  function nudge() {
    const el = $id("dashNudge"); const lasts = ORDER.map((p) => (snaps[p].length ? snaps[p][snaps[p].length - 1].d : null)).filter(Boolean);
    const last = lasts.length ? lasts.sort().pop() : null; const gap = last ? daysBetween(last, todayStr()) : null;
    if (last === null) { el.classList.remove("hidden"); el.innerHTML = "<span>No audience numbers yet. Log today&rsquo;s counts to start the charts.</span><button type=\"button\" data-open>Log now</button>"; }
    else if (gap >= 1) { el.classList.remove("hidden"); el.innerHTML = "<span>Last logged " + (gap === 1 ? "yesterday" : gap + " days ago") + " (" + short(last) + "). Add today&rsquo;s numbers to keep the line moving.</span><button type=\"button\" data-open>Log now</button>"; }
    else el.classList.add("hidden");
    const b = el.querySelector("[data-open]"); if (b) b.addEventListener("click", () => { toggleLog(true); $id("dashLog").scrollIntoView({ behavior: "smooth", block: "center" }); });
  }

  async function fetchData() {
    try { await db.rpc("sbj_rollup_visits"); } catch (_) {}
    const [a, v] = await Promise.all([
      db.from("sbj_audience_snapshots").select("snap_date, platform, followers").order("snap_date", { ascending: true }).limit(5000),
      db.from("sbj_daily_visits").select("day, visits").order("day", { ascending: true }).limit(5000),
    ]);
    snaps = { youtube: [], facebook: [], instagram: [] };
    ((a && a.data) || []).forEach((r) => { if (snaps[r.platform]) snaps[r.platform].push({ d: r.snap_date, v: r.followers }); });
    visits = ((v && v.data) || []).map((r) => ({ d: r.day, v: r.visits }));
    return !(a && a.error) && !(v && v.error);
  }

  async function load() {
    root = $id("dashCard"); if (!root) return;
    try { const saved = localStorage.getItem("sbjDashRange"); if (saved && RANGES.some((r) => r[0] === saved)) range = saved; } catch (_) {}
    if (!$id("dashRange")) build();
    firstRender = true;
    const ok = await fetchData();
    render(); nudge();
    if (!ok) { const n = $id("dashNudge"); n.classList.remove("hidden"); n.innerHTML = "<span>Couldn&rsquo;t load some dashboard data. Refresh to try again.</span>"; }
  }

  window.sbjDashboard = { load };
})();
