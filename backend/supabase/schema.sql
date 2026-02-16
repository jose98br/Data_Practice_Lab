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

create table if not exists public.profile_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  total_exp bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace view public.leaderboard as
select
  p.name,
  coalesce(ps.total_exp, 0)::bigint as score
from public.profiles p
left join public.profile_stats ps on ps.profile_id = p.id
order by score desc, p.name asc;

create or replace function public.add_profile_exp(p_profile_id uuid, p_exp bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.profile_stats (profile_id, total_exp, updated_at)
  values (p_profile_id, greatest(p_exp, 0), now())
  on conflict (profile_id)
  do update set
    total_exp = public.profile_stats.total_exp + greatest(excluded.total_exp, 0),
    updated_at = now();
$$;

create or replace function public.set_profile_exp_max(p_profile_id uuid, p_total_exp bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.profile_stats (profile_id, total_exp, updated_at)
  values (p_profile_id, greatest(p_total_exp, 0), now())
  on conflict (profile_id)
  do update set
    total_exp = greatest(public.profile_stats.total_exp, excluded.total_exp),
    updated_at = now();
$$;

alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.completions enable row level security;
alter table public.profile_stats enable row level security;

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

drop policy if exists "profile_stats_select_all" on public.profile_stats;
create policy "profile_stats_select_all"
on public.profile_stats for select
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

grant execute on function public.add_profile_exp(uuid, bigint) to anon, authenticated;
grant execute on function public.set_profile_exp_max(uuid, bigint) to anon, authenticated;
