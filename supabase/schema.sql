-- Invite Studio — Supabase schema
-- Run this in the SQL editor of a fresh Supabase project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- projects
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Untitled invite',
  data        jsonb not null default '{}'::jsonb,   -- contract-shaped layout JSON
  thumbnail   text not null default '',              -- data-url preview
  created_by  text not null default coalesce(auth.email(), 'unknown'),
  updated_by  text not null default coalesce(auth.email(), 'unknown'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- assets
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  folder      text not null default '',
  kind        text not null default 'image',
  url         text not null,
  created_by  text not null default coalesce(auth.email(), 'unknown'),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
-- Internal team tool: every signed-in user gets full access.
-- To restrict sign-ups to your team, either disable public sign-ups in
-- Auth settings, or tighten the policies to a domain, e.g.:
--   using (auth.email() like '%@cu-mehrweg.com')

alter table public.projects enable row level security;
alter table public.assets   enable row level security;

drop policy if exists "team full access" on public.projects;
create policy "team full access" on public.projects
  for all to authenticated using (true) with check (true);

drop policy if exists "team full access" on public.assets;
create policy "team full access" on public.assets
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

drop policy if exists "team upload" on storage.objects;
create policy "team upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'assets');

drop policy if exists "team update" on storage.objects;
create policy "team update" on storage.objects
  for update to authenticated using (bucket_id = 'assets');

drop policy if exists "team delete" on storage.objects;
create policy "team delete" on storage.objects
  for delete to authenticated using (bucket_id = 'assets');

drop policy if exists "public read" on storage.objects;
create policy "public read" on storage.objects
  for select using (bucket_id = 'assets');
