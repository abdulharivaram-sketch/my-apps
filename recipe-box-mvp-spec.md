# Recipe Box — MVP Build Spec

*A clean, modern digital recipe box. "Spotify for your personal recipes."*

**Stack (locked):** Next.js 14+ (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + Storage)
**Target:** Web-first, mobile-first, buildable phase-by-phase on Replit.

---

## 1. Product Spec Summary

### The problem
Recipes live everywhere — website tabs, screenshots, TikTok saves, Notes app, texts from mom. When it's time to cook, none of them are in one place and all of them are buried in clutter (life stories, ads, pop-ups). Recipe Box gives you one calm home for every recipe you care about, and gets out of the way when you're actually cooking.

### The MVP in one paragraph
A logged-in user can **save** a recipe by pasting a URL (auto-extracted) or by typing it in manually, **organize** recipes into folders and tags, **find** any recipe by title or ingredient, **cook** from a distraction-free view with tap-to-scale servings and a screen-wake toggle, **generate a grocery list** by selecting one or more recipes (with quantities combined and checkable items), and **share** any single recipe via a public read-only link.

### Primary user flows

1. **Sign up / sign in** → email+password or Google → land on the Recipe Box (library).
2. **Import from URL** → paste link → app parses title/image/ingredients/steps → user reviews → save.
3. **Manual create** → fill form (title, description, image, ingredients, steps, servings, times, tags) → save.
4. **Organize** → create a folder → select recipes into it → filter library by folder or tag.
5. **Cook** → open recipe → clean view → scale servings 1×/2×/0.5× or custom → keep screen awake.
6. **Shop** → select recipes → "Generate grocery list" → combined, de-duplicated, checkable list → add/remove items manually → list persists.
7. **Share** → open a recipe → "Share" → toggle public → copy link → anyone with the link sees a read-only cooking view.

### Success criteria (how we know the MVP works)

- A new user can go from signup to a saved recipe in **under 60 seconds**.
- URL import correctly extracts title + image + ingredients + steps for **~80%+ of mainstream recipe sites** (those exposing Schema.org `Recipe` JSON-LD), and always degrades gracefully to an editable draft.
- Scaling servings updates every numeric ingredient quantity correctly, including fractions.
- A grocery list built from 3 recipes correctly **merges duplicate ingredients** and their quantities where units match.
- Public share links load for logged-out visitors and expose **only** the shared recipe (enforced at the database layer, not just the UI).
- Core screens are usable one-handed on a phone (min 375px wide).

### Non-goals (explicitly out of scope for MVP)
Native TikTok/Instagram import, OCR/photo scanning, nutrition, real-time collaboration, meal-planning calendar, social feed, payments, native mobile apps.

---

## 2. Database Schema

Postgres via Supabase. Every user-owned table carries `user_id` and is protected by **Row Level Security (RLS)** so users can only ever touch their own rows. Public sharing is handled by a `share_id` token + `is_public` flag with a dedicated RLS policy.

### Entity overview

- `profiles` — 1:1 with `auth.users` (Supabase-managed auth table).
- `recipes` — the core object. Ingredients and steps are stored as `jsonb` arrays (a recipe stays atomic, trivial to reorder, easy to import/export). Tags are a `text[]`.
- `folders` — user-created collections.
- `recipe_folders` — many-to-many join (a recipe can live in multiple folders).
- `grocery_lists` — a saved shopping list.
- `grocery_items` — line items on a list (checkable).

> **Why ingredients as JSONB vs. a table:** For an MVP with per-recipe scaling and grocery aggregation, structured JSONB (`{ quantity, unit, name, note }`) keeps a recipe atomic, avoids N+1 queries, and still lets us parse quantity/unit for scaling and merging in application code. If you later add cross-recipe ingredient analytics ("recipes containing basil"), promote ingredients to their own table then. The schema is written so that migration is additive.

### SQL migration (`supabase/migrations/0001_init.sql`)

```sql
-- ============================================================
-- Recipe Box — initial schema
-- ============================================================
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists pg_trgm;       -- trigram search

-- ------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- recipes
-- ingredients: jsonb array of { quantity, unit, name, note }
-- steps:       jsonb array of { text }
-- ------------------------------------------------------------
create table public.recipes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  description     text,
  image_url       text,
  source_url      text,                       -- original URL if imported
  servings        integer default 2 check (servings > 0),
  prep_minutes    integer check (prep_minutes >= 0),
  cook_minutes    integer check (cook_minutes >= 0),
  ingredients     jsonb not null default '[]'::jsonb,
  steps           jsonb not null default '[]'::jsonb,
  tags            text[] not null default '{}',
  is_archived     boolean not null default false,
  is_public       boolean not null default false,
  share_id        uuid unique default gen_random_uuid(),   -- opaque public token
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index recipes_user_id_idx    on public.recipes (user_id);
create index recipes_tags_idx       on public.recipes using gin (tags);
create index recipes_share_id_idx   on public.recipes (share_id);
create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);

-- ------------------------------------------------------------
-- folders
-- ------------------------------------------------------------
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text,                           -- optional icon, e.g. "🍜"
  created_at  timestamptz not null default now()
);
create index folders_user_id_idx on public.folders (user_id);

-- ------------------------------------------------------------
-- recipe_folders (many-to-many)
-- ------------------------------------------------------------
create table public.recipe_folders (
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  folder_id   uuid not null references public.folders(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (recipe_id, folder_id)
);
create index recipe_folders_folder_idx on public.recipe_folders (folder_id);

-- ------------------------------------------------------------
-- grocery_lists + grocery_items
-- ------------------------------------------------------------
create table public.grocery_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Shopping list',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index grocery_lists_user_idx on public.grocery_lists (user_id);

create table public.grocery_items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.grocery_lists(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  quantity      numeric,
  unit          text,
  is_checked    boolean not null default false,
  source_recipe uuid references public.recipes(id) on delete set null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index grocery_items_list_idx on public.grocery_items (list_id);

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger recipes_touch       before update on public.recipes
  for each row execute function public.touch_updated_at();
create trigger grocery_lists_touch before update on public.grocery_lists
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.recipes        enable row level security;
alter table public.folders        enable row level security;
alter table public.recipe_folders enable row level security;
alter table public.grocery_lists  enable row level security;
alter table public.grocery_items  enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- full CRUD on your own recipes...
create policy "own recipes" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- ...PLUS anonymous read access to public recipes (share links)
create policy "public recipes are readable" on public.recipes
  for select using (is_public = true);

create policy "own folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recipe_folders" on public.recipe_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own grocery_lists" on public.grocery_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own grocery_items" on public.grocery_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for recipe images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "public read recipe images" on storage.objects
  for select using (bucket_id = 'recipe-images');
create policy "users upload own recipe images" on storage.objects
  for insert with check (bucket_id = 'recipe-images' and auth.uid() = owner);
create policy "users update own recipe images" on storage.objects
  for update using (bucket_id = 'recipe-images' and auth.uid() = owner);
create policy "users delete own recipe images" on storage.objects
  for delete using (bucket_id = 'recipe-images' and auth.uid() = owner);
```

### Relationship diagram (text)

```
auth.users ──1:1── profiles
     │
     ├──1:N── recipes ──N:M (recipe_folders)── folders
     │            └── share_id / is_public → public read
     ├──1:N── grocery_lists ──1:N── grocery_items ──(optional)── recipes
     └──1:N── folders
```

---

## 3. File / Folder Structure

