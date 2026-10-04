# Sum-Bourbon Joe — sbj

A static, no-build-step site: the landing page (`index.html`), Joe's price
checker (`bourbon.html`), the Wine/Bourbon Events page (`events.html`), the
watch page (`watch.html`), the story-submission form
(`tell-your-story.html`), and a gated admin panel (`admin.html`) — all
reading and writing directly to Supabase via `@supabase/supabase-js` in the
browser. No custom backend server; Supabase (Postgres + Auth) is the
backend, deployed on Render as a static site.

## Structure

- `index.html` — landing page. Hero, the four "what brought you here" cards
  (Tell Your Story / Watch / Bourbon Price Checker / What's Pouring
  Locally), the "want to be on the show" steps, and the WhatsApp CTA box.
- `bourbon.html` — **Sum-Bourbon Joe Price Check**. Type a bottle name, Joe
  looks it up against his seeded price sheet and shows the known
  MSRP/secondary range, you log what you paid, and it computes a verdict in
  Joe's voice ("Joe says: Score" / "Fair Play" / "Overpaid" / "Ouch" /
  "Logged") that's added to the public "Joe's Verdicts" feed. Uses its own
  comic-badge theme (`assets/bourbon-badge.css`, loaded only on this page) —
  mustard gold / brick red / warm brown, black-outline badge cards and
  buttons, Luckiest Guy display type, Baloo 2 body type — layered on top of
  the shared dark styles without touching them.
- `events.html` — **Wine/Bourbon Events** ("What's Pouring Locally?"). Reads
  events from Supabase; launches empty with a friendly placeholder until
  real events are added. (Was `detroit.html` — `_redirects` forwards the
  old path.)
- `watch.html` — links out to `https://www.youtube.com/@SumbourbonJoe`.
- `tell-your-story.html` — the "want to be on the show" submission form.
- `admin.html` — sign-in gated tool for managing the price sheet, events,
  and viewing story submissions / the price-check log.
- `assets/styles.css` — shared design tokens (Ink/near-black background,
  Gold/Rust accents, Anton + Archivo + JetBrains Mono — same font family
  convention as the 4DRIP Design Guide).
- `assets/supabase-client.js` — Supabase client + WhatsApp link + socials
  helpers. **Only holds the public anon key** — safe to expose in client
  code; every write is enforced server-side by Postgres Row Level Security.
- `assets/site.js` — shared nav/footer behavior (mobile menu, WhatsApp
  links, socials, year).
- `assets/bourbon.js` — price-checker logic.
- `assets/bourbon-badge.css` — page-scoped badge theme for `bourbon.html`
  only (everything nested under `body.page-bourbon`).
- `assets/analytics.js` — lightweight, self-hosted pageview tracker. Loaded
  on every public page (not `admin.html`); logs one row per page load to
  `sbj_page_views`. Viewable on the **Site Analytics** card at the top of
  `/admin.html`.

## Supabase project

This site shares the **`ADventure Fuel's Project`** Supabase project
(`cjixvpcoivfipmgmvomi`, org "ADventure Fuel", region us-west-2) rather than
getting its own — the org was already at its 2-project free-tier limit
(4DRIP + the internal command center). Every SBJ table is prefixed `sbj_`
and has its own Row Level Security policies, so SBJ code can only ever
touch `sbj_*` rows. If SBJ later needs true isolation, pause/upgrade one of
the other two projects and create a dedicated one, then point
`assets/supabase-client.js` at it and re-run the schema below.

- URL: `https://cjixvpcoivfipmgmvomi.supabase.co`
- Anon key: baked into `assets/supabase-client.js` (already done).

Schema (see migrations `init_sbj_schema` and `seed_sbj_price_sheet` in the
Supabase dashboard for the exact SQL):

- `public.sbj_admins` — allowlist of `auth.users.id` who may manage SBJ
  content. See "Admin users" below.
- `public.sbj_price_sheet` — bottle_name, msrp, secondary_low/high, notes.
  Public read; admin-only write. Seeded with the bottles from Joe's logo,
  since expanded with real Michigan Liquor Control Commission minimum
  shelf prices for several bottles (see `notes` per row — sourced via
  liquorli.st, which mirrors the official MLCC Price Book).
- `public.sbj_price_checks` — the public "Joe's Verdicts" log. Public read
  and insert (with basic sanity checks); admin-only delete.
- `public.sbj_events` — "What's Pouring Locally" events. Public read;
  admin-only write. An event can have one date or several — `dates` is a
  jsonb array of `{date, time}`, used for a repeating listing (e.g. a
  standing weekly pour) instead of one row per occurrence. The legacy
  single `event_date`/`event_time` columns stay for older rows; the app
  falls back to them when `dates` is empty.
- `public.sbj_story_submissions` — "Tell Your Story" entries. Public
  insert only; admin-only read/update (so submissions aren't publicly
  browsable).
- `public.sbj_page_views` — one row per page load (page, path, referring
  hostname, coarse device type, timestamp). Public insert (shape-checked,
  no free text); admin-only read/delete — the raw log isn't publicly
  browsable, only the aggregated counts shown on `/admin.html`.

## Admin users

Admin sign-in is Supabase Auth: each person's **email is their username**
and they choose their own password (stored hashed by Supabase — there is
no list of passwords anywhere, and none can be stored in a static site).
A brand-new account has **no access** until an existing admin approves it:

1. The new person opens `/admin.html`, clicks **Create an account**, and
   signs up with their email + a password (Supabase may send a
   confirmation email — click it, then sign in).
2. They land on "Account Pending Approval". That automatically files an
   access request (`sbj_access_requests`).
3. An existing admin opens `/admin.html` → **Admin Users** → **Access
   Requests** and clicks **Approve** (or **Dismiss**). Admins can also
   **Remove** other admins from **Current Admins** (never themselves).
4. The new admin refreshes `/admin.html` — the management tools unlock.

**Bootstrapping the very first admin** (only needed on a fresh project —
`tarmale.daniel@gmail.com` is already one): sign up as above, then run
this once in the Supabase SQL editor:

```sql
insert into public.sbj_admins (id, email)
select id, email from auth.users where email = 'the-persons-email@example.com';
```

`public.sbj_access_requests` — one row per person waiting for approval
(own-row insert only; admin-only read/delete). Policies on `sbj_admins`
use the `sbj_is_admin()` helper function so they don't recurse.

## Local development

No build step. Any static file server works:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

## Deployment (Render)

Deployed as a Render **Static Site** from this GitHub repo
(`adventurefuel/sbj`), publish directory `.` (repo root), no build command
— plain HTML/CSS/JS. `_redirects` sends unmatched paths to `index.html`.

## WhatsApp number

`15866128753` (+1 586 612 8753) is set in `assets/supabase-client.js`
(`WA_NUMBER`) and used everywhere — the nav button, the homepage CTA box,
and the "Tell Your Story" page. Change it in that one file if it ever
needs to change.

## Socials

Instagram and Facebook are live (`instagram.com/sumbourbonjoe`,
`facebook.com/sumbourbonjoe`). TikTok is set to `#` in
`assets/supabase-client.js` (`SOCIALS.tiktok`) until there's a handle —
update it there once one exists.
