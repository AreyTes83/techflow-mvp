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

