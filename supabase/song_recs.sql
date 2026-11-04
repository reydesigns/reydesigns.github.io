-- The Vinyl Player's song recommendations (src/lib/songRecs.js).
--
-- Run once in a Supabase project: Dashboard > SQL Editor > New query, paste
-- this, Run. Then copy the project URL and the publishable (or anon) key from
-- Project Settings > API into SUPABASE_URL and SUPABASE_KEY in
-- src/lib/songRecs.js.
--
-- Anyone with the key can read the list and add a song, and nothing else:
-- they cannot edit or delete rows, or set their own id or date. Every row
-- has to carry an iTunes cover and an Apple Music link, so the page never
-- shows an image or a link from anywhere else. A song can only be on the
-- list once (by its track, and by its title and artist), and the table takes
-- at most 20 new songs a minute.
--
-- To take a song off: Table Editor > song_recs, select the row, Delete.

create table public.song_recs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  track_id bigint not null unique check (track_id > 0),
  title text not null check (char_length(title) between 1 and 200),
  artist text not null check (char_length(artist) between 1 and 200),
  cover_url text not null check (
    char_length(cover_url) <= 500
    and cover_url ~ '^https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/[^[:space:]"<>]+$'
  ),
  track_url text not null check (
    char_length(track_url) <= 500
    and track_url ~ '^https://music\.apple\.com/[^[:space:]"<>]+$'
  )
);

create index song_recs_created_at on public.song_recs (created_at desc);

-- One song is on the list once, whichever album (single, deluxe...) it was
-- picked from.
create unique index song_recs_song on public.song_recs (lower(title), lower(artist));

alter table public.song_recs enable row level security;

create policy "anyone can read the list"
  on public.song_recs for select
  to anon, authenticated
  using (true);

create policy "anyone can add a song"
  on public.song_recs for insert
  to anon, authenticated
  with check (true);

-- Reading every column; adding only the song's own columns.
revoke all on public.song_recs from anon, authenticated;
grant select on public.song_recs to anon, authenticated;
grant insert (track_id, title, artist, cover_url, track_url) on public.song_recs to anon, authenticated;

-- A flood guard: past 20 new songs in a minute, more are refused until it
-- quietens down.
create function public.song_recs_flood_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.song_recs where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many recommendations at once, try again in a minute'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger song_recs_flood_guard
  before insert on public.song_recs
  for each row execute function public.song_recs_flood_guard();
