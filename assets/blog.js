// SUM-BOURBON JOE — blog share buttons.
//
// Any element with class "share-row" and data-title / data-slug gets its
// buttons wired up (buttons carry data-share="facebook|x|linkedin|email|copy|native").
// The shared link is always the post's canonical address (so previews and
// counts use sbjmacomb.com), with UTM tags added so the visit shows up in
// analytics as coming from a share: utm_source=<network>, utm_medium=share,
// utm_campaign=blog.
(function () {
  function canonical() {
    var c = document.querySelector('link[rel="canonical"]');
    return (c && c.href) || (location.origin + location.pathname);
  }
  function tagged(method) {
    var u = canonical();
    return u + (u.indexOf("?") === -1 ? "?" : "&") + "utm_source=" + method + "&utm_medium=share&utm_campaign=blog";
  }
  function track(method, slug) {
    try { if (window.sbjTrack) window.sbjTrack("share", { method: method, item: slug || "" }); } catch (e) {}
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        var t = document.createElement("textarea");
        t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        var ok = document.execCommand("copy"); document.body.removeChild(t);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }
  function popup(url) {
    // (Not "noopener": that makes window.open return null even when it worked.)
    var w = window.open(url, "sbj-share", "width=620,height=640");
    if (w) { try { w.opener = null; } catch (e) {} } else { location.href = url; }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".share-row").forEach(function (row) {
      var title = row.getAttribute("data-title") || document.title;
      var slug = row.getAttribute("data-slug") || "";
      var canShare = !!navigator.share;
      var nativeBtn = row.querySelector('[data-share="native"]');
      if (nativeBtn) nativeBtn.hidden = !canShare;

      row.addEventListener("click", function (ev) {
        var btn = ev.target.closest ? ev.target.closest("[data-share]") : null;
        if (!btn) return;
        var method = btn.getAttribute("data-share");
        var url = tagged(method === "x" ? "x" : method);
        var enc = encodeURIComponent;

        if (method === "facebook") {
          track(method, slug);
          popup("https://www.facebook.com/sharer/sharer.php?u=" + enc(url));
        } else if (method === "x") {
          track(method, slug);
          popup("https://twitter.com/intent/tweet?url=" + enc(url) + "&text=" + enc(title));
        } else if (method === "linkedin") {
          track(method, slug);
          popup("https://www.linkedin.com/sharing/share-offsite/?url=" + enc(url));
        } else if (method === "email") {
          track(method, slug);
          location.href = "mailto:?subject=" + enc(title) + "&body=" + enc("Thought you'd like this from Sum-Bourbon Joe:\n\n" + title + "\n" + url);
        } else if (method === "copy") {
          copyText(url).then(function () {
            track(method, slug);
            var label = btn.querySelector("span");
            var old = label ? label.textContent : "";
            btn.classList.add("done"); if (label) label.textContent = "Link copied!";
            setTimeout(function () { btn.classList.remove("done"); if (label) label.textContent = old; }, 2200);
          }).catch(function () { window.prompt("Copy this link:", url); });
        } else if (method === "native" && canShare) {
          navigator.share({ title: title, text: title, url: url }).then(function () { track(method, slug); }).catch(function () {});
        }
      });
    });
  });
})();
