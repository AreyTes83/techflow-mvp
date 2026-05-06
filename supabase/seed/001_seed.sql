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
  'Магазин #1',
  'м. Київ, тестова адреса 1',
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

-- Second store_staff (обліковка store2@) — лише для Магазину #2; store@ — лише Магазин #1
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
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Керівник Техслужби', 900000001, '+380000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Технік #1', 900000002, '+380000000002'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Працівник магазину #1', 900000003, '+380000000003'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Працівник магазину #2', 900000004, '+380000000004')
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

-- 6) Link store staff to stores (різні магазини — різний список заявок у TMA)
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