App Router with route groups: `(auth)` for logged-out pages, `(app)` for the authenticated shell, and a top-level public `share/[shareId]` route that bypasses the app chrome. Server-side data access lives in `lib/data/*` (typed query functions), UI in `components/*`, pure logic in `lib/*` (fully unit-testable, no I/O).

```
recipe-box/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  ├─ signup/page.tsx
│  │  └─ layout.tsx                 # centered card, no nav
│  ├─ (app)/
│  │  ├─ layout.tsx                 # auth guard + sidebar/nav shell
│  │  ├─ page.tsx                   # Recipe Box (library) — the home
│  │  ├─ recipes/
│  │  │  ├─ new/page.tsx            # create (manual + URL import tab)
│  │  │  ├─ [id]/page.tsx           # cooking view
│  │  │  └─ [id]/edit/page.tsx      # edit form
│  │  ├─ folders/[id]/page.tsx      # filtered library by folder
│  │  └─ grocery/
│  │     ├─ page.tsx                # lists index
│  │     └─ [id]/page.tsx           # a single list
│  ├─ share/[shareId]/page.tsx      # public read-only recipe (no auth)
│  ├─ auth/
│  │  ├─ callback/route.ts          # OAuth/PKCE code exchange
│  │  └─ signout/route.ts
│  ├─ api/
│  │  └─ import/route.ts            # POST { url } -> parsed recipe draft
│  ├─ globals.css
│  └─ layout.tsx                    # root: fonts, <html>, providers
│
├─ components/
│  ├─ ui/                           # primitives: Button, Input, Card, Badge, Modal, Spinner, EmptyState
│  ├─ recipe/
│  │  ├─ RecipeCard.tsx
│  │  ├─ RecipeGrid.tsx
│  │  ├─ RecipeForm.tsx             # shared by new + edit
│  │  ├─ IngredientEditor.tsx
│  │  ├─ StepEditor.tsx
│  │  ├─ ServingScaler.tsx
│  │  ├─ CookingView.tsx
│  │  └─ ShareButton.tsx
│  ├─ library/
│  │  ├─ SearchBar.tsx
│  │  ├─ TagFilter.tsx
│  │  └─ FolderSidebar.tsx
│  ├─ grocery/
│  │  ├─ RecipePicker.tsx
│  │  └─ GroceryList.tsx
│  └─ nav/
│     ├─ TopBar.tsx
│     └─ BottomNav.tsx              # mobile tab bar
│
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts                  # browser client
│  │  ├─ server.ts                  # server component / route-handler client
│  │  └─ middleware.ts              # session refresh helper
│  ├─ data/
│  │  ├─ recipes.ts                 # typed queries: list/get/create/update/delete
│  │  ├─ folders.ts
│  │  └─ grocery.ts
│  ├─ import/
│  │  └─ parse-recipe.ts            # JSON-LD + fallback HTML parser
│  ├─ scaling.ts                    # parseQuantity, scaleIngredient, formatQuantity
│  ├─ grocery.ts                    # aggregateIngredients (merge/dedupe)
│  ├─ wake-lock.ts                  # screen wake-lock hook
│  └─ utils.ts                      # cn(), clamp, etc.
│
├─ types/
│  └─ index.ts                      # Recipe, Ingredient, Step, Folder, GroceryList...
│
├─ supabase/
│  ├─ migrations/0001_init.sql
│  └─ seed.sql                      # sample recipes
│
├─ middleware.ts                    # refresh session + protect (app) routes
├─ .env.local.example
├─ tailwind.config.ts
├─ next.config.mjs
├─ package.json
└─ README.md
```

---

## 4. Step-by-Step Implementation Plan

Each phase is independently runnable on Replit — you get something working on screen before moving on. Commit at the end of each phase.

**Phase 0 — Project + Supabase (30 min).**
Scaffold `create-next-app` (TS, Tailwind, App Router). Create a Supabase project, grab URL + anon key into `.env.local`. Run `0001_init.sql` in the Supabase SQL editor. Install `@supabase/supabase-js` and `@supabase/ssr`. Add the three Supabase client helpers and `middleware.ts`. *Done when:* the app boots and a server component can read (an empty) `recipes` table.

**Phase 1 — Auth (1–2 hrs).**
Build `/login` and `/signup` (email+password) and the Google button. Add `auth/callback` route for PKCE/OAuth, `auth/signout` route, and the `(app)/layout.tsx` guard that redirects to `/login` when there's no session. *Done when:* you can sign up, land on an empty Recipe Box, refresh without being logged out, and sign out.

**Phase 2 — Recipe CRUD + Library (2–4 hrs).**
Implement `lib/data/recipes.ts`. Build `RecipeForm` (manual create), the cooking view read page, and edit page. Build the library home with `RecipeGrid`/`RecipeCard`. Wire image upload to the `recipe-images` bucket. Load `seed.sql` so the grid isn't empty. *Done when:* you can create, view, edit, and delete a recipe, with an image.

**Phase 3 — Search, Tags, Folders (2–3 hrs).**
Add `SearchBar` (title + ingredient search), `TagFilter`, and folders (`lib/data/folders.ts`, `FolderSidebar`, add/remove recipe↔folder, folder-filtered page). Add archive/delete. *Done when:* you can find any recipe by name or ingredient and organize recipes into folders.

**Phase 4 — Cooking view polish + scaling + wake lock (1–2 hrs).**
Add `ServingScaler` and wire `lib/scaling.ts` so quantities recompute live. Add the wake-lock toggle. Tune typography for readability at arm's length. *Done when:* changing servings rescales every quantity and the screen stays awake while cooking.

**Phase 5 — Grocery lists (2–3 hrs).**
Build `RecipePicker` (multi-select), wire `lib/grocery.ts` aggregation, create a list, render `GroceryList` with check-off, manual add/remove, and persistence via `grocery_items`. *Done when:* selecting 3 recipes produces a merged, checkable, persistent list.

**Phase 6 — URL import (2–3 hrs).**
Build `app/api/import/route.ts` calling `lib/import/parse-recipe.ts`. In the create page add a "Paste URL" tab that hits the API, pre-fills `RecipeForm`, and lets the user fix anything before saving. *Done when:* pasting a mainstream recipe URL pre-fills a clean editable draft.

**Phase 7 — Sharing + final polish (1–2 hrs).**
Add `ShareButton` (toggles `is_public`, copies `/share/{share_id}`), build the public `share/[shareId]` page, add loading skeletons, empty states, and error toasts across the app. *Done when:* a logged-out person can open a shared link and see only that recipe.

---

## 5. Key UI Screens

**Auth (`/login`, `/signup`)** — Centered card on a soft background. Email + password, a divider, and a "Continue with Google" button. Inline validation, a single primary action, link to the opposite page. No nav chrome.

**Recipe Box / Library (`/`)** — The home. Sticky top bar with search and a "＋ New" button. Left (desktop) / drawer (mobile) folder sidebar. Horizontal tag filter chips. Responsive card grid: image, title, tags, time. Empty state invites the first import. Bottom tab bar on mobile (Box · Grocery · New).

**New Recipe (`/recipes/new`)** — Two tabs: **Paste URL** (single input + "Import", shows a spinner, then drops you into the filled form) and **Manual**. Shared `RecipeForm`: title, description, image upload with preview, servings, prep/cook minutes, dynamic ingredient rows (qty · unit · name), dynamic step rows (add/remove/reorder), tag input.

**Cooking View (`/recipes/[id]`)** — Distraction-free. Hero image + title + meta. `ServingScaler` (½× · 1× · 2× · custom stepper). Two clear columns/sections: **Ingredients** (large, tappable to strike through) and **Steps** (numbered, generous line height). Sticky action bar: Edit · Share · "Keep screen awake" toggle · "Add to grocery list."

