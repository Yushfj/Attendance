-- Facial attendance kiosk schema
-- Run in Supabase SQL editor (or via supabase db push)

create extension if not exists "pgcrypto";

-- Organizations (multi-tenant root; seed one for MVP)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Sites (physical locations; each kiosk binds to a site)
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists sites_org_id_idx on public.sites (org_id);

-- Admin profiles linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_org_id_idx on public.profiles (org_id);

-- Employees
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  employee_code text not null,
  full_name text not null,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, employee_code)
);

create index if not exists employees_org_id_idx on public.employees (org_id);
create index if not exists employees_site_id_idx on public.employees (site_id);

-- Face embeddings (128-d float arrays from face-api.js)
create table if not exists public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  embedding jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists face_embeddings_employee_id_idx
  on public.face_embeddings (employee_id);

-- Optional kiosk device registry
create table if not exists public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null,
  api_key_hash text,
  created_at timestamptz not null default now()
);

create index if not exists kiosk_devices_site_id_idx on public.kiosk_devices (site_id);

-- Attendance events
create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  kiosk_device_id uuid references public.kiosk_devices (id) on delete set null,
  event_type text not null check (event_type in ('in', 'out')),
  confidence double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists attendance_events_employee_id_idx
  on public.attendance_events (employee_id);
create index if not exists attendance_events_site_id_idx
  on public.attendance_events (site_id);
create index if not exists attendance_events_recorded_at_idx
  on public.attendance_events (recorded_at desc);

-- Helper: current user's org
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Auto-create profile is handled by app seed / trigger below
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_org uuid;
begin
  select id into default_org from public.organizations order by created_at limit 1;
  if default_org is not null then
    insert into public.profiles (id, org_id, full_name, role)
    values (
      new.id,
      default_org,
      coalesce(new.raw_user_meta_data->>'full_name', new.email),
      'admin'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.organizations enable row level security;
alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.kiosk_devices enable row level security;
alter table public.attendance_events enable row level security;

-- Organizations: members can read their org
drop policy if exists "orgs_select_own" on public.organizations;
create policy "orgs_select_own" on public.organizations
  for select using (id = public.current_org_id());

-- Profiles
drop policy if exists "profiles_select_own_org" on public.profiles;
create policy "profiles_select_own_org" on public.profiles
  for select using (org_id = public.current_org_id());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- Sites
drop policy if exists "sites_select_own_org" on public.sites;
create policy "sites_select_own_org" on public.sites
  for select using (org_id = public.current_org_id());

drop policy if exists "sites_insert_own_org" on public.sites;
create policy "sites_insert_own_org" on public.sites
  for insert with check (org_id = public.current_org_id());

drop policy if exists "sites_update_own_org" on public.sites;
create policy "sites_update_own_org" on public.sites
  for update using (org_id = public.current_org_id());

-- Employees
drop policy if exists "employees_select_own_org" on public.employees;
create policy "employees_select_own_org" on public.employees
  for select using (org_id = public.current_org_id());

drop policy if exists "employees_insert_own_org" on public.employees;
create policy "employees_insert_own_org" on public.employees
  for insert with check (org_id = public.current_org_id());

drop policy if exists "employees_update_own_org" on public.employees;
create policy "employees_update_own_org" on public.employees
  for update using (org_id = public.current_org_id());

-- Face embeddings (via employee org)
drop policy if exists "embeddings_select_own_org" on public.face_embeddings;
create policy "embeddings_select_own_org" on public.face_embeddings
  for select using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.org_id = public.current_org_id()
    )
  );

drop policy if exists "embeddings_insert_own_org" on public.face_embeddings;
create policy "embeddings_insert_own_org" on public.face_embeddings
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.org_id = public.current_org_id()
    )
  );

drop policy if exists "embeddings_delete_own_org" on public.face_embeddings;
create policy "embeddings_delete_own_org" on public.face_embeddings
  for delete using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.org_id = public.current_org_id()
    )
  );

-- Kiosk devices
drop policy if exists "kiosk_select_own_org" on public.kiosk_devices;
create policy "kiosk_select_own_org" on public.kiosk_devices
  for select using (
    exists (
      select 1 from public.sites s
      where s.id = site_id and s.org_id = public.current_org_id()
    )
  );

drop policy if exists "kiosk_insert_own_org" on public.kiosk_devices;
create policy "kiosk_insert_own_org" on public.kiosk_devices
  for insert with check (
    exists (
      select 1 from public.sites s
      where s.id = site_id and s.org_id = public.current_org_id()
    )
  );

-- Attendance
drop policy if exists "attendance_select_own_org" on public.attendance_events;
create policy "attendance_select_own_org" on public.attendance_events
  for select using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.org_id = public.current_org_id()
    )
  );

drop policy if exists "attendance_insert_own_org" on public.attendance_events;
create policy "attendance_insert_own_org" on public.attendance_events
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.org_id = public.current_org_id()
    )
  );

drop policy if exists "attendance_delete_own_org" on public.attendance_events;
create policy "attendance_delete_own_org" on public.attendance_events
  for delete using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id and e.org_id = public.current_org_id()
    )
  );

-- Seed default org + site (safe to re-run)
insert into public.organizations (id, name)
select '11111111-1111-1111-1111-111111111111', 'Default Organization'
where not exists (select 1 from public.organizations);

insert into public.sites (id, org_id, name)
select
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Main Entrance'
where not exists (
  select 1 from public.sites where id = '22222222-2222-2222-2222-222222222222'
);
