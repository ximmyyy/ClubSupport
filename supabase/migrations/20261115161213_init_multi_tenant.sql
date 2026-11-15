-- Club Support: multi-tenant schema.
-- Every row belongs to a club (club_id). Access is enforced with row level security
-- based on the caller's membership role in that club.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Clubs, memberships and invites
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  short_name text not null check (length(short_name) between 1 and 40),
  city text not null default '',
  sport text not null default 'voetbal' check (sport in ('voetbal')),
  room_before smallint not null default 45 check (room_before between 0 and 240),
  room_after smallint not null default 30 check (room_after between 0 and 240),
  room_buffer smallint not null default 10 check (room_buffer between 0 and 120),
  field_buffer smallint not null default 10 check (field_buffer between 0 and 120),
  rooms_from_age smallint not null default 10 check (rooms_from_age between 5 and 100),
  created_at timestamptz not null default now()
);

create table public.memberships (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'planner', 'viewer')),
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.club_invites (
  club_id uuid not null references public.clubs (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role text not null check (role in ('admin', 'planner', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (club_id, email)
);
create index club_invites_email_idx on public.club_invites (email);
create index club_invites_invited_by_idx on public.club_invites (invited_by);

-- ---------------------------------------------------------------------------
-- Role helper (security definer so policies on memberships do not recurse)
-- ---------------------------------------------------------------------------

create or replace function private.has_club_role(p_club_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.club_id = p_club_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;
revoke all on function private.has_club_role(uuid, text[]) from public;
grant execute on function private.has_club_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Planning data
-- ---------------------------------------------------------------------------

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  surface text not null check (surface in ('kunstgras', 'natuurgras')),
  lit boolean not null default true,
  position integer not null default 0,
  unique (club_id, id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  capacity smallint not null default 18 check (capacity > 0),
  kind text not null check (kind in ('team', 'scheidsrechter')),
  position integer not null default 0,
  unique (club_id, id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  category text not null check (category in ('pupillen', 'junioren', 'senioren', 'vrouwen', 'recreatief')),
  trainer text not null default '',
  players smallint not null default 0 check (players >= 0),
  field_need text not null check (field_need in ('heel', 'half', 'kwart')),
  match_duration smallint not null check (match_duration between 10 and 240),
  room_for_training boolean not null default false,
  position integer not null default 0,
  unique (club_id, id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  kind text not null check (kind in ('training', 'overig')),
  field_id uuid not null,
  sections smallint[] not null check (cardinality(sections) between 1 and 4),
  start_min smallint not null check (start_min between 0 and 1440),
  end_min smallint not null check (end_min between 0 and 1440),
  team_id uuid,
  label text,
  weekday smallint check (weekday between 1 and 7),
  date date,
  exceptions date[] not null default '{}',
  check (end_min > start_min),
  check ((weekday is null) <> (date is null)),
  foreign key (club_id, field_id) references public.fields (club_id, id) on delete cascade,
  foreign key (club_id, team_id) references public.teams (club_id, id) on delete cascade
);
create index bookings_club_id_idx on public.bookings (club_id);
create index bookings_field_idx on public.bookings (club_id, field_id);
create index bookings_team_idx on public.bookings (club_id, team_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  team_id uuid not null,
  opponent text not null,
  date date not null,
  kickoff smallint not null check (kickoff between 0 and 1440),
  home boolean not null,
  field_id uuid,
  sections smallint[],
  status text not null default 'gepland' check (status in ('gepland', 'afgelast', 'gespeeld')),
  referee text,
  score_home smallint check (score_home >= 0),
  score_away smallint check (score_away >= 0),
  unique (club_id, id),
  foreign key (club_id, team_id) references public.teams (club_id, id) on delete cascade,
  foreign key (club_id, field_id) references public.fields (club_id, id) on delete set null (field_id)
);
create index matches_club_date_idx on public.matches (club_id, date);
create index matches_team_idx on public.matches (club_id, team_id);
create index matches_field_idx on public.matches (club_id, field_id);

create table public.room_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  room_id uuid not null,
  date date not null,
  start_min smallint not null check (start_min between 0 and 1440),
  end_min smallint not null check (end_min between 0 and 1440),
  role text not null check (role in ('thuis', 'uit', 'scheidsrechter', 'training', 'overig')),
  team_id uuid,
  match_id uuid,
  label text not null,
  check (end_min > start_min),
  foreign key (club_id, room_id) references public.rooms (club_id, id) on delete cascade,
  foreign key (club_id, team_id) references public.teams (club_id, id) on delete set null (team_id),
  foreign key (club_id, match_id) references public.matches (club_id, id) on delete cascade
);
create index room_assignments_club_date_idx on public.room_assignments (club_id, date);
create index room_assignments_room_idx on public.room_assignments (club_id, room_id);
create index room_assignments_team_idx on public.room_assignments (club_id, team_id);
create index room_assignments_match_idx on public.room_assignments (club_id, match_id);

create table public.duties (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  date date not null,
  start_min smallint not null check (start_min between 0 and 1440),
  end_min smallint not null check (end_min between 0 and 1440),
  role text not null check (role in ('bardienst', 'scheidsrechter', 'wedstrijdsecretariaat', 'kleedkamercontrole', 'veldopbouw')),
  person text,
  team_id uuid,
  match_id uuid,
  check (end_min > start_min),
  foreign key (club_id, team_id) references public.teams (club_id, id) on delete set null (team_id),
  foreign key (club_id, match_id) references public.matches (club_id, id) on delete cascade
);
create index duties_club_date_idx on public.duties (club_id, date);
create index duties_team_idx on public.duties (club_id, team_id);
create index duties_match_idx on public.duties (club_id, match_id);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  field_id uuid not null,
  date date not null,
  reason text not null default '',
  foreign key (club_id, field_id) references public.fields (club_id, id) on delete cascade
);
create index closures_club_date_idx on public.closures (club_id, date);
create index closures_field_idx on public.closures (club_id, field_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.memberships enable row level security;
alter table public.club_invites enable row level security;

create policy "members read their club" on public.clubs
  for select to authenticated
  using ((select private.has_club_role(id, array['admin', 'planner', 'viewer'])));
create policy "admins and planners update their club" on public.clubs
  for update to authenticated
  using ((select private.has_club_role(id, array['admin', 'planner'])))
  with check ((select private.has_club_role(id, array['admin', 'planner'])));
create policy "admins delete their club" on public.clubs
  for delete to authenticated
  using ((select private.has_club_role(id, array['admin'])));

create policy "members see fellow members" on public.memberships
  for select to authenticated
  using ((select private.has_club_role(club_id, array['admin', 'planner', 'viewer'])));
create policy "admins manage members" on public.memberships
  for update to authenticated
  using ((select private.has_club_role(club_id, array['admin'])))
  with check ((select private.has_club_role(club_id, array['admin'])));
create policy "admins remove members" on public.memberships
  for delete to authenticated
  using ((select private.has_club_role(club_id, array['admin'])));

create policy "admins read invites" on public.club_invites
  for select to authenticated
  using ((select private.has_club_role(club_id, array['admin'])));
create policy "admins create invites" on public.club_invites
  for insert to authenticated
  with check ((select private.has_club_role(club_id, array['admin'])));
create policy "admins delete invites" on public.club_invites
  for delete to authenticated
  using ((select private.has_club_role(club_id, array['admin'])));

-- Same rules for every planning table: members read, admins/planners write.
do $$
declare
  t text;
begin
  foreach t in array array['fields', 'rooms', 'teams', 'bookings', 'matches', 'room_assignments', 'duties', 'closures']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "members read" on public.%I for select to authenticated
      using ((select private.has_club_role(club_id, array['admin', 'planner', 'viewer'])))$p$, t);
    execute format($p$create policy "planners insert" on public.%I for insert to authenticated
      with check ((select private.has_club_role(club_id, array['admin', 'planner'])))$p$, t);
    execute format($p$create policy "planners update" on public.%I for update to authenticated
      using ((select private.has_club_role(club_id, array['admin', 'planner'])))
      with check ((select private.has_club_role(club_id, array['admin', 'planner'])))$p$, t);
    execute format($p$create policy "planners delete" on public.%I for delete to authenticated
      using ((select private.has_club_role(club_id, array['admin', 'planner'])))$p$, t);
  end loop;
end
$$;

-- Nothing is readable without logging in.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a club and make the caller its first admin.
create or replace function public.create_club(p_name text, p_short_name text, p_city text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.clubs (name, short_name, city)
  values (trim(p_name), trim(p_short_name), trim(coalesce(p_city, '')))
  returning id into v_club_id;
  insert into public.memberships (club_id, user_id, role, email)
  values (v_club_id, v_user, 'admin', coalesce((select auth.jwt()) ->> 'email', ''));
  return v_club_id;
end;
$$;
revoke all on function public.create_club(text, text, text) from public, anon;
grant execute on function public.create_club(text, text, text) to authenticated;

-- Turn pending invites for the caller's e-mail address into memberships.
create or replace function public.accept_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_count integer;
begin
  if v_user is null or v_email = '' then
    return 0;
  end if;
  insert into public.memberships (club_id, user_id, role, email)
  select i.club_id, v_user, i.role, v_email
  from public.club_invites i
  where i.email = v_email
  on conflict (club_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  delete from public.club_invites where email = v_email;
  return v_count;
end;
$$;
revoke all on function public.accept_invites() from public, anon;
grant execute on function public.accept_invites() to authenticated;

-- An admin cannot demote or remove the last admin of a club.
create or replace function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    if not exists (
      select 1 from public.memberships m
      where m.club_id = old.club_id and m.role = 'admin' and m.user_id <> old.user_id
    ) and exists (select 1 from public.clubs c where c.id = old.club_id) then
      raise exception 'Een club heeft minimaal één beheerder nodig' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger memberships_keep_one_admin
  before update or delete on public.memberships
  for each row execute function private.keep_one_admin();

-- ---------------------------------------------------------------------------
-- Realtime: the TV screen and other open browsers update live
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.clubs, public.fields, public.rooms, public.teams, public.bookings,
  public.matches, public.room_assignments, public.duties, public.closures;
