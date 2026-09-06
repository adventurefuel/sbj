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
- `bourbon.html` — **Joe's Price Check**. Same approach as
  adventurefuel.agency/sbj: type a bottle name, Joe looks it up against his
  seeded price sheet and shows the known MSRP/secondary range, you log what
  you paid, and it computes a verdict (scored / fair / got taken) that's
  added to the public "Joe's Verdicts" feed.
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
  content. Starts **empty** — see "First-time admin setup" below.
- `public.sbj_price_sheet` — bottle_name, msrp, secondary_low/high, notes.
  Public read; admin-only write. Seeded with the bottles from Joe's logo.
- `public.sbj_price_checks` — the public "Joe's Verdicts" log. Public read
  and insert (with basic sanity checks); admin-only delete.
- `public.sbj_events` — "What's Pouring Locally" events. Public read;
  admin-only write. Starts empty.
- `public.sbj_story_submissions` — "Tell Your Story" entries. Public
  insert only; admin-only read/update (so submissions aren't publicly
  browsable).

## First-time admin setup

There's no public signup form anywhere except `admin.html`'s "Create an
account" flow, and a brand-new account has **no access** until it's added
to the `sbj_admins` allowlist:

1. Open `/admin.html`, click **Create an account**, sign up with your
   email + a password. Supabase may send a confirmation email — click it,
   then sign in.
2. You'll land on an "Account pending approval" screen. That's expected.
3. In the Supabase dashboard for the `ADventure Fuel's Project` project,
   run this SQL once per person (Table Editor → SQL, or ask Claude to run
   it):
   ```sql
   insert into public.sbj_admins (id, email)
   select id, email from auth.users where email = 'the-persons-email@example.com';
   ```
4. Refresh `/admin.html` — the management tools unlock.

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
