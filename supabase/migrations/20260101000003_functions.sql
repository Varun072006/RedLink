-- Transactional, permission-checked operations. Every privileged write goes through these functions.

create function public.log_audit(p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;

create function public.notify_user(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare
  prefs public.profiles;
begin
  select * into prefs from public.profiles where id = p_user;
  if not found or not prefs.notify_in_app then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link, push_status)
  values (p_user, p_type, p_title, coalesce(p_body, ''), p_link, case when prefs.notify_push then 'pending' else 'none' end);
end $$;

create function public.notify_centre_staff(p_centre uuid, p_type text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  for s in select user_id from public.centre_staff where centre_id = p_centre loop
    perform public.notify_user(s.user_id, p_type, p_title, p_body, p_link);
  end loop;
end $$;

create function public.staff_centre(p_require_verified boolean default true) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid;
  st text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select cs.centre_id, c.verification_status into cid, st
  from public.centre_staff cs
  join public.blood_centres c on c.id = cs.centre_id
  join public.profiles p on p.id = cs.user_id
  where cs.user_id = auth.uid() and p.status = 'active';
  if cid is null then
    raise exception 'no facility access' using errcode = '42501';
  end if;
  if p_require_verified and st <> 'verified' then
    raise exception 'facility is not verified' using errcode = '42501';
  end if;
  return cid;
end $$;

create function public.my_centre() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select to_jsonb(c) || jsonb_build_object('staff_role', cs.role) into result
  from public.centre_staff cs
  join public.blood_centres c on c.id = cs.centre_id
  where cs.user_id = auth.uid();
  return result;
end $$;

create function public.register_centre(
  p_name text, p_kind text, p_city text, p_address text, p_lat numeric, p_lng numeric, p_phone text, p_license_ref text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = uid and role = 'staff' and status = 'active') then
    raise exception 'only active facility staff accounts can register a facility' using errcode = '42501';
  end if;
  if exists (select 1 from public.centre_staff where user_id = uid) then
    raise exception 'this account is already linked to a facility' using errcode = '23505';
  end if;
  insert into public.blood_centres (name, kind, city, address, lat, lng, phone, license_ref, created_by)
  values (p_name, p_kind, p_city, p_address, p_lat, p_lng, p_phone, p_license_ref, uid)
  returning id into cid;
  insert into public.centre_staff (centre_id, user_id, role) values (cid, uid, 'owner');
  perform public.log_audit(uid, 'centre.registered', 'blood_centre', cid::text, jsonb_build_object('name', p_name));
  return cid;
end $$;

create function public.update_centre_profile(
  p_name text, p_city text, p_address text, p_lat numeric, p_lng numeric, p_phone text
) returns void language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(false);
begin
  if not exists (select 1 from public.centre_staff where centre_id = cid and user_id = auth.uid() and role = 'owner') then
    raise exception 'only the facility owner can edit the profile' using errcode = '42501';
  end if;
  update public.blood_centres
  set name = p_name, city = p_city, address = p_address, lat = p_lat, lng = p_lng, phone = p_phone
  where id = cid;
  perform public.log_audit(auth.uid(), 'centre.profile_updated', 'blood_centre', cid::text, '{}'::jsonb);
end $$;

create function public.review_centre(p_centre uuid, p_decision text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  new_status text;
begin
  if not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  new_status := case p_decision when 'approve' then 'verified' when 'reject' then 'rejected' when 'suspend' then 'suspended' else null end;
  if new_status is null then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  update public.blood_centres
  set verification_status = new_status,
      verification_note = left(p_note, 500),
      verified_at = case when new_status = 'verified' then now() else null end,
      verified_by = auth.uid()
  where id = p_centre;
  if not found then
    raise exception 'facility not found' using errcode = 'P0002';
  end if;
  perform public.log_audit(auth.uid(), 'centre.' || p_decision, 'blood_centre', p_centre::text, jsonb_build_object('note', left(p_note, 500)));
  perform public.notify_centre_staff(p_centre, 'verification', 'Facility verification: ' || new_status,
    coalesce(p_note, ''), '/hospital/dashboard');
end $$;

create function public.set_inventory(p_group text, p_component text, p_units integer, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  inv public.blood_inventory;
begin
  if p_units < 0 or p_units > 10000 then
    raise exception 'units out of range' using errcode = '22003';
  end if;
  insert into public.blood_inventory (centre_id, blood_group, component, units)
  values (cid, p_group, p_component, 0) on conflict (centre_id, blood_group, component) do nothing;
  select * into inv from public.blood_inventory
  where centre_id = cid and blood_group = p_group and component = p_component for update;
  if p_units < inv.reserved then
    raise exception 'units cannot be lower than the % units currently reserved', inv.reserved using errcode = '23514';
  end if;
  update public.blood_inventory set units = p_units, last_confirmed_at = now(), updated_at = now() where id = inv.id;
  insert into public.inventory_adjustments (centre_id, inventory_id, blood_group, component, kind, units_before, units_after,
    reserved_before, reserved_after, reason, actor_id)
  values (cid, inv.id, p_group, p_component, 'set', inv.units, p_units, inv.reserved, inv.reserved, left(p_reason, 200), auth.uid());
  perform public.log_audit(auth.uid(), 'inventory.set', 'blood_inventory', inv.id::text,
    jsonb_build_object('from', inv.units, 'to', p_units));
end $$;

create function public.adjust_inventory(p_group text, p_component text, p_delta integer, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  inv public.blood_inventory;
  next_units integer;
begin
  if p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'invalid adjustment' using errcode = '22003';
  end if;
  insert into public.blood_inventory (centre_id, blood_group, component, units)
  values (cid, p_group, p_component, 0) on conflict (centre_id, blood_group, component) do nothing;
  select * into inv from public.blood_inventory
  where centre_id = cid and blood_group = p_group and component = p_component for update;
  next_units := inv.units + p_delta;
  if next_units < inv.reserved then
    raise exception 'adjustment would leave fewer units than the % reserved', inv.reserved using errcode = '23514';
  end if;
  update public.blood_inventory set units = next_units, updated_at = now() where id = inv.id;
  insert into public.inventory_adjustments (centre_id, inventory_id, blood_group, component, kind, units_before, units_after,
    reserved_before, reserved_after, reason, actor_id)
  values (cid, inv.id, p_group, p_component, 'delta', inv.units, next_units, inv.reserved, inv.reserved, left(p_reason, 200), auth.uid());
  perform public.log_audit(auth.uid(), 'inventory.adjust', 'blood_inventory', inv.id::text,
    jsonb_build_object('delta', p_delta));
end $$;

create function public.confirm_inventory() returns integer
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  n integer;
begin
  update public.blood_inventory set last_confirmed_at = now(), updated_at = now() where centre_id = cid;
  get diagnostics n = row_count;
  perform public.log_audit(auth.uid(), 'inventory.confirm_all', 'blood_centre', cid::text, jsonb_build_object('rows', n));
  return n;
end $$;

create function public.release_match_reservation(p_match uuid, p_new_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.request_matches;
  inv public.blood_inventory;
  r public.blood_requests;
begin
  select * into m from public.request_matches where id = p_match for update;
  if not found or m.status <> 'confirmed' or m.reserved_units = 0 then
    return;
  end if;
  select * into r from public.blood_requests where id = m.request_id;
  select * into inv from public.blood_inventory
  where centre_id = m.centre_id and blood_group = m.supply_group and component = r.component for update;
  if found then
    update public.blood_inventory set reserved = greatest(reserved - m.reserved_units, 0), updated_at = now() where id = inv.id;
    insert into public.inventory_adjustments (centre_id, inventory_id, blood_group, component, kind, units_before, units_after,
      reserved_before, reserved_after, reason, actor_id, request_id)
    values (inv.centre_id, inv.id, inv.blood_group, inv.component, 'release', inv.units, inv.units, inv.reserved,
      greatest(inv.reserved - m.reserved_units, 0), 'reservation released', auth.uid(), m.request_id);
  end if;
  update public.request_matches set status = p_new_status, reserved_units = 0, responded_at = coalesce(responded_at, now())
  where id = p_match;
end $$;

create function public.respond_to_match(p_match uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.request_matches;
  r public.blood_requests;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into m from public.request_matches where id = p_match and donor_id = auth.uid() for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if m.status <> 'notified' then
    raise exception 'you have already responded to this request' using errcode = '23505';
  end if;
  select * into r from public.blood_requests where id = m.request_id for update;
  if r.status not in ('matching', 'awaiting_response', 'availability_confirmed') or r.expires_at <= now() or m.expires_at <= now() then
    raise exception 'this request is no longer open' using errcode = '23514';
  end if;
  if p_accept and not exists (select 1 from public.donor_profiles where user_id = auth.uid() and opted_in) then
    raise exception 'opt in to requests before accepting' using errcode = '42501';
  end if;
  update public.request_matches
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_match;
  perform public.log_audit(auth.uid(), case when p_accept then 'match.donor_accepted' else 'match.donor_declined' end,
    'request_match', p_match::text, jsonb_build_object('request', m.request_id));
  if p_accept and r.requester_id is not null then
    perform public.notify_user(r.requester_id, 'donor_response', 'A donor has indicated willingness',
      'This is not confirmed stock or verified eligibility. Wait for a facility to confirm.', null);
  end if;
end $$;

create function public.centre_respond(p_match uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  m public.request_matches;
  r public.blood_requests;
  inv public.blood_inventory;
begin
  select * into m from public.request_matches where id = p_match and centre_id = cid for update;
  if not found then
    raise exception 'request not found for this facility' using errcode = 'P0002';
  end if;
  if m.status <> 'notified' then
    raise exception 'this request was already answered' using errcode = '23505';
  end if;
  select * into r from public.blood_requests where id = m.request_id for update;
  if r.status not in ('matching', 'awaiting_response', 'availability_confirmed') or r.expires_at <= now() then
    raise exception 'this request is no longer open' using errcode = '23514';
  end if;

  if p_action = 'unavailable' then
    update public.request_matches set status = 'unavailable', responded_at = now() where id = m.id;
    perform public.log_audit(auth.uid(), 'match.centre_unavailable', 'request_match', m.id::text, jsonb_build_object('request', r.id));
    return;
  end if;
  if p_action <> 'confirm' then
    raise exception 'unknown action' using errcode = '22023';
  end if;

  select * into inv from public.blood_inventory
  where centre_id = cid and blood_group = m.supply_group and component = r.component for update;
  if not found or inv.units - inv.reserved < r.units then
    raise exception 'not enough unreserved stock to confirm % units', r.units using errcode = '23514';
  end if;
  update public.blood_inventory
  set reserved = reserved + r.units, last_confirmed_at = now(), updated_at = now() where id = inv.id;
  insert into public.inventory_adjustments (centre_id, inventory_id, blood_group, component, kind, units_before, units_after,
    reserved_before, reserved_after, reason, actor_id, request_id)
  values (cid, inv.id, inv.blood_group, inv.component, 'reserve', inv.units, inv.units, inv.reserved, inv.reserved + r.units,
    'availability confirmed for request', auth.uid(), r.id);
  update public.request_matches set status = 'confirmed', reserved_units = r.units, responded_at = now() where id = m.id;
  if r.status <> 'availability_confirmed' then
    update public.blood_requests set status = 'availability_confirmed', status_reason = null where id = r.id;
  end if;
  perform public.log_audit(auth.uid(), 'match.centre_confirmed', 'request_match', m.id::text, jsonb_build_object('request', r.id, 'units', r.units));
  if r.requester_id is not null then
    perform public.notify_user(r.requester_id, 'availability_confirmed', 'A facility confirmed availability',
      'Contact the facility now to arrange collection. Final compatibility is decided by clinicians.', null);
  end if;
end $$;

create function public.fulfil_request(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  m public.request_matches;
  r public.blood_requests;
  inv public.blood_inventory;
  other record;
begin
  select * into m from public.request_matches where id = p_match and centre_id = cid for update;
  if not found then
    raise exception 'request not found for this facility' using errcode = 'P0002';
  end if;
  if m.status <> 'confirmed' then
    raise exception 'only a confirmed reservation can be fulfilled' using errcode = '23514';
  end if;
  select * into r from public.blood_requests where id = m.request_id for update;
  select * into inv from public.blood_inventory
  where centre_id = cid and blood_group = m.supply_group and component = r.component for update;
  update public.blood_inventory
  set units = units - m.reserved_units, reserved = reserved - m.reserved_units, updated_at = now() where id = inv.id;
  insert into public.inventory_adjustments (centre_id, inventory_id, blood_group, component, kind, units_before, units_after,
    reserved_before, reserved_after, reason, actor_id, request_id)
  values (cid, inv.id, inv.blood_group, inv.component, 'fulfil', inv.units, inv.units - m.reserved_units, inv.reserved,
    inv.reserved - m.reserved_units, 'issued against request', auth.uid(), r.id);
  update public.request_matches set status = 'fulfilled', reserved_units = 0 where id = m.id;
  for other in select id from public.request_matches where request_id = r.id and id <> m.id and status = 'confirmed' loop
    perform public.release_match_reservation(other.id, 'released');
  end loop;
  update public.request_matches set status = 'released' where request_id = r.id and id <> m.id and status in ('notified', 'accepted');
  update public.blood_requests set status = 'fulfilled' where id = r.id;
  perform public.log_audit(auth.uid(), 'request.fulfilled', 'blood_request', r.id::text, jsonb_build_object('match', m.id));
  if r.requester_id is not null then
    perform public.notify_user(r.requester_id, 'fulfilled', 'Request marked fulfilled by the facility', '', null);
  end if;
end $$;

create function public.release_reservation(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  m public.request_matches;
begin
  select * into m from public.request_matches where id = p_match and centre_id = cid for update;
  if not found or m.status <> 'confirmed' then
    raise exception 'no active reservation to release' using errcode = 'P0002';
  end if;
  perform public.release_match_reservation(m.id, 'released');
  if not exists (select 1 from public.request_matches where request_id = m.request_id and status = 'confirmed')
     and exists (select 1 from public.blood_requests where id = m.request_id and status = 'availability_confirmed') then
    update public.blood_requests set status = 'awaiting_response' where id = m.request_id;
  end if;
  perform public.log_audit(auth.uid(), 'match.reservation_released', 'request_match', m.id::text, '{}'::jsonb);
end $$;

create function public.close_request(p_request uuid, p_status text, p_reason text, p_actor uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.blood_requests;
  mm record;
begin
  select * into r from public.blood_requests where id = p_request for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if p_status not in ('cancelled', 'expired', 'rejected', 'unresolved') then
    raise exception 'invalid closing status' using errcode = '22023';
  end if;
  for mm in select id from public.request_matches where request_id = p_request and status = 'confirmed' loop
    perform public.release_match_reservation(mm.id, 'released');
  end loop;
  update public.request_matches
  set status = case when p_status = 'expired' then 'timeout' else 'released' end, responded_at = coalesce(responded_at, now())
  where request_id = p_request and status in ('notified', 'accepted');
  update public.blood_requests set status = p_status, status_reason = left(p_reason, 200) where id = p_request;
  perform public.log_audit(p_actor, 'request.' || p_status, 'blood_request', p_request::text, jsonb_build_object('reason', left(p_reason, 200)));
  if r.requester_id is not null then
    perform public.notify_user(r.requester_id, 'request_closed', 'Your request is now ' || p_status, coalesce(p_reason, ''), null);
  end if;
end $$;

create function public.flag_request(p_request uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
begin
  if not exists (select 1 from public.request_matches where request_id = p_request and centre_id = cid) then
    raise exception 'request not found for this facility' using errcode = 'P0002';
  end if;
  update public.blood_requests set flagged = true where id = p_request;
  insert into public.abuse_reports (reporter_id, request_id, centre_id, reason)
  values (auth.uid(), p_request, cid, left(p_reason, 500));
  perform public.log_audit(auth.uid(), 'request.flagged', 'blood_request', p_request::text, jsonb_build_object('reason', left(p_reason, 200)));
end $$;

create function public.record_donation(p_code text, p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.staff_centre(true);
  d public.donor_profiles;
begin
  select * into d from public.donor_profiles where donor_code = upper(trim(p_code));
  if not found then
    raise exception 'donor code not recognised' using errcode = 'P0002';
  end if;
  insert into public.donation_records (donor_id, centre_id, request_id, recorded_by)
  values (d.user_id, cid, p_request, auth.uid());
  update public.donor_profiles set last_donation_on = current_date where user_id = d.user_id;
  perform public.log_audit(auth.uid(), 'donation.recorded', 'donor', d.user_id::text, jsonb_build_object('centre', cid));
  perform public.notify_user(d.user_id, 'donation_recorded', 'A donation was recorded', 'Thank you. A verified facility recorded your donation.', '/donor/dashboard');
end $$;

create function public.donor_matches() returns table (
  match_id uuid, request_id uuid, match_status text, request_status text, blood_group text, component text, units integer,
  urgency text, city text, facility_name text, distance_km numeric, rationale jsonb, notified_at timestamptz,
  expires_at timestamptz, responded_at timestamptz, contact_name text, contact_phone text, location_detail text
) language sql stable security definer set search_path = public as $$
  select m.id, r.id, m.status, r.status, r.blood_group, r.component, r.units, r.urgency, r.city, r.facility_name,
    m.distance_km, m.rationale, m.notified_at, m.expires_at, m.responded_at,
    case when m.status = 'accepted' and r.status in ('matching', 'awaiting_response', 'availability_confirmed') then r.contact_name end,
    case when m.status = 'accepted' and r.status in ('matching', 'awaiting_response', 'availability_confirmed') then r.contact_phone end,
    case when m.status = 'accepted' and r.status in ('matching', 'awaiting_response', 'availability_confirmed') then r.location_detail end
  from public.request_matches m
  join public.blood_requests r on r.id = m.request_id
  where m.donor_id = auth.uid() and auth.uid() is not null
  order by m.notified_at desc
  limit 50;
$$;

create function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  rl public.rate_limits;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, now(), 0) on conflict (key) do nothing;
  select * into rl from public.rate_limits where key = p_key for update;
  if rl.window_start < now() - make_interval(secs => p_window_seconds) then
    update public.rate_limits set window_start = now(), hits = 1 where key = p_key;
    return true;
  end if;
  if rl.hits >= p_max then
    return false;
  end if;
  update public.rate_limits set hits = hits + 1 where key = p_key;
  return true;
end $$;

-- Internal helpers are never callable by browser roles.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.is_admin(), public.is_active_user(), public.is_centre_staff(uuid) to anon, authenticated;
grant execute on function
  public.my_centre(), public.register_centre(text, text, text, text, numeric, numeric, text, text),
  public.update_centre_profile(text, text, text, numeric, numeric, text), public.review_centre(uuid, text, text),
  public.set_inventory(text, text, integer, text), public.adjust_inventory(text, text, integer, text),
  public.confirm_inventory(), public.respond_to_match(uuid, boolean), public.centre_respond(uuid, text),
  public.fulfil_request(uuid), public.release_reservation(uuid), public.flag_request(uuid, text),
  public.record_donation(text, uuid), public.donor_matches()
to authenticated;
