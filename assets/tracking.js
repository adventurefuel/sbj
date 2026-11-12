// SUM-BOURBON JOE — marketing tags + UTM capture.
//
// Loaded on every PUBLIC page (never on admin.html, so admin visits are not
// counted). Does three things:
//   1. Remembers UTM tags from the link that brought the visitor (last touch,
//      kept 30 days) so they can be saved on sponsor inquiries.
//   2. Loads Google Analytics 4 and the Meta Pixel.
//   3. Exposes window.sbjTrack(name, params) for conversion events.
//
// Ownership: both IDs belong to SBJ-owned accounts with Adventure Fuel as
// admin partner (see README, "Tracking and alerts"). To switch a tag off,
// set its ID to "".

(function () {
  var GA4_ID = "G-8LEQ5MR5RJ";
  var META_PIXEL_ID = "2749134455489442";

  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var STORE_KEY = "sbj_utm";
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;

  function clean(v, max) {
    return String(v || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, max || 100);
  }

  // ---- UTM capture --------------------------------------------------------
  function readStored() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.ts || Date.now() - o.ts > TTL_MS) { localStorage.removeItem(STORE_KEY); return null; }
      return o;
    } catch (e) { return null; }
  }

  function captureFromUrl() {
    var found = {}, any = false;
    try {
      var params = new URLSearchParams(location.search);
      UTM_KEYS.forEach(function (k) {
        var v = params.get(k);
        if (v) { found[k] = clean(v, k === "utm_source" || k === "utm_medium" ? 100 : 150); any = true; }
      });
    } catch (e) {}
    if (!any) return;
    found.landing_page = (location.pathname || "/").slice(0, 200);
    found.ts = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(found)); } catch (e) {}
  }

  // Returns { utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_page }
  // (only the keys that exist). Empty object for direct / untagged visits.
  window.sbjUtm = function () {
    var o = readStored() || {};
    var out = {};
    UTM_KEYS.concat(["landing_page"]).forEach(function (k) { if (o[k]) out[k] = o[k]; });
    return out;
  };

  captureFromUrl();

  // ---- Google Analytics 4 -------------------------------------------------
  var hasGA = !!GA4_ID;
  if (hasGA) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID);
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
    document.head.appendChild(g);
  }

  // ---- Meta Pixel ---------------------------------------------------------
  var hasMeta = !!META_PIXEL_ID;
  if (hasMeta) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", META_PIXEL_ID);
    window.fbq("track", "PageView");
  }

  // ---- Conversion events --------------------------------------------------
  // sbjTrack("lead", { lead_type: "sponsor" | "guest_story", interest: "..." })
  // sbjTrack("youtube_click", { location: "..." })
  window.sbjTrack = function (name, params) {
    params = params || {};
    try {
      if (name === "lead") {
        if (hasGA) window.gtag("event", "generate_lead", { lead_type: params.lead_type || "unknown", interest: params.interest || undefined });
        if (hasMeta) {
          if (params.lead_type === "guest_story") window.fbq("track", "Contact");
          else if (params.lead_type === "proof_pack") window.fbq("track", "Lead", { content_name: "Proof Pack" });
          else window.fbq("track", "Lead", { content_name: params.interest || "Sponsor inquiry" });
        }
      } else if (name === "podcast_click") {
        if (hasGA) window.gtag("event", "podcast_click", { platform: params.platform || "" });
        if (hasMeta) window.fbq("trackCustom", "PodcastClick", { platform: params.platform || "" });
      } else if (name === "youtube_click") {
        if (hasGA) window.gtag("event", "youtube_click", { link_location: params.location || "" });
        if (hasMeta) window.fbq("trackCustom", "YouTubeClick", { location: params.location || "" });
      }
    } catch (e) {}
  };

  // Count clicks on any link to the YouTube channel (the headline goal).
  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    if (a.getAttribute("data-pod")) { window.sbjTrack("podcast_click", { platform: a.getAttribute("data-pod") }); return; }
    var href = a.getAttribute("href") || "";
    if (/^https?:\/\/(www\.)?youtube\.com\//i.test(href) || /^https?:\/\/youtu\.be\//i.test(href)) {
      var page = (location.pathname.split("/").pop() || "index").replace(/\.html$/, "") || "index";
      window.sbjTrack("youtube_click", { location: page });
    }
  });
})();
