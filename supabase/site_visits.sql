-- The footer's visitor counter, "WEBSITE STALKERS: ##" (src/lib/visits.js).
--
-- Run once in the same Supabase project as song_recs.sql: Dashboard > SQL
-- Editor > New query, paste this, Run. (The project URL and key go in
-- src/lib/supabase.js, once, for both.)
--
-- One row holds the count. Nobody can read or write the table itself; the
-- site calls count_visit(), which adds one for a browser's first visit
-- (`first`, which the site keeps track of in that browser) and returns the
-- count either way. It adds at most 60 a minute, so a script hammering it
-- can only inflate the count slowly.
--
-- Visitors from before the counter existed were never recorded anywhere, so
-- they cannot be recovered. To start from a number you know from elsewhere:
--   update public.site_visits set count = 1234 where id = 1;

create table public.site_visits (
  id smallint primary key default 1 check (id = 1),
  count bigint not null default 0 check (count >= 0),
  -- The flood guard: the minute being counted, and how many it has added.
  minute timestamptz not null default date_trunc('minute', now()),
  added smallint not null default 0
);
insert into public.site_visits (id) values (1);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;

create function public.count_visit(first boolean default false)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  if first then
    update public.site_visits
      set count = count + case when minute < date_trunc('minute', now()) or added < 60 then 1 else 0 end,
          added = case when minute < date_trunc('minute', now()) then 1 else least(added + 1, 60) end,
          minute = date_trunc('minute', now())
      where id = 1
      returning count into n;
  else
    select count into n from public.site_visits where id = 1;
  end if;
  return n;
end;
$$;

revoke all on function public.count_visit(boolean) from public;
grant execute on function public.count_visit(boolean) to anon, authenticated;
