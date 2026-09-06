// SUM-BOURBON JOE — shared Supabase client + WhatsApp helpers.
// Loaded after the supabase-js CDN script on every page.
//
// This site shares a Supabase project with other Adventure Fuel client
// sites (the org's free-tier project limit was already used up by 4DRIP
// and the internal command center). Every SBJ table is prefixed `sbj_`
// and locked down with its own Row Level Security policies, so this is
// safe: SBJ code can only ever see/write `sbj_*` rows.

const SUPABASE_URL = "https://cjixvpcoivfipmgmvomi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqaXh2cGNvaXZmaXBtZ212b21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4Nzc0NTgsImV4cCI6MjEwMzQ1MzQ1OH0.-_h0AejMCy98nfgpbwA9TKAO3hkkyL6AJTJNZkmrOQM";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Joe's WhatsApp number — update here if it ever changes; every page
// (nav button, CTA box, footer) reads from this one place.
const WA_NUMBER = "15866128753"; // +1 586 612 8753
const WA_DISPLAY = "(586) 612-8753";

function waLink(text) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text || "")}`;
}

// Social links — fill in TikTok whenever Joe has a handle; left as "#"
// until then so the footer icon doesn't 404.
const SOCIALS = {
  youtube: "https://www.youtube.com/@SumbourbonJoe",
  instagram: "https://instagram.com/sumbourbonjoe",
  facebook: "https://facebook.com/sumbourbonjoe",
  tiktok: "#",
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
