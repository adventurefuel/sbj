// SUM-BOURBON JOE — Joe's Price Check page logic.
// Looks up bottles against Joe's seeded price sheet, lets people log what
// they paid, computes a verdict in Joe's own voice, and stores/reads the
// public "Joe's Verdicts" feed from Supabase (table: sbj_price_checks).

let priceSheet = [];

// Every verdict tier Joe hands out, keyed by the value stored in the
// `verdict` column. Legacy rows (from before the badge redesign) used
// "taken" for anything over MSRP — mapped onto "overpaid" so old entries
// still render correctly.
const VERDICT_META = {
  scored: { cls: "scored", label: "Joe says: Score" },
  fair: { cls: "fair", label: "Joe says: Fair Play" },
  overpaid: { cls: "overpaid", label: "Joe says: Overpaid" },
  ouch: { cls: "ouch", label: "Joe says: Ouch" },
  taken: { cls: "overpaid", label: "Joe says: Overpaid" }, // legacy
  logged: { cls: "logged", label: "Joe says: Logged" },
};

function verdictMeta(key) {
  return VERDICT_META[key] || VERDICT_META.logged;
}

function normalizeName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findSheetMatch(name) {
  const norm = normalizeName(name);
  if (!norm) return null;
  // Exact normalized match first.
  let hit = priceSheet.find((p) => p.bottle_name_norm === norm);
  if (hit) return hit;
  // Otherwise, substring match either direction (handles "Blanton's" vs
  // "Blanton's Single Barrel").
  hit = priceSheet.find(
    (p) => p.bottle_name_norm.includes(norm) || norm.includes(p.bottle_name_norm)
  );
  return hit || null;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function computeVerdict(paid, msrp, secLow, secHigh) {
  if (msrp == null) {
    return {
      verdict: "logged",
      text: "Joe doesn't have this one priced yet — logged for the record. WhatsApp him if you want his take.",
    };
  }
  if (paid <= msrp * 1.1) {
    return {
      verdict: "scored",
      text: `You scored — that's right around MSRP (${money(msrp)}).`,
    };
  }
  if (secHigh != null && paid <= secHigh * 1.05) {
    return {
      verdict: "fair",
      text: `Fair play for secondary market — that's within the going range (${money(secLow ?? msrp)}–${money(secHigh)}).`,
    };
  }
  if (secHigh != null && paid <= secHigh * 1.5) {
    return {
      verdict: "overpaid",
      text: `You got overpaid on this one — that's above the usual secondary-market range (up to ${money(secHigh)}).`,
    };
  }
  return {
    verdict: "ouch",
    text: secHigh != null
      ? `Ouch — that's well above even the secondary-market range (up to ${money(secHigh)}). Joe feels for you.`
      : `Ouch — that's well above MSRP (${money(msrp)}). Joe feels for you.`,
  };
}

function renderPriceSheetTable() {
  const body = document.getElementById("priceSheetBody");
  if (!body) return;
  if (!priceSheet.length) {
    body.innerHTML = `<tr><td colspan="3">Joe hasn't loaded his price sheet yet.</td></tr>`;
    return;
  }
  body.innerHTML = priceSheet
    .slice()
    .sort((a, b) => a.bottle_name.localeCompare(b.bottle_name))
    .map((p) => {
      const range = p.secondary_low != null && p.secondary_high != null
        ? `${money(p.secondary_low)}–${money(p.secondary_high)}`
        : "—";
      const noteLine = p.notes ? `<div class="sheet-note">${escapeHtml(p.notes)}</div>` : "";
      return `<tr><td>${escapeHtml(p.bottle_name)}${noteLine}</td><td>${money(p.msrp)}</td><td>${range}</td></tr>`;
    })
    .join("");
}

function renderVerdictCard(row) {
  const meta = verdictMeta(row.verdict);
  const when = new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const metaParts = [row.size, row.store, when].filter(Boolean);
  return `
    <div class="verdict-card ${meta.cls}">
      <span class="joe-says">${meta.label}</span>
      <div class="row1">
        <span class="bottle">${escapeHtml(row.bottle_name)}</span>
        <span class="paid">${money(row.price_paid)}${row.msrp != null ? ` · MSRP ${money(row.msrp)}` : ""}</span>
      </div>
      <div class="verdict-text">${escapeHtml(row.verdict_detail || meta.label)}</div>
      <div class="meta">${escapeHtml(metaParts.join(" · "))}</div>
    </div>`;
}

async function loadPriceSheet() {
  const { data, error } = await db
    .from("sbj_price_sheet")
    .select("bottle_name, bottle_name_norm, msrp, secondary_low, secondary_high, notes")
    .order("bottle_name", { ascending: true });
  if (!error && data) {
    priceSheet = data;
    renderPriceSheetTable();
  }
}

async function loadVerdicts() {
  const feed = document.getElementById("verdictFeed");
  if (!feed) return;
  const { data, error } = await db
    .from("sbj_price_checks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return;
  if (!data || !data.length) {
    feed.innerHTML = `<div class="empty-state">Nothing on the shelf yet &mdash; tell Joe what you paid and he'll size it up.</div>`;
    return;
  }
  feed.innerHTML = data.map(renderVerdictCard).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const bottleInput = document.getElementById("bottleName");
  const msrpInput = document.getElementById("msrpOverride");
  const hint = document.getElementById("bottleHint");
  const form = document.getElementById("priceForm");
  const formMsg = document.getElementById("formMsg");

  loadPriceSheet();
  loadVerdicts();

  bottleInput.addEventListener("input", () => {
    const match = findSheetMatch(bottleInput.value);
    if (match) {
      const range = match.secondary_low != null
        ? ` secondary ${money(match.secondary_low)}–${money(match.secondary_high)}`
        : "";
      hint.textContent = `Joe knows this one: MSRP ~${money(match.msrp)},${range}`;
      msrpInput.placeholder = money(match.msrp).replace("$", "");
    } else {
      hint.textContent = "";
      msrpInput.placeholder = "auto-filled if known";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "";
    formMsg.className = "msg";

    const bottleName = bottleInput.value.trim();
    const pricePaid = parseFloat(document.getElementById("pricePaid").value);
    const size = document.getElementById("size").value;
    const store = document.getElementById("store").value.trim();
    const overrideVal = document.getElementById("msrpOverride").value;

    if (!bottleName || !Number.isFinite(pricePaid) || pricePaid <= 0) {
      formMsg.textContent = "Enter a bottle name and what you paid.";
      formMsg.className = "msg err";
      return;
    }

    const match = findSheetMatch(bottleName);
    const msrp = overrideVal ? parseFloat(overrideVal) : (match ? match.msrp : null);
    const secLow = match ? match.secondary_low : null;
    const secHigh = match ? match.secondary_high : null;

    const result = computeVerdict(pricePaid, msrp, secLow, secHigh);

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    const { data, error } = await db
      .from("sbj_price_checks")
      .insert({
        bottle_name: bottleName,
        price_paid: pricePaid,
        size,
        msrp: msrp,
        store: store || null,
        verdict: result.verdict,
        verdict_detail: result.text,
      })
      .select()
      .single();

    submitBtn.disabled = false;

    if (error) {
      formMsg.textContent = "Couldn't save that — try again in a moment.";
      formMsg.className = "msg err";
      return;
    }

    formMsg.textContent = "Added to Joe's log.";
    formMsg.className = "msg ok";
    form.reset();
    hint.textContent = "";
    msrpInput.placeholder = "auto-filled if known";

    const feed = document.getElementById("verdictFeed");
    if (feed.querySelector(".empty-state")) feed.innerHTML = "";
    feed.insertAdjacentHTML("afterbegin", renderVerdictCard(data));
  });
});