**Edit Recipe (`/recipes/[id]/edit`)** — Same `RecipeForm`, pre-populated. Save / Cancel / Delete.

**Folder view (`/folders/[id]`)** — Same grid, scoped to one folder, with rename/delete folder actions.

**Grocery (`/grocery`, `/grocery/[id]`)** — Index of saved lists + "New list." A list page shows the `RecipePicker` (multi-select your recipes) → generated items grouped, each with a checkbox, quantity, and a delete ✕; a manual "add item" row at the bottom. Check state and edits persist.

**Public share (`/share/[shareId]`)** — A stripped cooking view with a small "Made with Recipe Box" footer and a "Save your own recipes" CTA. No edit controls, no nav, no auth required.

---

## 6. Starter Code

Production-quality, fully typed. Copy files into the structure from §3. Everything below either compiles as-is or is a clearly-marked, complete implementation. Pure logic (`lib/scaling.ts`, `lib/grocery.ts`, `lib/import/parse-recipe.ts`) has no I/O so you can unit-test it directly.

### 6.0 Setup files

**`.env.local.example`**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used for share links + OAuth redirect
```

**`package.json`** (key deps)
```json
{
  "name": "recipe-box",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.45.0",
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3.4.7",
    "typescript": "^5",
    "vitest": "^2.0.5"
  }
}
```

### 6.1 Types — `types/index.ts`

```ts
export interface Ingredient {
  quantity: number | null;   // 1.5, 0.25, or null ("to taste")
  unit: string | null;       // "cup", "tbsp", "g", null
  name: string;              // "all-purpose flour"
  note?: string | null;      // "sifted", "room temperature"
}

export interface Step {
  text: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  is_archived: boolean;
  is_public: boolean;
  share_id: string;
  created_at: string;
  updated_at: string;
}

// Shape used by create/edit forms and the URL importer (no server-managed fields).
export type RecipeDraft = Pick<
  Recipe,
  | "title" | "description" | "image_url" | "source_url"
  | "servings" | "prep_minutes" | "cook_minutes"
  | "ingredients" | "steps" | "tags"
>;

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  created_at: string;
}

export interface GroceryList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryItem {
  id: string;
  list_id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  is_checked: boolean;
  source_recipe: string | null;
  position: number;
  created_at: string;
}
```

### 6.2 Supabase clients

**`lib/supabase/client.ts`** (browser)
```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**`lib/supabase/server.ts`** (server components + route handlers)
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes.
          }
        },
      },
    }
  );
}
```

**`middleware.ts`** (root — refreshes session + guards `(app)` routes)
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/signup", "/share", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets & images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
```

### 6.3 Auth

**`app/(auth)/login/page.tsx`**
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-neutral-500">Sign in to your recipe box.</p>

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <input
          type="email" required placeholder="you@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900"
        />
        <input
          type="password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" /> or <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        onClick={handleGoogle}
        className="w-full rounded-xl border border-neutral-200 py-3 text-sm font-medium transition hover:bg-neutral-50"
      >
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-neutral-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-neutral-900 underline">Sign up</Link>
      </p>
    </div>
  );
}
```

**`app/(auth)/signup/page.tsx`** (mirror of login)
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setMsg(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
    setLoading(false);
    if (error) return setError(error.message);
    // If email confirmation is ON, there's no session yet.
    if (data.session) { router.push("/"); router.refresh(); }
    else setMsg("Check your email to confirm your account.");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Create your recipe box</h1>
      <form onSubmit={handleSignup} className="mt-6 space-y-4">
        <input type="email" required placeholder="you@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
        <input type="password" required minLength={6} placeholder="Password (6+ chars)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-neutral-900 underline">Sign in</Link>
      </p>
    </div>
  );
}
```

**`app/auth/callback/route.ts`** (OAuth / email-confirm code exchange)
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

**`app/auth/signout/route.ts`**
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}
```

**`app/(app)/layout.tsx`** — auth guard + app shell (nav)
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import BottomNav from "@/components/nav/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
```

### 6.4 Core logic — scaling (`lib/scaling.ts`)

Pure functions. Handles decimals, `1 1/2`, `½`, and ranges (`2-3` → keeps first for scaling). Unit-testable with zero setup.

```ts
import type { Ingredient } from "@/types";

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅛": 0.125,
};

/** Parse "1 1/2", "0.25", "½", "2-3" -> number | null */
export function parseQuantity(input: string | number | null): number | null {
  if (input == null) return null;
  if (typeof input === "number") return input;
  let s = input.trim();
  if (!s) return null;

  // take the low end of a range ("2-3 cups")
  s = s.split(/\s*[-–]\s*/)[0].trim();

  // replace unicode fractions with decimals
  for (const [g, v] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(g)) s = s.replace(g, ` ${v}`).trim();
  }

  // "1 1/2" -> 1.5
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  // "3/4" -> 0.75
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Scale a single ingredient by a factor (factor = targetServings / baseServings). */
export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (ing.quantity == null) return ing;
  return { ...ing, quantity: roundNice(ing.quantity * factor) };
}

/** Round to a cooking-friendly precision (avoids 0.3333333). */
export function roundNice(n: number): number {
  if (n >= 10) return Math.round(n);
  return Math.round(n * 100) / 100;
}

const DECIMAL_TO_FRACTION: [number, string][] = [
  [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"],
  [2 / 3, "⅔"], [0.75, "¾"],
];

/** Format 1.5 -> "1½", 0.25 -> "¼" for display. */
export function formatQuantity(q: number | null): string {
  if (q == null) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const match = DECIMAL_TO_FRACTION.find(([d]) => Math.abs(d - frac) < 0.02);
  if (match) return `${whole > 0 ? whole : ""}${match[1]}`;
  return String(roundNice(q));
}
```

### 6.5 Core logic — grocery aggregation (`lib/grocery.ts`)

