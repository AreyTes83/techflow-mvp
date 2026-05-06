-- TECHFLOW MVP: full apply (migrations + seed + login repair) -- run in Supabase SQL Editor as one script


-- TECHFLOW MVP #1 schema (core tickets + roles)
-- Apply in Supabase SQL editor or via supabase CLI migrations.

-- Extensions
create extension if not exists pgcrypto;

-- Enumerations
do $$ begin
  create type public.ticket_status as enum (
    'new',
    'in_progress',
    'pending_confirmation',
    'completed',
    'rated'
  );
exception
  when duplicate_object then null;
end $$;

-- Stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  working_hours text,
  created_at timestamptz not null default now()
);

-- App users (linked to Supabase Auth user id)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  telegram_id bigint unique,
  phone text,
  created_at timestamptz not null default now()
);

-- Roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('store_staff', 'technician', 'manager')),
  created_at timestamptz not null default now()
);

-- User roles (many-to-many, but for MVP we will use 1 role per user)
create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Store staff to stores
create table if not exists public.user_stores (
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

-- Tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  status public.ticket_status not null default 'new',
  description text not null,

  created_by uuid not null references public.users(id) on delete restrict,
  tech_id uuid references public.users(id) on delete set null,

  completed_at timestamptz,
  rating_stars int check (rating_stars between 1 and 5),
  review_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_store_id_idx on public.tickets (store_id);
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_tech_id_idx on public.tickets (tech_id);

-- Ticket history (audit)
create table if not exists public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  changed_by uuid references public.users(id) on delete set null,
  old_status public.ticket_status,
  new_status public.ticket_status,
  note text,
  changed_at timestamptz not null default now()
);

create index if not exists ticket_history_ticket_id_idx on public.ticket_history (ticket_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_tickets_updated_at on public.tickets;
create trigger set_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- Simple helper: current app user id
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- RLS
alter table public.stores enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_stores enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_history enable row level security;

-- Roles and stores: read-only for authenticated in MVP
drop policy if exists stores_select on public.stores;
create policy stores_select
on public.stores for select
to authenticated
using (true);

drop policy if exists roles_select on public.roles;
create policy roles_select
on public.roles for select
to authenticated
using (true);

-- Users: only self
drop policy if exists users_select_self on public.users;
create policy users_select_self
on public.users for select
to authenticated
using (id = auth.uid());

-- user_roles: only self
drop policy if exists user_roles_select_self on public.user_roles;
create policy user_roles_select_self
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

-- user_stores: only self
drop policy if exists user_stores_select_self on public.user_stores;
create policy user_stores_select_self
on public.user_stores for select
to authenticated
using (user_id = auth.uid());

-- Tickets policies:
-- - Store staff can read tickets for their store(s)
-- - Technicians can read tickets assigned to them
-- - Managers can read all tickets (MVP)
-- Writes:
-- - Store staff can insert ticket only for their store(s)
-- - Technicians can update ticket if assigned to them (status changes)
-- - Store staff can confirm/rate only for their store(s)

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = role_name
  );
$$;

create or replace function public.is_store_staff_of(store uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_stores us
    where us.user_id = auth.uid()
      and us.store_id = store
  );
$$;

drop policy if exists tickets_select_mvp on public.tickets;
create policy tickets_select_mvp
on public.tickets for select
to authenticated
using (
  public.has_role('manager')
  or (public.has_role('technician') and tech_id = auth.uid())
  or (public.has_role('store_staff') and public.is_store_staff_of(store_id))
);

drop policy if exists tickets_insert_store_staff on public.tickets;
create policy tickets_insert_store_staff
on public.tickets for insert
to authenticated
with check (
  public.has_role('store_staff')
  and public.is_store_staff_of(store_id)
  and created_by = auth.uid()
);

drop policy if exists tickets_update_mvp on public.tickets;
create policy tickets_update_mvp
on public.tickets for update
to authenticated
using (
  public.has_role('manager')
  or (public.has_role('technician') and tech_id = auth.uid())
  or (public.has_role('store_staff') and public.is_store_staff_of(store_id))
)
with check (
  public.has_role('manager')
  or (public.has_role('technician') and tech_id = auth.uid())
  or (public.has_role('store_staff') and public.is_store_staff_of(store_id))
);

-- Ticket history: readable by same users as tickets; insert allowed when user can see ticket
drop policy if exists ticket_history_select_mvp on public.ticket_history;
create policy ticket_history_select_mvp
on public.ticket_history for select
to authenticated
using (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_history.ticket_id
      and (
        public.has_role('manager')
        or (public.has_role('technician') and t.tech_id = auth.uid())
        or (public.has_role('store_staff') and public.is_store_staff_of(t.store_id))
      )
  )
);

