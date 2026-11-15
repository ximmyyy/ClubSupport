-- Trainer role (linked to teams) and change requests ("ruilverzoeken").

-- 1. Trainer role on memberships and invites, with the teams they coach
alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check check (role in ('admin', 'planner', 'trainer', 'viewer'));
alter table public.memberships add column team_ids uuid[] not null default '{}';

alter table public.club_invites drop constraint club_invites_role_check;
alter table public.club_invites add constraint club_invites_role_check check (role in ('admin', 'planner', 'trainer', 'viewer'));
alter table public.club_invites add column team_ids uuid[] not null default '{}';

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
  insert into public.memberships (club_id, user_id, role, email, team_ids)
  select i.club_id, v_user, i.role, v_email, i.team_ids
  from public.club_invites i
  where i.email = v_email
  on conflict (club_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  delete from public.club_invites where email = v_email;
  return v_count;
end;
$$;

create or replace function private.is_team_trainer(p_club_id uuid, p_team_id uuid)
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
      and m.role = 'trainer'
      and p_team_id = any (m.team_ids)
  );
$$;
revoke all on function private.is_team_trainer(uuid, uuid) from public;
grant execute on function private.is_team_trainer(uuid, uuid) to authenticated;

-- 2. Trainers can read everything in their club, like viewers
drop policy "members read their club" on public.clubs;
create policy "members read their club" on public.clubs
  for select to authenticated
  using ((select private.has_club_role(id, array['admin', 'planner', 'trainer', 'viewer'])));

drop policy "members see fellow members" on public.memberships;
create policy "members see fellow members" on public.memberships
  for select to authenticated
  using ((select private.has_club_role(club_id, array['admin', 'planner', 'trainer', 'viewer'])));

do $$
declare
  t text;
begin
  foreach t in array array['fields', 'rooms', 'teams', 'bookings', 'matches', 'room_assignments', 'duties', 'closures']
  loop
    execute format('drop policy "members read" on public.%I', t);
    execute format($p$create policy "members read" on public.%I for select to authenticated
      using ((select private.has_club_role(club_id, array['admin', 'planner', 'trainer', 'viewer'])))$p$, t);
  end loop;
end
$$;

-- 3. Change requests
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  team_id uuid not null,
  booking_id uuid,
  match_id uuid,
  scope text not null check (scope in ('eenmalig', 'reeks')),
  date date not null,
  field_id uuid not null,
  sections smallint[] not null check (cardinality(sections) between 1 and 4),
  start_min smallint not null check (start_min between 0 and 1440),
  end_min smallint not null check (end_min between 0 and 1440),
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'goedgekeurd', 'afgewezen')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  check (end_min > start_min),
  check (booking_id is null or match_id is null),
  foreign key (club_id, team_id) references public.teams (club_id, id) on delete cascade,
  foreign key (club_id, field_id) references public.fields (club_id, id) on delete cascade,
  foreign key (club_id, match_id) references public.matches (club_id, id) on delete cascade
);
-- bookings had no (club_id, id) key yet
alter table public.bookings add constraint bookings_club_id_id_key unique (club_id, id);
alter table public.change_requests add foreign key (club_id, booking_id) references public.bookings (club_id, id) on delete cascade;

create index change_requests_club_status_idx on public.change_requests (club_id, status);
create index change_requests_team_idx on public.change_requests (club_id, team_id);
create index change_requests_booking_idx on public.change_requests (club_id, booking_id);
create index change_requests_match_idx on public.change_requests (club_id, match_id);
create index change_requests_field_idx on public.change_requests (club_id, field_id);
create index change_requests_created_by_idx on public.change_requests (created_by);

alter table public.change_requests enable row level security;

create policy "members read" on public.change_requests
  for select to authenticated
  using ((select private.has_club_role(club_id, array['admin', 'planner', 'trainer', 'viewer'])));

-- Planners may create any request; trainers only open requests for their own teams.
create policy "planners and trainers insert" on public.change_requests
  for insert to authenticated
  with check (
    (select private.has_club_role(club_id, array['admin', 'planner']))
    or (status = 'open' and created_by = (select auth.uid()) and (select private.is_team_trainer(club_id, team_id)))
  );

-- Only planners decide on requests.
create policy "planners update" on public.change_requests
  for update to authenticated
  using ((select private.has_club_role(club_id, array['admin', 'planner'])))
  with check ((select private.has_club_role(club_id, array['admin', 'planner'])));

-- Planners delete anything; trainers can withdraw their own open requests.
create policy "planners delete, trainers withdraw" on public.change_requests
  for delete to authenticated
  using (
    (select private.has_club_role(club_id, array['admin', 'planner']))
    or (status = 'open' and created_by = (select auth.uid()))
  );

alter publication supabase_realtime add table public.change_requests;