Merges duplicate ingredients across recipes: same normalized name **and** compatible unit → quantities add; otherwise they stay as separate lines (so "2 cups flour" + "100 g flour" don't get silently mashed together).

```ts
import type { Ingredient, Recipe } from "@/types";
import { roundNice } from "./scaling";

export interface AggregatedItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  sources: string[]; // recipe ids that contributed
}

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function normUnit(u: string | null) {
  return (u ?? "").trim().toLowerCase();
}

/**
 * Aggregate ingredients from selected recipes into a de-duplicated list.
 * Each recipe may carry a scale factor (e.g. user doubled it).
 */
export function aggregateIngredients(
  selections: { recipe: Recipe; factor?: number }[]
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>();

  for (const { recipe, factor = 1 } of selections) {
    for (const ing of recipe.ingredients) {
      const qty = ing.quantity == null ? null : roundNice(ing.quantity * factor);
      const key = `${normName(ing.name)}|${normUnit(ing.unit)}`;
      const existing = map.get(key);

      if (existing) {
        if (existing.quantity != null && qty != null) {
          existing.quantity = roundNice(existing.quantity + qty);
        } else if (qty != null) {
          existing.quantity = qty;
        }
        if (!existing.sources.includes(recipe.id)) existing.sources.push(recipe.id);
      } else {
        map.set(key, {
          name: ing.name.trim(),
          quantity: qty,
          unit: ing.unit,
          sources: [recipe.id],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
```

### 6.6 Core logic — URL import parser (`lib/import/parse-recipe.ts`)

Server-side. Prefers Schema.org `Recipe` JSON-LD (used by most food sites), falls back to Open Graph meta for title/image. Never throws to the caller — returns a best-effort draft the user can fix.

```ts
import type { Ingredient, RecipeDraft, Step } from "@/types";
import { parseQuantity } from "@/lib/scaling";

/** Split a raw ingredient string like "1 1/2 cups flour, sifted" into parts. */
export function parseIngredientLine(line: string): Ingredient {
  const raw = line.trim();
  // quantity: leading number / fraction / unicode fraction
  const qtyMatch = raw.match(/^([\d./\s¼-¾⅐-⅞]+)?\s*(.*)$/u);
  const qtyStr = qtyMatch?.[1]?.trim() ?? "";
  let rest = qtyMatch?.[2]?.trim() ?? raw;

  const KNOWN_UNITS = [
    "cups","cup","tbsp","tablespoons","tablespoon","tsp","teaspoons","teaspoon",
    "g","grams","kg","ml","l","oz","ounces","lb","lbs","pound","pounds","cloves","clove","pinch","cans","can",
  ];
  let unit: string | null = null;
  const firstWord = rest.split(/\s+/)[0]?.toLowerCase();
  if (firstWord && KNOWN_UNITS.includes(firstWord)) {
    unit = firstWord;
    rest = rest.slice(firstWord.length).trim();
  }

  let note: string | null = null;
  const commaIdx = rest.indexOf(",");
  if (commaIdx > -1) {
    note = rest.slice(commaIdx + 1).trim() || null;
    rest = rest.slice(0, commaIdx).trim();
  }

  return { quantity: parseQuantity(qtyStr), unit, name: rest || raw, note };
}

function toArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function findRecipeNode(json: any): any | null {
  const nodes = Array.isArray(json) ? json : json["@graph"] ?? [json];
  for (const n of toArray(nodes)) {
    const type = n?.["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types?.includes("Recipe")) return n;
  }
  return null;
}

/** Fetch a URL and extract a RecipeDraft. Best-effort; fields may be empty. */
export async function parseRecipeFromUrl(url: string): Promise<RecipeDraft> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 RecipeBox/1.0" },
    // 8s guard so a slow site can't hang the request
    signal: AbortSignal.timeout(8000),
  });
  const html = await res.text();

  const draft: RecipeDraft = {
    title: "", description: null, image_url: null, source_url: url,
    servings: 2, prep_minutes: null, cook_minutes: null,
    ingredients: [], steps: [], tags: [],
  };

  // 1) JSON-LD
  const ldMatches = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];
  for (const m of ldMatches) {
    try {
      const node = findRecipeNode(JSON.parse(m[1].trim()));
      if (!node) continue;

      draft.title = String(node.name ?? draft.title);
      draft.description = node.description ? String(node.description) : draft.description;

      const img = node.image;
      draft.image_url =
        typeof img === "string" ? img :
        Array.isArray(img) ? (typeof img[0] === "string" ? img[0] : img[0]?.url ?? null) :
        img?.url ?? draft.image_url;

      if (node.recipeYield) {
        const y = parseInt(String(toArray(node.recipeYield)[0]).replace(/\D/g, ""), 10);
        if (Number.isFinite(y) && y > 0) draft.servings = y;
      }
      draft.prep_minutes = isoDurationToMinutes(node.prepTime) ?? draft.prep_minutes;
      draft.cook_minutes = isoDurationToMinutes(node.cookTime) ?? draft.cook_minutes;

      draft.ingredients = toArray<string>(node.recipeIngredient).map(parseIngredientLine);

      const instr = node.recipeInstructions;
      draft.steps = extractSteps(instr);

      const kw = node.keywords;
      draft.tags = typeof kw === "string" ? kw.split(",").map((t: string) => t.trim()).filter(Boolean)
                 : Array.isArray(kw) ? kw.map(String) : [];

      if (draft.title && draft.ingredients.length) return draft; // good enough
    } catch {
      // malformed JSON-LD block — try the next one
    }
  }

  // 2) Fallback: Open Graph for at least title + image
  draft.title ||= meta(html, "og:title") ?? tag(html, "title") ?? "Untitled recipe";
  draft.image_url ||= meta(html, "og:image");
  draft.description ||= meta(html, "og:description");
  return draft;
}

function extractSteps(instr: any): Step[] {
  const out: Step[] = [];
  for (const item of toArray(instr)) {
    if (typeof item === "string") out.push({ text: item });
    else if (item?.["@type"] === "HowToStep" && item.text) out.push({ text: String(item.text) });
    else if (item?.["@type"] === "HowToSection") out.push(...extractSteps(item.itemListElement));
    else if (item?.text) out.push({ text: String(item.text) });
  }
  return out;
}

function isoDurationToMinutes(iso?: string): number | null {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0) || null;
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  return html.match(re)?.[1] ?? null;
}
function tag(html: string, name: string): string | null {
  return html.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, "i"))?.[1]?.trim() ?? null;
}
```

**`app/api/import/route.ts`** — thin, validated wrapper
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRecipeFromUrl } from "@/lib/import/parse-recipe";

export async function POST(request: Request) {
  // require an authenticated user (prevents open-proxy abuse)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let url: string;
  try {
    ({ url } = await request.json());
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Please provide a valid http(s) URL." }, { status: 400 });
  }

  try {
    const draft = await parseRecipeFromUrl(url);
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that page. You can still add the recipe manually." },
      { status: 422 }
    );
  }
}
```

### 6.7 Data layer — `lib/data/recipes.ts`

Typed server functions used by server components and route handlers.

```ts
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeDraft } from "@/types";

export async function listRecipes(opts?: {
  search?: string; tag?: string; folderId?: string; includeArchived?: boolean;
}): Promise<Recipe[]> {
  const supabase = await createClient();
  let query = supabase.from("recipes").select("*").order("created_at", { ascending: false });

  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  if (opts?.tag) query = query.contains("tags", [opts.tag]);
  if (opts?.search) {
    // title match OR ingredient-name match (ingredients is jsonb)
    query = query.or(`title.ilike.%${opts.search}%,ingredients.cs.[{"name":"${opts.search}"}]`);
  }

  if (opts?.folderId) {
    const { data: links } = await supabase
      .from("recipe_folders").select("recipe_id").eq("folder_id", opts.folderId);
    const ids = (links ?? []).map((l) => l.recipe_id);
    if (!ids.length) return [];
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).single();
  return (data as Recipe) ?? null;
}

export async function getRecipeByShareId(shareId: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes").select("*").eq("share_id", shareId).eq("is_public", true).single();
  return (data as Recipe) ?? null;
}

export async function createRecipe(draft: RecipeDraft): Promise<Recipe> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("recipes").insert({ ...draft, user_id: user.id }).select("*").single();
  if (error) throw error;
  return data as Recipe;
}

export async function updateRecipe(id: string, patch: Partial<RecipeDraft>): Promise<Recipe> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

export async function setRecipePublic(id: string, isPublic: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}
```

### 6.8 Navigation — `components/nav/TopBar.tsx` & `BottomNav.tsx`

```tsx
// components/nav/TopBar.tsx
import Link from "next/link";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">🍳 Recipe Box</Link>
        <div className="flex items-center gap-2">
          <Link href="/recipes/new"
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            ＋ New
          </Link>
          <form action="/auth/signout" method="post">
            <button className="rounded-xl px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

