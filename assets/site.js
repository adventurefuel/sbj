// SUM-BOURBON JOE — shared page behavior (nav toggle, WhatsApp links,
// footer socials, year). Runs on every page after supabase-client.js.

document.addEventListener("DOMContentLoaded", () => {
  // WhatsApp buttons: any element with a data-wa-text attribute, plus the
  // two standard header/CTA buttons.
  const defaultMsg = "Hey Joe, I've got something worth talking about.";
  document.querySelectorAll("#waHeaderBtn, #waCtaBtn, [data-wa-link]").forEach((el) => {
    const msg = el.getAttribute("data-wa-text") || defaultMsg;
    el.href = waLink(msg);
  });

  // Footer social icons.
  const footerSocial = document.getElementById("footerSocial");
  if (footerSocial) {
    const icons = [
      { key: "youtube", label: "YouTube", glyph: "&#9654;" },
      { key: "instagram", label: "Instagram", glyph: "&#128247;" },
      { key: "facebook", label: "Facebook", glyph: "f" },
      { key: "tiktok", label: "TikTok", glyph: "&#9835;" },
    ];
    footerSocial.innerHTML = icons
      .map((i) => {
        const href = SOCIALS[i.key] || "#";
        const target = href === "#" ? "" : ' target="_blank" rel="noopener"';
        return `<a href="${href}" aria-label="${i.label}"${target}>${i.glyph}</a>`;
      })
      .join("");
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle.
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("mobile-open"));
  }
});