drop policy if exists ticket_history_insert_mvp on public.ticket_history;
create policy ticket_history_insert_mvp
on public.ticket_history for insert
to authenticated
with check (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and (
        public.has_role('manager')
        or (public.has_role('technician') and t.tech_id = auth.uid())
        or (public.has_role('store_staff') and public.is_store_staff_of(t.store_id))
      )
  )
);



-- Allow technicians to claim unassigned tickets (tech_id is null)

drop policy if exists tickets_update_mvp on public.tickets;
create policy tickets_update_mvp
on public.tickets for update
to authenticated
using (
  public.has_role('manager')
  or (public.has_role('technician') and (tech_id = auth.uid() or tech_id is null))
  or (public.has_role('store_staff') and public.is_store_staff_of(store_id))
)
with check (
  public.has_role('manager')
  or (public.has_role('technician') and tech_id = auth.uid())
  or (public.has_role('store_staff') and public.is_store_staff_of(store_id))
);



-- Allow technicians to see unassigned new tickets (to be able to claim them)

drop policy if exists tickets_select_mvp on public.tickets;
create policy tickets_select_mvp
on public.tickets for select
to authenticated
using (
  public.has_role('manager')
  or (public.has_role('technician') and (tech_id = auth.uid() or (tech_id is null and status = 'new')))
  or (public.has_role('store_staff') and public.is_store_staff_of(store_id))
);



-- TECHFLOW MVP #1 seed
-- Creates roles + one store + 4 users (manager, technician, store_staff) with Supabase Auth accounts.
-- IMPORTANT:
-- - Run this in Supabase with service role / as postgres (SQL editor) because it inserts into auth.users.
-- - After running, use the emails/passwords below to sign in from the TMA during local MVP.

-- 1) Roles
insert into public.roles (name)
values ('store_staff'), ('technician'), ('manager')
on conflict (name) do nothing;

-- 2) Stores
insert into public.stores (id, name, address, lat, lng, working_hours)
values (
  '11111111-1111-1111-1111-111111111111',
  'РњР°РіР°Р·РёРЅ #1',
  'Рј. РљРёС—РІ, С‚РµСЃС‚РѕРІР° Р°РґСЂРµСЃР° 1',
  50.4501,
  30.5234,
  '09:00-21:00'
)
on conflict (id) do nothing;

insert into public.stores (id, name, address, lat, lng, working_hours)
values (
  '22222222-2222-2222-2222-222222222222',
  'Магазин #2',
  'м. Київ, тестова адреса 2',
  50.452,
  30.526,
  '09:00-21:00'
)
on conflict (id) do nothing;

-- 3) Auth users (email/password)
-- Helper to create auth user with encrypted password.
-- Supabase uses auth schema; crypt() comes from pgcrypto.

-- Manager
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, created_at, updated_at)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'manager@techflow.local',
  crypt('manager123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  '',
  now(),
  now()
)
on conflict (id) do nothing;

-- Technician
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, created_at, updated_at)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'tech@techflow.local',
  crypt('tech12345', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  '',
  now(),
  now()
)
on conflict (id) do nothing;

-- Store staff
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, created_at, updated_at)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'store@techflow.local',
  crypt('store12345', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  '',
  now(),
  now()
)
on conflict (id) do nothing;

-- (Optional) second store staff for testing multi-user later
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, created_at, updated_at)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'store2@techflow.local',
  crypt('store212345', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  '',
  now(),
  now()
)
on conflict (id) do nothing;

-- 4) Public user profiles
insert into public.users (id, full_name, telegram_id, phone)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'РљРµСЂС–РІРЅРёРє РўРµС…СЃР»СѓР¶Р±Рё', 900000001, '+380000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'РўРµС…РЅС–Рє #1', 900000002, '+380000000002'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'РџСЂР°С†С–РІРЅРёРє РјР°РіР°Р·РёРЅСѓ #1', 900000003, '+380000000003'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'РџСЂР°С†С–РІРЅРёРє РјР°РіР°Р·РёРЅСѓ #2', 900000004, '+380000000004')
on conflict (id) do nothing;

-- 5) Assign roles
with role_ids as (
  select id, name from public.roles
)
insert into public.user_roles (user_id, role_id, assigned_by)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', r.id, null from role_ids r where r.name = 'manager'
on conflict do nothing;

with role_ids as (
  select id, name from public.roles
)
insert into public.user_roles (user_id, role_id, assigned_by)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', r.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' from role_ids r where r.name = 'technician'
on conflict do nothing;