```tsx
// components/nav/BottomNav.tsx  (mobile tab bar)
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Box", icon: "🍳" },
  { href: "/recipes/new", label: "New", icon: "＋" },
  { href: "/grocery", label: "Grocery", icon: "🛒" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white md:hidden">
      <div className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-neutral-900" : "text-neutral-400"}`}>
              <span className="text-lg">{t.icon}</span>{t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### 6.9 Library — `RecipeCard`, `RecipeGrid`, and the home page

```tsx
// components/recipe/RecipeCard.tsx
import Link from "next/link";
import type { Recipe } from "@/types";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return (
    <Link href={`/recipes/${recipe.id}`}
      className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt={recipe.title}
            className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🍽️</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 font-medium">{recipe.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
          {total > 0 && <span>{total} min</span>}
          {recipe.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5">{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

```tsx
// components/recipe/RecipeGrid.tsx
import type { Recipe } from "@/types";
import RecipeCard from "./RecipeCard";

export default function RecipeGrid({ recipes }: { recipes: Recipe[] }) {
  if (!recipes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
        <p className="text-4xl">🍲</p>
        <p className="mt-3 font-medium">Your recipe box is empty</p>
        <p className="mt-1 text-sm text-neutral-500">Paste a link or add a recipe to get started.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
    </div>
  );
}
```

```tsx
// app/(app)/page.tsx  — the Recipe Box home (server component)
import { listRecipes } from "@/lib/data/recipes";
import RecipeGrid from "@/components/recipe/RecipeGrid";
import SearchBar from "@/components/library/SearchBar";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const recipes = await listRecipes({ search: q, tag });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipe Box</h1>
        <span className="text-sm text-neutral-500">{recipes.length} recipes</span>
      </div>
      <SearchBar defaultValue={q} />
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
```

```tsx
// components/library/SearchBar.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); router.push(q ? `/?q=${encodeURIComponent(q)}` : "/"); }}
      className="relative"
    >
      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title or ingredient…"
        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900" />
    </form>
  );
}
```

### 6.10 Cooking view — `ServingScaler`, wake-lock hook, `CookingView`, page

```ts
// lib/wake-lock.ts
"use client";
import { useEffect, useRef, useState } from "react";

