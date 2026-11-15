-- Trainer role and change requests. Rolled back at the end; expected report:
--   trainer accepted=1; trainer reads fields=1; trainer upsert own team ok=true; other team blocked=true;
--   self-approve blocked=true; trainer approve rows=0; trainer booking blocked=true; admin approve rows=1;
--   trainer withdraw rows=1
do $$
declare
  ua uuid := '00000000-0000-4000-8000-00000000000a';
  ub uuid := '00000000-0000-4000-8000-00000000000b';
  club uuid; f uuid; t1 uuid; t2 uuid; r1 uuid := gen_random_uuid(); n int; ok boolean; report text := '';
begin
  insert into auth.users (id, email, aud, role) values (ua, 'a@test.local', 'authenticated', 'authenticated'), (ub, 'b@test.local', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 'a@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  club := public.create_club('Club A', 'A', 'X');
  insert into public.fields (club_id, name, surface) values (club, 'Veld 1', 'kunstgras') returning id into f;
  insert into public.teams (club_id, name, category, field_need, match_duration) values (club, 'JO11-1', 'pupillen', 'half', 75) returning id into t1;
  insert into public.teams (club_id, name, category, field_need, match_duration) values (club, 'JO13-1', 'junioren', 'heel', 85) returning id into t2;
  insert into public.club_invites (club_id, email, role, team_ids, invited_by) values (club, 'b@test.local', 'trainer', array[t1], ua);

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'email', 'b@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  n := public.accept_invites(); report := report || 'trainer accepted=' || n || '; ';
  select count(*) into n from public.fields where club_id = club; report := report || 'trainer reads fields=' || n || '; ';
  ok := true;
  begin
    insert into public.change_requests (id, club_id, team_id, scope, date, field_id, sections, start_min, end_min, note, status, created_by_name)
    values (r1, club, t1, 'eenmalig', '2026-12-01', f, '{0,1}', 1080, 1170, 'graag eerder', 'open', 'B')
    on conflict (id) do update set note = excluded.note;
  exception when others then ok := false; end;
  report := report || 'trainer upsert own team ok=' || ok || '; ';
  ok := false;
  begin insert into public.change_requests (club_id, team_id, scope, date, field_id, sections, start_min, end_min) values (club, t2, 'eenmalig', '2026-12-01', f, '{0}', 1080, 1170); exception when others then ok := true; end;
  report := report || 'other team blocked=' || ok || '; ';
  ok := false;
  begin insert into public.change_requests (club_id, team_id, scope, date, field_id, sections, start_min, end_min, status) values (club, t1, 'eenmalig', '2026-12-01', f, '{0}', 1080, 1170, 'goedgekeurd'); exception when others then ok := true; end;
  report := report || 'self-approve blocked=' || ok || '; ';
  update public.change_requests set status = 'goedgekeurd' where id = r1; get diagnostics n = row_count;
  report := report || 'trainer approve rows=' || n || '; ';
  ok := false;
  begin insert into public.bookings (club_id, kind, field_id, sections, start_min, end_min, team_id, weekday) values (club, 'training', f, '{0}', 1080, 1170, t1, 2); exception when others then ok := true; end;
  report := report || 'trainer booking blocked=' || ok || '; ';

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 'a@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.change_requests set status = 'goedgekeurd', decided_by_name = 'A', decided_at = now() where id = r1; get diagnostics n = row_count;
  report := report || 'admin approve rows=' || n || '; ';
  update public.change_requests set status = 'open' where id = r1;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'email', 'b@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  delete from public.change_requests where id = r1; get diagnostics n = row_count;
  report := report || 'trainer withdraw rows=' || n;

  execute 'reset role';
  raise exception 'ROLLBACK_REPORT: %', report;
end
$$;
