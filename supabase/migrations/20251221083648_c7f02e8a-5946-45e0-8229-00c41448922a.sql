-- Fix for previous attempt: primary keys cannot contain NULL (overall availability needs its own table)

-- 1) Date-based availability (for calendars + per-day inventory)
create table if not exists public.item_availability_by_date (
  item_id uuid not null,
  visit_date date not null,
  booked_slots integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (item_id, visit_date)
);

alter table public.item_availability_by_date enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'item_availability_by_date'
      and policyname = 'Public can view item availability by date'
  ) then
    create policy "Public can view item availability by date"
    on public.item_availability_by_date
    for select
    using (true);
  end if;
end $$;

create index if not exists idx_item_avail_by_date_item_id on public.item_availability_by_date (item_id);
create index if not exists idx_item_avail_by_date_visit_date on public.item_availability_by_date (visit_date);

alter table public.item_availability_by_date replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.item_availability_by_date;
  exception when duplicate_object then
    null;
  end;
end $$;

-- 2) Overall availability (for listing cards + detail page quick sold-out)
create table if not exists public.item_availability_overall (
  item_id uuid primary key,
  booked_slots integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.item_availability_overall enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'item_availability_overall'
      and policyname = 'Public can view item availability overall'
  ) then
    create policy "Public can view item availability overall"
    on public.item_availability_overall
    for select
    using (true);
  end if;
end $$;

create index if not exists idx_item_avail_overall_item_id on public.item_availability_overall (item_id);

alter table public.item_availability_overall replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.item_availability_overall;
  exception when duplicate_object then
    null;
  end;
end $$;

-- 3) Recompute helpers (SECURITY DEFINER so they can read bookings regardless of caller RLS)
create or replace function public.recompute_item_availability_by_date(p_item_id uuid, p_visit_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if p_item_id is null or p_visit_date is null then
    return;
  end if;

  select coalesce(sum(coalesce(b.slots_booked, 1)), 0)
    into v_total
  from public.bookings b
  where b.item_id = p_item_id
    and b.visit_date = p_visit_date
    and b.status not in ('cancelled', 'rejected')
    and coalesce(b.payment_status, 'pending') <> 'failed';

  insert into public.item_availability_by_date (item_id, visit_date, booked_slots, updated_at)
  values (p_item_id, p_visit_date, v_total, now())
  on conflict (item_id, visit_date)
  do update set booked_slots = excluded.booked_slots, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.recompute_item_availability_overall(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if p_item_id is null then
    return;
  end if;

  select coalesce(sum(coalesce(b.slots_booked, 1)), 0)
    into v_total
  from public.bookings b
  where b.item_id = p_item_id
    and b.status not in ('cancelled', 'rejected')
    and coalesce(b.payment_status, 'pending') <> 'failed';

  insert into public.item_availability_overall (item_id, booked_slots, updated_at)
  values (p_item_id, v_total, now())
  on conflict (item_id)
  do update set booked_slots = excluded.booked_slots, updated_at = excluded.updated_at;
end;
$$;

-- 4) Trigger to keep caches in sync
create or replace function public.handle_booking_availability_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_item_availability_by_date(new.item_id, new.visit_date);
    perform public.recompute_item_availability_overall(new.item_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.recompute_item_availability_by_date(old.item_id, old.visit_date);
    perform public.recompute_item_availability_overall(old.item_id);
    return old;
  else
    -- UPDATE
    perform public.recompute_item_availability_by_date(new.item_id, new.visit_date);
    perform public.recompute_item_availability_overall(new.item_id);

    if old.item_id is distinct from new.item_id or old.visit_date is distinct from new.visit_date then
      perform public.recompute_item_availability_by_date(old.item_id, old.visit_date);
      perform public.recompute_item_availability_overall(old.item_id);
    end if;

    return new;
  end if;
end;
$$;

drop trigger if exists trg_bookings_availability_change on public.bookings;
create trigger trg_bookings_availability_change
after insert or update or delete on public.bookings
for each row
execute function public.handle_booking_availability_change();

-- 5) Capacity validation: prevents double-booking per date
create or replace function public.validate_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_already integer;
  v_request integer;
begin
  -- Ignore rows that don't consume inventory
  if new.status in ('cancelled', 'rejected') then
    return new;
  end if;
  if coalesce(new.payment_status, 'pending') = 'failed' then
    return new;
  end if;

  -- Hotel inventory is date-based
  if new.booking_type = 'hotel' and new.visit_date is null then
    raise exception 'Visit date is required for hotel bookings.';
  end if;

  v_capacity := null;

  if new.booking_type in ('trip', 'event') then
    select coalesce(t.available_tickets, 0)
      into v_capacity
    from public.trips t
    where t.id = new.item_id;
  elsif new.booking_type = 'hotel' then
    select coalesce(h.available_rooms, 0)
      into v_capacity
    from public.hotels h
    where h.id = new.item_id;
  elsif new.booking_type in ('adventure', 'adventure_place') then
    select coalesce(a.available_slots, 0)
      into v_capacity
    from public.adventure_places a
    where a.id = new.item_id;
  else
    return new;
  end if;

  if v_capacity is null or v_capacity <= 0 then
    raise exception 'This item is not available for booking.';
  end if;

  v_request := greatest(coalesce(new.slots_booked, 1), 1);

  select coalesce(sum(coalesce(b.slots_booked, 1)), 0)
    into v_already
  from public.bookings b
  where b.item_id = new.item_id
    and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')::uuid
    and (b.visit_date = new.visit_date or (b.visit_date is null and new.visit_date is null))
    and b.status not in ('cancelled', 'rejected')
    and coalesce(b.payment_status, 'pending') <> 'failed';

  if (v_already + v_request) > v_capacity then
    raise exception 'Sold out for the selected date. Please choose another date.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_booking_capacity on public.bookings;
create trigger trg_validate_booking_capacity
before insert or update of item_id, visit_date, slots_booked, status, payment_status
on public.bookings
for each row
execute function public.validate_booking_capacity();

-- 6) Backfill caches
insert into public.item_availability_by_date (item_id, visit_date, booked_slots, updated_at)
select
  b.item_id,
  b.visit_date,
  coalesce(sum(coalesce(b.slots_booked, 1)), 0) as booked_slots,
  now() as updated_at
from public.bookings b
where b.visit_date is not null
  and b.status not in ('cancelled', 'rejected')
  and coalesce(b.payment_status, 'pending') <> 'failed'
group by b.item_id, b.visit_date
on conflict (item_id, visit_date)
do update set booked_slots = excluded.booked_slots, updated_at = excluded.updated_at;

insert into public.item_availability_overall (item_id, booked_slots, updated_at)
select
  b.item_id,
  coalesce(sum(coalesce(b.slots_booked, 1)), 0) as booked_slots,
  now() as updated_at
from public.bookings b
where b.status not in ('cancelled', 'rejected')
  and coalesce(b.payment_status, 'pending') <> 'failed'
group by b.item_id
on conflict (item_id)
do update set booked_slots = excluded.booked_slots, updated_at = excluded.updated_at;
