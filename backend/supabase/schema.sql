-- Data Practice Lab - Supabase schema

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 2 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, exercise_id)
);

create or replace view public.leaderboard as
select
  p.name,
  count(c.id)::int as score
from public.profiles p
left join public.completions c on c.profile_id = p.id
group by p.id, p.name
order by score desc, p.name asc;

alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.completions enable row level security;

-- read policies
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles for select
using (true);

drop policy if exists "visits_select_all" on public.visits;
create policy "visits_select_all"
on public.visits for select
using (true);

drop policy if exists "completions_select_all" on public.completions;
create policy "completions_select_all"
on public.completions for select
using (true);

-- insert policies (anon)
drop policy if exists "profiles_insert_all" on public.profiles;
create policy "profiles_insert_all"
on public.profiles for insert
with check (true);

drop policy if exists "visits_insert_all" on public.visits;
create policy "visits_insert_all"
on public.visits for insert
with check (true);

drop policy if exists "completions_insert_all" on public.completions;
create policy "completions_insert_all"
on public.completions for insert
with check (true);
