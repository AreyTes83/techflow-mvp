-- Магазин #2 + привʼязка store2@ (`dddddddd-dddd-dddd-dddd-dddddddddddd`) лише до нього,
-- щоб у TMA другий працівник бачив іншу торговельну точку, ніж store@.

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
