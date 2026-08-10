# Deploy: GitHub → Vercel in 5 steps

Goal: get a live `https://…vercel.app` URL you can open and install on your phone.
You need a free GitHub account and a free Vercel account. ~10 minutes.

## Before you start
Create a Supabase project and run the SQL once:
- supabase.com → New project.
- SQL Editor → paste & run `supabase/migrations/0001_init.sql`.
- Keep two values handy (Project Settings → API): **Project URL** and **anon public key**.

## The 5 steps

### 1. Put the code on GitHub
- Create a new empty repo at github.com (e.g. `recipe-box`).
- Upload this project. Easiest without the command line: on the new repo page click
  **"uploading an existing file"** and drag the whole unzipped `recipe-box` folder in.
- (Command line alternative, from inside the folder:)
  ```bash
  git init && git add . && git commit -m "Recipe Box MVP"
  git branch -M main
  git remote add origin https://github.com/YOUR_NAME/recipe-box.git
  git push -u origin main
  ```

### 2. Import the repo into Vercel
- vercel.com → **Add New… → Project** → **Import** your `recipe-box` repo.
- Vercel auto-detects Next.js. Leave build settings as-is.

### 3. Add environment variables (before the first deploy)
In the import screen, open **Environment Variables** and add:
| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key |
| `NEXT_PUBLIC_SITE_URL` | leave blank for now, fill in step 5 |

### 4. Deploy
- Click **Deploy**. Wait ~1 minute. You'll get a URL like
  `https://recipe-box-xyz.vercel.app`. Copy it.

### 5. Point the app + Supabase at that URL
- **Vercel:** Project → Settings → Environment Variables → set
  `NEXT_PUBLIC_SITE_URL` to your `https://…vercel.app` URL → **Redeploy**
  (Deployments → ⋯ → Redeploy) so the value takes effect.
- **Supabase:** Authentication → URL Configuration →
  set **Site URL** to that same URL, and add `https://…vercel.app/auth/callback`
  to **Redirect URLs**.
- **(Google login only)** In Google Cloud Console, add the same `/auth/callback`
  as an authorized redirect URI.

Done. Open the URL on your phone → Add to Home Screen → it installs as an app.

## Updating later
Every `git push` to `main` auto-deploys a new version. Remember to bump
`const CACHE = "recipe-box-v1"` in `public/sw.js` when you change things, so the
installed app picks up fresh assets instead of old cached ones.

## Seeding sample recipes (optional, after first login)
1. Sign up once on your live site.
2. Supabase → Authentication → Users → copy your user UUID.
3. In `supabase/seed.sql`, replace every `:uid` with it. Run the file in SQL Editor.