with role_ids as (
  select id, name from public.roles
)
insert into public.user_roles (user_id, role_id, assigned_by)
select 'cccccccc-cccc-cccc-cccc-cccccccccccc', r.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' from role_ids r where r.name = 'store_staff'
on conflict do nothing;

with role_ids as (
  select id, name from public.roles
)
insert into public.user_roles (user_id, role_id, assigned_by)
select 'dddddddd-dddd-dddd-dddd-dddddddddddd', r.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' from role_ids r where r.name = 'store_staff'
on conflict do nothing;

-- 6) Link store staff to stores (store2@ — лише Магазин #2)
insert into public.user_stores (user_id, store_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

-- Seed credentials (for local MVP):
-- manager@techflow.local / manager123
-- tech@techflow.local    / tech12345
-- store@techflow.local   / store12345
-- store2@techflow.local  / store212345



-- Repair seed users so Email+Password login works on hosted Supabase (GoTrue).
-- Run AFTER: migrations 001вЂ“003 AND seed `001_seed.sql`.
--
-- Why: inserting only into auth.users is often NOT enough вЂ” you typically need rows in auth.identities
-- and matching auth.users.instance_id.

-- 1) Point all seed users at the project's auth instance id
-- On many hosted projects `auth.instances` is empty; a bare subquery then sets NULL and breaks login.
UPDATE auth.users u
SET instance_id = COALESCE(
  (SELECT id FROM auth.instances ORDER BY created_at ASC LIMIT 1),
  '00000000-0000-0000-0000-000000000000'::uuid
)
WHERE u.email IN (
  'manager@techflow.local',
  'tech@techflow.local',
  'store@techflow.local',
  'store2@techflow.local'
);

-- 2) Ensure email identities exist (provider = 'email')
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id::text AS provider_id,
  u.id AS user_id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email
  ) AS identity_data,
  'email' AS provider,
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IN (
  'manager@techflow.local',
  'tech@techflow.local',
  'store@techflow.local',
  'store2@techflow.local'
)
AND NOT EXISTS (
  SELECT 1
  FROM auth.identities i
  WHERE i.user_id = u.id
    AND i.provider = 'email'
);

-- 3) GoTrue scans token columns as strings; NULL → 500 "Database error querying schema"
UPDATE auth.users u
SET
  confirmation_token = COALESCE(u.confirmation_token, ''),
  recovery_token = COALESCE(u.recovery_token, ''),
  email_change_token_new = COALESCE(u.email_change_token_new, ''),
  email_change_token_current = COALESCE(u.email_change_token_current, ''),
  email_change = COALESCE(u.email_change, '')
WHERE u.email IN (
  'manager@techflow.local',
  'tech@techflow.local',
  'store@techflow.local',
  'store2@techflow.local'
);

-- 004: read user profiles linked to tickets (nested selects)
drop policy if exists users_select_if_manager on public.users;
create policy users_select_if_manager
on public.users for select
to authenticated
using (public.has_role('manager'));

drop policy if exists users_select_ticket_linked on public.users;
create policy users_select_ticket_linked
on public.users for select
to authenticated
using (
  exists (
    select 1 from public.tickets t
    where (t.created_by = users.id or t.tech_id = users.id)
      and (
        (
          public.has_role('technician')
          and (
            t.tech_id = auth.uid()
            or (t.tech_id is null and t.status = 'new'::public.ticket_status)
          )
        )
        or (
          public.has_role('store_staff')
          and public.is_store_staff_of(t.store_id)
        )
      )
  )
);

-- 005: автоматичний audit у ticket_history (створення + зміна статусу)
create or replace function public.log_ticket_history_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_history (ticket_id, changed_by, old_status, new_status)
    values (new.id, auth.uid(), null, new.status);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.ticket_history (ticket_id, changed_by, old_status, new_status)
    values (new.id, auth.uid(), old.status, new.status);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_write_audit on public.tickets;

create trigger tickets_write_audit
after insert or update on public.tickets
for each row
execute function public.log_ticket_history_audit();

-- 006: Магазин #2; store2@ лише на ньому (окремий список заявок у TMA)
insert into public.stores (id, name, address, lat, lng, working_hours)
values (
  '22222222-2222-2222-2222-222222222222',
  'Магазин #2',
  'м. Київ, тестова адреса 2',
  50.452,
  30.526,
  '09:00-21:00'
)
on conflict (id) do nothing;

delete from public.user_stores
where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

insert into public.user_stores (user_id, store_id)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222')
on conflict (user_id, store_id) do nothing;
