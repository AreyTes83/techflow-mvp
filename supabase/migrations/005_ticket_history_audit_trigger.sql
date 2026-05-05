-- Автоматичний аудит у public.ticket_history при створенні тікета та зміні статусу.
-- SECURITY DEFINER: щоб INSERT не блокувався граничними випадками RLS під час того ж запиту, що й UPDATE.
-- auth.uid() усе ще від сесії клієнта (JWT).

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