export function useWakeLock() {
  const [enabled, setEnabled] = useState(false);
  const lockRef = useRef<any>(null);

  useEffect(() => {
    async function apply() {
      try {
        if (enabled && "wakeLock" in navigator) {
          lockRef.current = await (navigator as any).wakeLock.request("screen");
        } else {
          await lockRef.current?.release?.();
          lockRef.current = null;
        }
      } catch { /* unsupported or denied — no-op */ }
    }
    apply();
    // re-acquire if the tab was backgrounded then refocused
    const onVis = () => { if (enabled && document.visibilityState === "visible") apply(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lockRef.current?.release?.(); };
  }, [enabled]);

  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  return { enabled, setEnabled, supported };
}
```

```tsx
// components/recipe/ServingScaler.tsx
"use client";

export default function ServingScaler({
  base, value, onChange,
}: { base: number; value: number; onChange: (n: number) => void }) {
  const presets = [0.5, 1, 2];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">Servings</span>
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200 p-1">
        {presets.map((p) => {
          const target = Math.max(1, Math.round(base * p));
          const active = value === target;
          return (
            <button key={p} onClick={() => onChange(target)}
              className={`rounded-lg px-2.5 py-1 text-sm ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}>
              {p === 0.5 ? "½×" : `${p}×`}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, value - 1))}
          className="h-8 w-8 rounded-lg border border-neutral-200">–</button>
        <span className="w-8 text-center text-sm font-medium">{value}</span>
        <button onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-lg border border-neutral-200">+</button>
      </div>
    </div>
  );
}
```

```tsx
// components/recipe/CookingView.tsx  (client — owns scale + wake-lock state)
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/types";
import { scaleIngredient, formatQuantity } from "@/lib/scaling";
import { useWakeLock } from "@/lib/wake-lock";
import ServingScaler from "./ServingScaler";
import ShareButton from "./ShareButton";

export default function CookingView({ recipe, readOnly = false }: { recipe: Recipe; readOnly?: boolean }) {
  const [servings, setServings] = useState(recipe.servings);
  const [done, setDone] = useState<Set<number>>(new Set());
  const { enabled, setEnabled, supported } = useWakeLock();
  const factor = servings / recipe.servings;

  const ingredients = useMemo(
    () => recipe.ingredients.map((i) => scaleIngredient(i, factor)),
    [recipe.ingredients, factor]
  );

  function toggle(i: number) {
    setDone((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  return (
    <article className="mx-auto max-w-3xl">
      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image_url} alt={recipe.title}
          className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover" />
      )}
      <h1 className="text-3xl font-semibold tracking-tight">{recipe.title}</h1>
      {recipe.description && <p className="mt-2 text-neutral-600">{recipe.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
        {recipe.prep_minutes != null && <span>Prep {recipe.prep_minutes}m</span>}
        {recipe.cook_minutes != null && <span>Cook {recipe.cook_minutes}m</span>}
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noreferrer" className="underline">Source</a>
        )}
      </div>

      {/* sticky action bar */}
      <div className="sticky top-16 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/90 p-3 backdrop-blur">
        <ServingScaler base={recipe.servings} value={servings} onChange={setServings} />
        <div className="flex items-center gap-2">
          {supported && (
            <button onClick={() => setEnabled(!enabled)}
              className={`rounded-xl px-3 py-2 text-sm ${enabled ? "bg-amber-100 text-amber-800" : "border border-neutral-200"}`}>
              {enabled ? "🔆 Screen on" : "🌙 Keep screen awake"}
            </button>
          )}
          {!readOnly && (
            <>
              <ShareButton recipeId={recipe.id} shareId={recipe.share_id} isPublic={recipe.is_public} />
              <Link href={`/recipes/${recipe.id}/edit`}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm">Edit</Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <ul className="mt-3 space-y-1">
            {ingredients.map((ing, i) => (
              <li key={i}>
                <button onClick={() => toggle(i)}
                  className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-2 text-left text-[15px] hover:bg-neutral-50 ${done.has(i) ? "text-neutral-400 line-through" : ""}`}>
                  <span className="min-w-[3.5rem] font-medium">
                    {formatQuantity(ing.quantity)}{ing.unit ? ` ${ing.unit}` : ""}
                  </span>
                  <span>{ing.name}{ing.note ? `, ${ing.note}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Steps</h2>
          <ol className="mt-3 space-y-4">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm text-white">{i + 1}</span>
                <p className="pt-0.5 text-[15px] leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
```

```tsx
// app/(app)/recipes/[id]/page.tsx
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import CookingView from "@/components/recipe/CookingView";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return <CookingView recipe={recipe} />;
}
```

### 6.11 Server actions — `app/(app)/recipes/actions.ts`

Actions keep the form a clean client component while writes stay server-side.

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRecipe, updateRecipe, deleteRecipe } from "@/lib/data/recipes";
import type { RecipeDraft } from "@/types";

export async function saveNewRecipe(draft: RecipeDraft) {
  const recipe = await createRecipe(draft);
  revalidatePath("/");
  redirect(`/recipes/${recipe.id}`);
}

export async function saveRecipeEdit(id: string, draft: Partial<RecipeDraft>) {
  await updateRecipe(id, draft);
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function removeRecipe(id: string) {
  await deleteRecipe(id);
  revalidatePath("/");
  redirect("/");
}
```

### 6.12 The form — `components/recipe/RecipeForm.tsx` (shared by create + edit)

Dynamic ingredient/step rows, image upload to Storage, tag chips. Used with an optional URL-import prefill.

```tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ingredient, RecipeDraft, Step } from "@/types";

const EMPTY: RecipeDraft = {
  title: "", description: "", image_url: null, source_url: null,
  servings: 2, prep_minutes: null, cook_minutes: null,
  ingredients: [{ quantity: null, unit: null, name: "", note: null }],
  steps: [{ text: "" }], tags: [],
};

export default function RecipeForm({
  initial, onSubmit, submitLabel = "Save recipe", onDelete,
}: {
  initial?: RecipeDraft;
  onSubmit: (draft: RecipeDraft) => Promise<void>;
  submitLabel?: string;
  onDelete?: () => Promise<void>;
}) {
  const supabase = createClient();
  const [draft, setDraft] = useState<RecipeDraft>(initial ?? EMPTY);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // --- ingredients ---
  const setIng = (i: number, patch: Partial<Ingredient>) =>
    set({ ingredients: draft.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const addIng = () => set({ ingredients: [...draft.ingredients, { quantity: null, unit: null, name: "", note: null }] });
  const rmIng = (i: number) => set({ ingredients: draft.ingredients.filter((_, j) => j !== i) });

  // --- steps ---
  const setStep = (i: number, text: string) =>
    set({ steps: draft.steps.map((x, j) => (j === i ? { text } : x)) });
  const addStep = () => set({ steps: [...draft.steps, { text: "" }] });
  const rmStep = (i: number) => set({ steps: draft.steps.filter((_, j) => j !== i) });

  // --- image upload ---
  async function handleImage(file: File) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user!.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("recipe-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      set({ image_url: data.publicUrl });
    }
    setUploading(false);
  }

  // --- tags ---
  function addTag() {
    const t = tagInput.trim();
    if (t && !draft.tags.includes(t)) set({ tags: [...draft.tags, t] });
    setTagInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // strip fully-empty rows
    const clean: RecipeDraft = {
      ...draft,
      ingredients: draft.ingredients.filter((i) => i.name.trim()),
      steps: draft.steps.filter((s) => s.text.trim()),
    };
    await onSubmit(clean);
    setSaving(false);
  }

  const input = "w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900";

  return (
    <form onSubmit={submit} className="space-y-6">
      <input className={`${input} text-lg font-medium`} placeholder="Recipe title" required
        value={draft.title} onChange={(e) => set({ title: e.target.value })} />

      <textarea className={input} rows={2} placeholder="Short description (optional)"
        value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} />

      {/* image */}
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          {draft.image_url
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-2xl">🍽️</div>}
        </div>
        <label className="cursor-pointer rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
          {uploading ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
        </label>
      </div>

      {/* meta */}
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm">Servings
          <input type="number" min={1} className={input} value={draft.servings}
            onChange={(e) => set({ servings: Number(e.target.value) })} />
        </label>
        <label className="text-sm">Prep (min)
          <input type="number" min={0} className={input} value={draft.prep_minutes ?? ""}
            onChange={(e) => set({ prep_minutes: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="text-sm">Cook (min)
          <input type="number" min={0} className={input} value={draft.cook_minutes ?? ""}
            onChange={(e) => set({ cook_minutes: e.target.value ? Number(e.target.value) : null })} />
        </label>
      </div>

      {/* ingredients */}
      <div>
        <h3 className="mb-2 font-medium">Ingredients</h3>
        <div className="space-y-2">
          {draft.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${input} w-16`} placeholder="Qty"
                value={ing.quantity ?? ""} onChange={(e) => setIng(i, { quantity: e.target.value ? Number(e.target.value) : null })} />
              <input className={`${input} w-20`} placeholder="unit"
                value={ing.unit ?? ""} onChange={(e) => setIng(i, { unit: e.target.value || null })} />
              <input className={input} placeholder="ingredient"
                value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} />
              <button type="button" onClick={() => rmIng(i)} className="px-2 text-neutral-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addIng} className="mt-2 text-sm text-neutral-600 hover:text-neutral-900">＋ Add ingredient</button>
      </div>

      {/* steps */}
      <div>
        <h3 className="mb-2 font-medium">Steps</h3>
        <div className="space-y-2">
          {draft.steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="pt-2 text-sm text-neutral-400">{i + 1}.</span>
              <textarea className={input} rows={2} placeholder="Describe this step"
                value={s.text} onChange={(e) => setStep(i, e.target.value)} />
              <button type="button" onClick={() => rmStep(i)} className="px-2 text-neutral-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="mt-2 text-sm text-neutral-600 hover:text-neutral-900">＋ Add step</button>
      </div>

      {/* tags */}
      <div>
        <h3 className="mb-2 font-medium">Tags</h3>
        <div className="mb-2 flex flex-wrap gap-1">
          {draft.tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-sm">
              {t}<button type="button" onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })}>✕</button>
            </span>
          ))}
        </div>
        <input className={input} placeholder="Add a tag and press Enter" value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          {saving ? "Saving…" : submitLabel}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="rounded-xl px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">Delete</button>
        )}
      </div>
    </form>
  );
}
```

### 6.13 Create page (URL import + manual) — `app/(app)/recipes/new/page.tsx`

```tsx
"use client";
import { useState } from "react";
import RecipeForm from "@/components/recipe/RecipeForm";
import { saveNewRecipe } from "../actions";
import type { RecipeDraft } from "@/types";

export default function NewRecipePage() {
  const [tab, setTab] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<RecipeDraft | null>(null);

  async function importUrl(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true); setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setPrefill(json.draft);
      setTab("manual"); // drop into the editable form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Add a recipe</h1>

      <div className="mb-6 flex gap-1 rounded-xl border border-neutral-200 p-1">
        {(["url", "manual"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm ${tab === t ? "bg-neutral-900 text-white" : ""}`}>
            {t === "url" ? "Paste URL" : "Manual"}
          </button>
        ))}
      </div>

      {tab === "url" && !prefill && (
        <form onSubmit={importUrl} className="space-y-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required
            placeholder="https://example.com/best-pasta"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={importing}
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {importing ? "Reading page…" : "Import recipe"}
          </button>
          <p className="text-xs text-neutral-500">We'll pull in what we can — you can fix anything before saving.</p>
        </form>
      )}

      {tab === "manual" && (
        <RecipeForm initial={prefill ?? undefined} onSubmit={saveNewRecipe} submitLabel="Save recipe" />
      )}
    </div>
  );
}
```

### 6.14 Edit page — `app/(app)/recipes/[id]/edit/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import EditClient from "./EditClient";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return <EditClient recipe={recipe} />;
}
```

```tsx
// app/(app)/recipes/[id]/edit/EditClient.tsx
"use client";
import RecipeForm from "@/components/recipe/RecipeForm";
import { saveRecipeEdit, removeRecipe } from "../../actions";
import type { Recipe, RecipeDraft } from "@/types";

export default function EditClient({ recipe }: { recipe: Recipe }) {
  const initial: RecipeDraft = {
    title: recipe.title, description: recipe.description, image_url: recipe.image_url,
    source_url: recipe.source_url, servings: recipe.servings,
    prep_minutes: recipe.prep_minutes, cook_minutes: recipe.cook_minutes,
    ingredients: recipe.ingredients, steps: recipe.steps, tags: recipe.tags,
  };
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Edit recipe</h1>
      <RecipeForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={(d) => saveRecipeEdit(recipe.id, d)}
        onDelete={() => removeRecipe(recipe.id)}
      />
    </div>
  );
}
```

### 6.15 Sharing — `ShareButton` + public page

```tsx
// components/recipe/ShareButton.tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ShareButton({
  recipeId, shareId, isPublic,
}: { recipeId: string; shareId: string; isPublic: boolean }) {
  const supabase = createClient();
  const [pub, setPub] = useState(isPublic);
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/share/${shareId}`;

  async function toggle() {
    const next = !pub;
    setPub(next);
    await supabase.from("recipes").update({ is_public: next }).eq("id", recipeId);
  }
  async function copy() {
    if (!pub) await toggle();
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button onClick={copy}
      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
      {copied ? "Link copied!" : pub ? "🔗 Copy link" : "Share"}
    </button>
  );
}
```

```tsx
// app/share/[shareId]/page.tsx  (public, no auth)
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRecipeByShareId } from "@/lib/data/recipes";
import CookingView from "@/components/recipe/CookingView";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const recipe = await getRecipeByShareId(shareId);
  if (!recipe) notFound();

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <CookingView recipe={recipe} readOnly />
      <footer className="mx-auto mt-10 max-w-3xl border-t border-neutral-200 pt-6 text-center text-sm text-neutral-500">
        Made with <span className="font-medium text-neutral-900">Recipe Box</span> ·{" "}
        <Link href="/signup" className="underline">Save your own recipes</Link>
      </footer>
    </div>
  );
}
```

> The public page works because of the `"public recipes are readable"` RLS policy — an anonymous request can `select` a recipe only when `is_public = true`. No private data leaks even though there's no auth on the route.

### 6.16 Grocery — data layer, aggregation into a list, and the UI

```ts
// lib/data/grocery.ts
import { createClient } from "@/lib/supabase/server";
import { aggregateIngredients } from "@/lib/grocery";
import type { GroceryItem, GroceryList, Recipe } from "@/types";

export async function listGroceryLists(): Promise<GroceryList[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("grocery_lists").select("*").order("created_at", { ascending: false });
  return (data ?? []) as GroceryList[];
}

export async function getListWithItems(id: string) {
  const supabase = await createClient();
  const [{ data: list }, { data: items }] = await Promise.all([
    supabase.from("grocery_lists").select("*").eq("id", id).single(),
    supabase.from("grocery_items").select("*").eq("list_id", id).order("position"),
  ]);
  return { list: list as GroceryList | null, items: (items ?? []) as GroceryItem[] };
}

/** Create a list from selected recipes, writing merged rows to grocery_items. */
export async function createListFromRecipes(recipeIds: string[], name = "Shopping list") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: recipes } = await supabase.from("recipes").select("*").in("id", recipeIds);
  const items = aggregateIngredients((recipes as Recipe[] ?? []).map((r) => ({ recipe: r })));

  const { data: list, error } = await supabase
    .from("grocery_lists").insert({ user_id: user.id, name }).select("*").single();
  if (error) throw error;

  if (items.length) {
    await supabase.from("grocery_items").insert(
      items.map((it, i) => ({
        list_id: list.id, user_id: user.id, name: it.name,
        quantity: it.quantity, unit: it.unit, position: i,
        source_recipe: it.sources[0] ?? null,
      }))
    );
  }
  return list as GroceryList;
}
```

```tsx
// components/grocery/GroceryList.tsx  (client — check-off, add, remove; persists live)
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatQuantity } from "@/lib/scaling";
import type { GroceryItem } from "@/types";

export default function GroceryListView({
  listId, initialItems,
}: { listId: string; initialItems: GroceryItem[] }) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");

  async function toggle(item: GroceryItem) {
    const next = !item.is_checked;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_checked: next } : x)));
    await supabase.from("grocery_items").update({ is_checked: next }).eq("id", item.id);
  }
  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("grocery_items").delete().eq("id", id);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("grocery_items")
      .insert({ list_id: listId, user_id: user!.id, name: name.trim(), position: items.length })
      .select("*").single();
    if (data) setItems((xs) => [...xs, data as GroceryItem]);
    setName("");
  }

  const remaining = items.filter((i) => !i.is_checked).length;

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-500">{remaining} of {items.length} left</p>
      <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <input type="checkbox" checked={item.is_checked} onChange={() => toggle(item)}
              className="h-5 w-5 rounded" />
            <span className={`flex-1 ${item.is_checked ? "text-neutral-400 line-through" : ""}`}>
              {item.quantity != null && <b>{formatQuantity(item.quantity)}{item.unit ? ` ${item.unit}` : ""} </b>}
              {item.name}
            </span>
            <button onClick={() => remove(item.id)} className="text-neutral-300 hover:text-red-600">✕</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item…"
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-neutral-900" />
        <button className="rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white">Add</button>
      </form>
    </div>
  );
}
```

```tsx
// app/(app)/grocery/[id]/page.tsx
import { notFound } from "next/navigation";
import { getListWithItems } from "@/lib/data/grocery";
import GroceryListView from "@/components/grocery/GroceryList";

export default async function GroceryListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { list, items } = await getListWithItems(id);
  if (!list) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{list.name}</h1>
      <GroceryListView listId={list.id} initialItems={items} />
    </div>
  );
}
```

```tsx
// app/(app)/grocery/page.tsx  — lists index + "new from recipes"
import Link from "next/link";
import { listGroceryLists } from "@/lib/data/grocery";
import { listRecipes } from "@/lib/data/recipes";
import NewListPicker from "@/components/grocery/RecipePicker";

export default async function GroceryIndex() {
  const [lists, recipes] = await Promise.all([listGroceryLists(), listRecipes()]);
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">Grocery lists</h1>
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/grocery/${l.id}`}
                className="block rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:shadow-sm">
                {l.name}
              </Link>
            </li>
          ))}
          {!lists.length && <p className="text-sm text-neutral-500">No lists yet.</p>}
        </ul>
      </div>
      <div>
        <h2 className="mb-3 font-medium">New list from recipes</h2>
        <NewListPicker recipes={recipes} />
      </div>
    </div>
  );
}
```

```tsx
// components/grocery/RecipePicker.tsx  (client -> server action)
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/types";
import { makeListFromRecipes } from "@/app/(app)/grocery/actions";

