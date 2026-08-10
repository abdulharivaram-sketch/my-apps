-- ============================================================
-- Recipe Box — initial schema
-- Run in Supabase → SQL Editor.
-- ============================================================
create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- profiles (1:1 with auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- recipes
create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  description   text,
  image_url     text,
  source_url    text,
  servings      integer default 2 check (servings > 0),
  prep_minutes  integer check (prep_minutes >= 0),
  cook_minutes  integer check (cook_minutes >= 0),
  ingredients   jsonb not null default '[]'::jsonb,
  steps         jsonb not null default '[]'::jsonb,
  tags          text[] not null default '{}',
  is_archived   boolean not null default false,
  is_public     boolean not null default false,
  share_id      uuid unique default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index recipes_user_id_idx    on public.recipes (user_id);
create index recipes_tags_idx       on public.recipes using gin (tags);
create index recipes_share_id_idx   on public.recipes (share_id);
create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);

-- folders
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text,
  created_at  timestamptz not null default now()
);
create index folders_user_id_idx on public.folders (user_id);

-- recipe_folders (many-to-many)
create table public.recipe_folders (
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  folder_id   uuid not null references public.folders(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (recipe_id, folder_id)
);
create index recipe_folders_folder_idx on public.recipe_folders (folder_id);

-- grocery
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

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger recipes_touch        before update on public.recipes
  for each row execute function public.touch_updated_at();
create trigger grocery_lists_touch  before update on public.grocery_lists
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

create policy "own recipes" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
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

-- Storage bucket for recipe images
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
