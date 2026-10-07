-- EDITH v3 SUPABASE SETUP
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  role text not null default 'user',
  is_blocked boolean not null default false,
  created_at timestamptz default now()
);

-- Backfill profiles for anyone who signed up before this script ran
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Auto-create a profile on every new signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. ADMIN CHECK
-- security definer avoids the "infinite recursion" error that happens
-- when a profiles policy queries the profiles table directly
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 3. CAMPAIGN ROWS: one database row per aggregated record
drop table if exists public.campaign_data cascade;   -- old single-blob table
create table if not exists public.campaign_rows (
  id bigserial primary key,
  source text not null,              -- 'Raw Dump' or 'AppsFlyer'
  platform text,
  date text,                         -- YYYY-MM-DD
  campaign_name text,
  market text,
  spends double precision default 0,
  impressions double precision default 0,
  clicks double precision default 0,
  views double precision default 0,
  installs double precision default 0,
  sessions double precision default 0,
  add_to_cart double precision default 0,
  first_order double precision default 0,
  purchase double precision default 0,
  source_file text,
  created_at timestamptz default now()
);
create index if not exists campaign_rows_file_idx on public.campaign_rows (source_file);

-- 4. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.campaign_rows enable row level security;

drop policy if exists "Users view own profile"   on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;
drop policy if exists "Admins update profiles"   on public.profiles;
drop policy if exists "profiles_select"          on public.profiles;
drop policy if exists "profiles_update"          on public.profiles;

create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update" on public.profiles
  for update using (public.is_admin());

drop policy if exists "rows_read"   on public.campaign_rows;
drop policy if exists "rows_insert" on public.campaign_rows;
drop policy if exists "rows_delete" on public.campaign_rows;

-- Every logged-in user can read. Only admins can add or delete.
create policy "rows_read"   on public.campaign_rows for select using (auth.role() = 'authenticated');
create policy "rows_insert" on public.campaign_rows for insert with check (public.is_admin());
create policy "rows_delete" on public.campaign_rows for delete using (public.is_admin());

-- 5. CONFIRM ANY USERS STUCK WAITING FOR AN EMAIL CODE
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- 6. MAKE YOURSELF ADMIN (edit the email, then run this line on its own)
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