export default function RecipePicker({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  async function generate() {
    setBusy(true);
    const list = await makeListFromRecipes([...selected]);
    router.push(`/grocery/${list.id}`);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {recipes.map((r) => (
          <button key={r.id} onClick={() => toggle(r.id)}
            className={`rounded-xl border p-2 text-left text-sm ${selected.has(r.id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>
            {r.title}
          </button>
        ))}
      </div>
      <button onClick={generate} disabled={!selected.size || busy}
        className="mt-4 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40">
        {busy ? "Building…" : `Generate list (${selected.size})`}
      </button>
    </div>
  );
}
```

```ts
// app/(app)/grocery/actions.ts
"use server";
import { createListFromRecipes } from "@/lib/data/grocery";
export async function makeListFromRecipes(recipeIds: string[]) {
  return createListFromRecipes(recipeIds);
}
```

### 6.17 Seed data — `supabase/seed.sql`

Run after the migration, replacing `:uid` with your own auth user id (copy it from Supabase → Authentication → Users) so the grid isn't empty on first login.

```sql
insert into public.recipes (user_id, title, description, image_url, servings, prep_minutes, cook_minutes, ingredients, steps, tags)
values
(':uid', 'Weeknight Garlic Butter Pasta',
 'Fast, cozy, five ingredients.', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9',
 2, 5, 15,
 '[{"quantity":200,"unit":"g","name":"spaghetti","note":null},
   {"quantity":3,"unit":"tbsp","name":"butter","note":null},
   {"quantity":4,"unit":"cloves","name":"garlic","note":"minced"},
   {"quantity":0.5,"unit":"cup","name":"parmesan","note":"grated"},
   {"quantity":null,"unit":null,"name":"salt & pepper","note":"to taste"}]'::jsonb,
 '[{"text":"Boil spaghetti in salted water until al dente."},
   {"text":"Melt butter, add garlic, cook 1 minute."},
   {"text":"Toss pasta with butter, garlic, parmesan and a splash of pasta water."},
   {"text":"Season and serve."}]'::jsonb,
 array['pasta','quick','vegetarian']),
(':uid', 'Sheet-Pan Lemon Chicken',
 'Hands-off dinner.', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b',
 4, 10, 35,
 '[{"quantity":4,"unit":null,"name":"chicken thighs","note":null},
   {"quantity":1,"unit":null,"name":"lemon","note":"sliced"},
   {"quantity":2,"unit":"tbsp","name":"olive oil","note":null},
   {"quantity":1,"unit":"tsp","name":"paprika","note":null}]'::jsonb,
 '[{"text":"Heat oven to 220C."},
   {"text":"Toss chicken with oil, paprika, lemon."},
   {"text":"Roast 30-35 min until golden."}]'::jsonb,
 array['chicken','dinner','sheet-pan']);
```

### 6.18 Example unit test — `lib/__tests__/logic.test.ts`

Proves the two riskiest pure functions. Run with `npm test`.

```ts
import { describe, expect, it } from "vitest";
import { parseQuantity, formatQuantity, scaleIngredient } from "@/lib/scaling";
import { aggregateIngredients } from "@/lib/grocery";
import type { Recipe } from "@/types";

describe("parseQuantity", () => {
  it("handles decimals, mixed, unicode, ranges", () => {
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("¾")).toBeCloseTo(0.75);
    expect(parseQuantity("2-3")).toBe(2);
    expect(parseQuantity("0.25")).toBe(0.25);
    expect(parseQuantity("to taste")).toBeNull();
  });
});

describe("scaling round-trip", () => {
  it("doubles and formats nicely", () => {
    const scaled = scaleIngredient({ quantity: 0.75, unit: "cup", name: "flour" }, 2);
    expect(scaled.quantity).toBe(1.5);
    expect(formatQuantity(scaled.quantity)).toBe("1½");
  });
});

describe("aggregateIngredients", () => {
  it("merges same name+unit, keeps different units separate", () => {
    const base = (over: Partial<Recipe>): Recipe => ({
      id: "r", user_id: "u", title: "", description: null, image_url: null, source_url: null,
      servings: 1, prep_minutes: null, cook_minutes: null, steps: [], tags: [],
      is_archived: false, is_public: false, share_id: "s",
      created_at: "", updated_at: "", ingredients: [], ...over,
    });
    const a = base({ id: "a", ingredients: [{ quantity: 1, unit: "cup", name: "flour" }] });
    const b = base({ id: "b", ingredients: [
      { quantity: 2, unit: "cup", name: "Flour" },       // merges (case-insensitive)
      { quantity: 100, unit: "g", name: "flour" },        // stays separate (different unit)
    ]});
    const out = aggregateIngredients([{ recipe: a }, { recipe: b }]);
    const cupFlour = out.find((x) => x.unit === "cup");
    expect(cupFlour?.quantity).toBe(3);
    expect(out.filter((x) => x.name.toLowerCase() === "flour")).toHaveLength(2);
  });
});
```

---

## 7. Gotchas & Best Practices (especially on Replit)

**Environment variables & secrets.** Put `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` in Replit's **Secrets** panel, not in a committed `.env`. Anything prefixed `NEXT_PUBLIC_` is exposed to the browser — that's fine for the anon key (RLS protects your data) but **never** put a Supabase `service_role` key in a `NEXT_PUBLIC_` var or in client code. This MVP doesn't need the service key at all.

**The dev URL changes — set it right.** Replit serves your app on a `*.replit.dev` (or `*.repl.co`) URL, and it can change. Two things break if you hardcode `localhost`: (1) Google OAuth redirect, and (2) share links. Set `NEXT_PUBLIC_SITE_URL` to the actual Replit URL, and add that same URL to **Supabase → Authentication → URL Configuration → Redirect URLs** and Site URL. Add `<your-url>/auth/callback` specifically. In Google Cloud Console, add the same callback as an authorized redirect URI.

**Next.js dev host on Replit.** If HMR or the preview won't connect, run dev bound to all interfaces: set the run command to `next dev -H 0.0.0.0 -p 3000` (Replit maps the port for you). Keep the app on one port; don't run Supabase locally — use the hosted project.

**`cookies()` / `searchParams` / `params` are async in Next 14.2+/15.** Note every server component above does `await params` / `await searchParams` and the server client does `await cookies()`. If you're on an older Next, drop the `await` — but match your version or you'll get runtime errors.

**Run `getUser()`, not `getSession()`, on the server.** `getUser()` revalidates the token with Supabase; `getSession()` trusts the cookie and can be spoofed. The middleware and layout guard both use `getUser()`.

**RLS is your real security boundary — test it.** UI checks are cosmetic. Verify with a second account that you can't read someone else's recipe by ID, and confirm a logged-out `curl` of `/share/<shareId>` works only when `is_public = true`. Never disable RLS "just to debug"; add a policy instead.

**URL import is best-effort by design.** Sites vary wildly: some hide recipes behind JavaScript (your server `fetch` gets HTML only, so JS-rendered content won't parse), some block non-browser user agents, some have malformed JSON-LD. That's why the parser never throws and always returns an editable draft, and why the flow always lands the user in the form to fix things. Don't chase 100% — the 8-second timeout plus graceful fallback is the correct trade-off. (If you later want more coverage, add a paid extraction API as a fallback behind the same route.)

**Server-side fetch can be abused as a proxy.** The `/api/import` route requires an authenticated user and validates the URL is `http(s)` before fetching. Keep both checks. For extra safety later, block requests to private IP ranges (SSRF protection).

**Image handling.** The starter uses plain `<img>` (with the eslint-disable) to avoid `next/image` remote-domain config friction on Replit. If you switch to `next/image`, add your Supabase storage domain and any seed image domains to `images.remotePatterns` in `next.config.mjs`, or builds will fail on external images.

**Wake Lock is not universal.** The Screen Wake Lock API needs HTTPS and isn't on every browser (notably older iOS Safari). The hook feature-detects and no-ops when unsupported, and the button only renders when `supported` — so the fallback is simply large, legible typography. Don't block cooking on it.

**Keep secrets and the seed uid out of git.** The seed uses a placeholder `:uid`; don't commit a real one. Add `.env*`, `.next/`, and `node_modules/` to `.gitignore` (create-next-app does this, but confirm on Replit).

**Loading & error states.** Add `loading.tsx` and `error.tsx` files per route segment — App Router wires them automatically to Suspense/error boundaries, which is the cheapest way to make the app feel solid. The list/detail pages are server components, so a simple skeleton in `loading.tsx` covers the fetch wait.

**Performance & cost.** Everything here is well within Supabase's free tier for personal use. The GIN/trigram indexes keep search fast as the library grows. `revalidatePath` after writes keeps the server-rendered library fresh without client refetch plumbing.

**Extending later (schema is ready for it).** Promote ingredients to their own table when you want cross-recipe queries; add a `recipe_shares` table if you want per-link revocation or view counts; add `nutrition jsonb` to `recipes` without touching anything else. The `(app)` route group means you can add a marketing landing page at the root later by moving the library to `/box`.

---

### Build order recap
Phase 0 (setup) → 1 (auth) → 2 (CRUD + library) → 3 (search/tags/folders) → 4 (cooking + scaling) → 5 (grocery) → 6 (URL import) → 7 (sharing + polish). Commit after each; each phase leaves you with something runnable.

*End of spec.*





