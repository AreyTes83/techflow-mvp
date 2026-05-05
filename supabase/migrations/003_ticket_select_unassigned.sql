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

