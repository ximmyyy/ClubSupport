-- Tenant isolation test. Run in the Supabase SQL editor (or via psql as postgres).
-- Everything happens inside one DO block that ends with an exception, so all test
-- data is rolled back. Expected report:
--   B sees A fields=0; B sees clubs=1; B insert into A blocked=true; B update A rows=0;
--   B booking on A field blocked=true; last admin removal blocked=true; B accepted=1;
--   viewer B sees A fields=1; viewer insert blocked=true; viewer self-promote rows=0; anon blocked=true
do $$
declare
  ua uuid := '00000000-0000-4000-8000-00000000000a';
  ub uuid := '00000000-0000-4000-8000-00000000000b';
  club_a uuid; club_b uuid; field_a uuid; field_b uuid; n int; ok boolean;
  report text := '';
begin
  insert into auth.users (id, email, aud, role) values (ua, 'a@test.local', 'authenticated', 'authenticated'), (ub, 'b@test.local', 'authenticated', 'authenticated');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 'a@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  club_a := public.create_club('Club A', 'A', 'X');
  insert into public.fields (club_id, name, surface) values (club_a, 'Veld 1', 'kunstgras') returning id into field_a;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'email', 'b@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  club_b := public.create_club('Club B', 'B', 'Y');
  insert into public.fields (club_id, name, surface) values (club_b, 'Veld B', 'natuurgras') returning id into field_b;

  select count(*) into n from public.fields where club_id = club_a;
  report := report || 'B sees A fields=' || n || '; ';
  select count(*) into n from public.clubs;
  report := report || 'B sees clubs=' || n || '; ';
  ok := false;
  begin insert into public.fields (club_id, name, surface) values (club_a, 'hack', 'kunstgras'); exception when others then ok := true; end;
  report := report || 'B insert into A blocked=' || ok || '; ';
  update public.clubs set name = 'hacked' where id = club_a; get diagnostics n = row_count;
  report := report || 'B update A rows=' || n || '; ';
  ok := false;
  begin insert into public.bookings (club_id, kind, field_id, sections, start_min, end_min, date) values (club_b, 'overig', field_a, '{0}', 600, 660, '2026-01-01'); exception when others then ok := true; end;
  report := report || 'B booking on A field blocked=' || ok || '; ';

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 'a@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.club_invites (club_id, email, role, invited_by) values (club_a, 'b@test.local', 'viewer', ua);
  ok := false;
  begin delete from public.memberships where club_id = club_a and user_id = ua; exception when others then ok := true; end;
  report := report || 'last admin removal blocked=' || ok || '; ';

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'email', 'b@test.local', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  n := public.accept_invites();
  report := report || 'B accepted=' || n || '; ';
  select count(*) into n from public.fields where club_id = club_a;
  report := report || 'viewer B sees A fields=' || n || '; ';
  ok := false;
  begin insert into public.fields (club_id, name, surface) values (club_a, 'hack', 'kunstgras'); exception when others then ok := true; end;
  report := report || 'viewer insert blocked=' || ok || '; ';
  update public.memberships set role = 'admin' where club_id = club_a and user_id = ub; get diagnostics n = row_count;
  report := report || 'viewer self-promote rows=' || n || '; ';

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  ok := false;
  begin select count(*) into n from public.clubs; exception when others then ok := true; end;
  report := report || 'anon blocked=' || ok;

  execute 'reset role';
  raise exception 'ROLLBACK_REPORT: %', report;
end
$$;
