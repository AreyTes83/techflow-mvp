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