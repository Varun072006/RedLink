-- REDLINK core schema. Identity is separate from donor and organisation profiles.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'requester' check (role in ('requester', 'donor', 'staff', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 20),
  notify_in_app boolean not null default true,
  notify_push boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.donor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  donor_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  availability text not null default 'unavailable' check (availability in ('available', 'paused', 'unavailable')),
  opted_in boolean not null default false,
  consent_at timestamptz,
  city text not null check (char_length(city) between 1 and 80),
  lat numeric(8, 5) not null check (lat between -90 and 90),
  lng numeric(8, 5) not null check (lng between -180 and 180),
  last_donation_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not opted_in or consent_at is not null),
  check (availability <> 'available' or opted_in)
);

create table public.blood_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('hospital', 'blood_bank')),
  city text not null check (char_length(city) between 1 and 80),
  address text not null check (char_length(address) <= 200),
  lat numeric(8, 5) not null check (lat between -90 and 90),
  lng numeric(8, 5) not null check (lng between -180 and 180),
  phone text not null check (char_length(phone) <= 20),
  license_ref text check (license_ref is null or char_length(license_ref) <= 80),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  verification_note text,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  is_synthetic boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.centre_staff (
  centre_id uuid not null references public.blood_centres (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (centre_id, user_id)
);

create table public.blood_inventory (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.blood_centres (id) on delete cascade,
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  component text not null check (component in ('whole_blood', 'red_cells', 'platelets', 'plasma')),
  units integer not null default 0 check (units >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  last_confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (centre_id, blood_group, component),
  check (reserved <= units)
);

create table public.inventory_adjustments (
  id bigint generated always as identity primary key,
  centre_id uuid not null references public.blood_centres (id) on delete cascade,
  inventory_id uuid not null references public.blood_inventory (id) on delete cascade,
  blood_group text not null,
  component text not null,
  kind text not null check (kind in ('set', 'delta', 'confirm', 'reserve', 'release', 'fulfil')),
  units_before integer not null,
  units_after integer not null,
  reserved_before integer not null,
  reserved_after integer not null,
  reason text,
  actor_id uuid references public.profiles (id) on delete set null,
  request_id uuid,
  created_at timestamptz not null default now()
);

create table public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  tracking_hash text not null unique,
  requester_id uuid references public.profiles (id) on delete set null,
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  component text not null check (component in ('whole_blood', 'red_cells', 'platelets', 'plasma')),
  units integer not null check (units between 1 and 50),
  urgency text not null check (urgency in ('critical', 'urgent', 'standard')),
  status text not null default 'submitted'
    check (status in ('submitted', 'matching', 'awaiting_response', 'availability_confirmed',
                      'fulfilled', 'cancelled', 'expired', 'rejected', 'unresolved')),
  status_reason text,
  facility_name text not null check (char_length(facility_name) <= 120),
  centre_id uuid references public.blood_centres (id) on delete set null,
  city text not null check (char_length(city) <= 80),
  location_detail text check (location_detail is null or char_length(location_detail) <= 200),
  lat numeric(8, 5) not null,
  lng numeric(8, 5) not null,
  contact_name text not null check (char_length(contact_name) <= 80),
  contact_phone text not null check (char_length(contact_phone) <= 20),
  contact_email text check (contact_email is null or char_length(contact_email) <= 200),
  contact_pref text not null check (contact_pref in ('phone', 'whatsapp', 'email')),
  consent_at timestamptz not null,
  notes text check (notes is null or char_length(notes) <= 300),
  search_radius_km integer not null default 10,
  match_attempts integer not null default 0,
  last_matched_at timestamptz,
  flagged boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.request_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests (id) on delete cascade,
  candidate_type text not null check (candidate_type in ('centre', 'donor')),
  centre_id uuid references public.blood_centres (id) on delete cascade,
  donor_id uuid references public.donor_profiles (user_id) on delete cascade,
  supply_group text check (supply_group is null or supply_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  status text not null default 'notified'
    check (status in ('notified', 'accepted', 'declined', 'confirmed', 'unavailable', 'timeout', 'released', 'fulfilled')),
  score numeric(6, 1) not null,
  distance_km numeric(7, 1) not null,
  rationale jsonb not null default '[]'::jsonb,
  reserved_units integer not null default 0 check (reserved_units >= 0),
  notified_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (candidate_type = 'centre' and centre_id is not null and donor_id is null) or
    (candidate_type = 'donor' and donor_id is not null and centre_id is null)
  ),
  unique (request_id, centre_id),
  unique (request_id, donor_id)
);

create table public.donation_records (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.donor_profiles (user_id) on delete cascade,
  centre_id uuid not null references public.blood_centres (id) on delete cascade,
  request_id uuid references public.blood_requests (id) on delete set null,
  donated_on date not null default current_date,
  verified boolean not null default true,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  push_status text not null default 'none' check (push_status in ('none', 'pending', 'sent', 'failed')),
  push_attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  request_id uuid references public.blood_requests (id) on delete cascade,
  centre_id uuid references public.blood_centres (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

create index blood_centres_status_city_idx on public.blood_centres (verification_status, city);
create index blood_centres_geo_idx on public.blood_centres (lat, lng);
create index blood_inventory_lookup_idx on public.blood_inventory (blood_group, component);
create index blood_inventory_confirmed_idx on public.blood_inventory (last_confirmed_at);
create index inventory_adjustments_centre_idx on public.inventory_adjustments (centre_id, created_at desc);
create index blood_requests_status_expiry_idx on public.blood_requests (status, expires_at);
create index blood_requests_group_component_idx on public.blood_requests (blood_group, component);
create index blood_requests_requester_idx on public.blood_requests (requester_id);
create index request_matches_request_idx on public.request_matches (request_id);
create index request_matches_donor_idx on public.request_matches (donor_id, status);
create index request_matches_centre_idx on public.request_matches (centre_id, status);
create index request_matches_expiry_idx on public.request_matches (status, expires_at);
create index donor_profiles_pool_idx on public.donor_profiles (blood_group, availability) where opted_in;
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index abuse_reports_status_idx on public.abuse_reports (status, created_at desc);
create index donation_records_donor_idx on public.donation_records (donor_id, donated_on desc);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger donor_profiles_touch before update on public.donor_profiles for each row execute function public.touch_updated_at();
create trigger blood_centres_touch before update on public.blood_centres for each row execute function public.touch_updated_at();
create trigger blood_requests_touch before update on public.blood_requests for each row execute function public.touch_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    case when meta_role in ('donor', 'staff') then meta_role else 'requester' end,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (new.role is distinct from old.role or new.status is distinct from old.status or new.id is distinct from old.id) then
    raise exception 'role and status can only be changed by the platform' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

create function public.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit logs are append-only' using errcode = '42501';
end $$;

create trigger audit_logs_no_update before update or delete on public.audit_logs for each row execute function public.audit_logs_immutable();

create function public.enforce_request_transition() returns trigger
language plpgsql as $$
declare
  ok boolean;
begin
  if new.status = old.status then
    return new;
  end if;
  ok := case old.status
    when 'submitted' then new.status in ('matching', 'awaiting_response', 'cancelled', 'expired', 'rejected')
    when 'matching' then new.status in ('awaiting_response', 'availability_confirmed', 'cancelled', 'expired', 'rejected', 'unresolved')
    when 'awaiting_response' then new.status in ('matching', 'availability_confirmed', 'cancelled', 'expired', 'rejected', 'unresolved')
    when 'availability_confirmed' then new.status in ('awaiting_response', 'fulfilled', 'cancelled', 'expired', 'unresolved')
    else false
  end;
  if not ok then
    raise exception 'invalid request transition % -> %', old.status, new.status using errcode = '23514';
  end if;
  if new.status in ('fulfilled', 'cancelled', 'expired', 'rejected', 'unresolved') then
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;
  return new;
end $$;

create trigger blood_requests_transition before update of status on public.blood_requests
  for each row execute function public.enforce_request_transition();
