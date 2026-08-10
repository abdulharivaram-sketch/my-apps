# 🍳 Recipe Box- AH Deploy test-2

A clean, modern digital recipe box — save recipes from the web or by hand, organize them
into folders and tags, cook from a distraction-free view with serving scaling, generate
grocery lists, and share any recipe via a public link.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + Storage)

---

## Quick start

### 1. Create a Supabase project
- Go to https://supabase.com → New project.
- In **SQL Editor**, paste and run `supabase/migrations/0001_init.sql`.
- (Google login) In **Authentication → Providers → Google**, enable it and add your
  Google OAuth client id/secret.

### 2. Configure environment
Copy `.env.local.example` → `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...        # Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Project Settings → API → anon public key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
In **Supabase → Authentication → URL Configuration**, set **Site URL** to your
`NEXT_PUBLIC_SITE_URL` and add `<that-url>/auth/callback` to **Redirect URLs**.

### 3. Install & run
```bash
npm install
npm run dev
# open http://localhost:3000
```

### 4. Seed sample recipes (optional)
1. Sign up once in the app.
2. Supabase → Authentication → Users → copy your user UUID.
3. In `supabase/seed.sql`, replace every `:uid` with that UUID.
4. Run `seed.sql` in the SQL Editor.
   (Seed images are pre-wired to hosted URLs, so seeding works immediately. To self-host, download them into `public/seed/` and swap the paths.

```bash
npm test   # runs unit tests for scaling + grocery aggregation
```

---

## Running on Replit
- Put the three env vars in the **Secrets** panel (not a committed file).
- Set `NEXT_PUBLIC_SITE_URL` to your `*.replit.dev` URL, and add that URL (plus
  `/auth/callback`) to Supabase Redirect URLs and, for Google, to the Google Cloud console.
- Run command: `npm run dev` (already binds `-H 0.0.0.0 -p 3000`).
- Never put a Supabase `service_role` key in client code or a `NEXT_PUBLIC_` var.

## Project layout
```
app/            routes (auth group, app group, public /share, /api/import)
components/     UI: nav, recipe, library, grocery
lib/            supabase clients, typed data layer, pure logic (scaling, grocery, import)
types/          shared TypeScript types
supabase/       SQL migration + seed
```

## Notes
- **Security is enforced by Postgres RLS**, not the UI. Public sharing works via a
  `share_id` token + `is_public` flag and a dedicated read policy.
- **URL import is best-effort**: it prefers Schema.org JSON-LD, falls back to Open Graph,
  never throws, and always drops you into an editable form.
- **Wake Lock** is feature-detected and no-ops where unsupported (older iOS Safari).

---

## Installing on your phone (PWA)

This app is an installable **Progressive Web App** — no app store needed.

1. **Deploy it first** (it must be a real HTTPS URL — service workers don't run on plain
   `http`, except on `localhost`). Easiest path: push to GitHub → import to
   [Vercel](https://vercel.com) → add the three env vars → you get an `https://…vercel.app` URL.
2. **Open that URL on your phone** and add it to your home screen:
   - **iPhone (Safari):** Share → **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu → **Install app** (or the "Install app" button that
     appears in-app), or **Add to Home screen**.
3. Launch it from the new icon — it opens fullscreen, with its own icon and splash, no
   browser bar.

### What works offline
A service worker (`public/sw.js`) caches the app shell plus any pages, recipes, and images
you've already opened, using stale-while-revalidate. So:
- ✅ Recipes and images you've viewed before load without a connection (great in a kitchen).
- ✅ A friendly `/offline` page shows for anything not yet cached.
- ❌ Loading *new* recipes, saving edits, importing a URL, or building a grocery list still
  needs a connection — those talk to Supabase live. Writes simply fail gracefully offline.

This is intentional for the MVP: true offline writes (a sync queue) are a bigger feature —
easy to add later on top of this foundation.

### PWA files (for reference)
```
app/manifest.ts                       -> served at /manifest.webmanifest
public/sw.js                          -> service worker (offline caching)
public/icon-192.png, icon-512.png     -> app icons (192, 512, + maskable)
public/apple-touch-icon.png           -> iOS home-screen icon
public/favicon.ico                    -> browser tab icon
components/pwa/ServiceWorkerRegister   -> registers the SW on load
components/pwa/InstallPrompt           -> Android/desktop "Install app" button
app/offline/page.tsx                  -> offline fallback screen
```
To change the icon, edit `public/icon.svg` and re-export the PNG sizes.

> **Bump the cache version** (`const CACHE = "recipe-box-v1"` in `public/sw.js`) whenever you
> deploy changes, so returning users don't get stale cached assets.
