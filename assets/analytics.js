// SUM-BOURBON JOE — lightweight, self-hosted pageview tracker.
//
// Logs one row per page load to the sbj_page_views table (public insert,
// admin-only read — see README). No cookies, no third-party script, no
// personal data: just a page name, path, referring hostname, and a coarse
// device bucket. Fire-and-forget — if it fails for any reason, the page
// itself is unaffected.
//
// Loaded after supabase-client.js on every public page (not on admin.html,
// so admin visits aren't counted as site traffic).

(function () {
  function pageKey() {
    const file = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    return file === "" ? "index" : file;
  }

  function detectDevice() {
    const ua = navigator.userAgent || "";
    if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
    if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
    return "desktop";
  }

  function referrerHost() {
    if (!document.referrer) return null;
    try {
      const refHost = new URL(document.referrer).hostname.replace(/^www\./, "");
      const here = location.hostname.replace(/^www\./, "");
      return refHost === here ? null : refHost;
    } catch (e) {
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof db === "undefined") return;
    db.from("sbj_page_views")
      .insert({
        page: pageKey(),
        path: location.pathname,
        referrer: referrerHost(),
        device: detectDevice(),
      })
      .then(() => {}, () => {});
  });
})();
