-- Дозволити читання public.users для учасників тікета (джойни в Supabase/API).
-- Базово залишається лише users_select_self; без цього вкладені users(...) у запитах тікетів порожні.

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
