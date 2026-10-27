-- Row Level Security, helper predicates and table privileges.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

create function public.is_centre_staff(p_centre uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.centre_staff cs
    join public.profiles p on p.id = cs.user_id
    where cs.centre_id = p_centre and cs.user_id = auth.uid() and p.status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.blood_centres enable row level security;
alter table public.centre_staff enable row level security;
alter table public.blood_inventory enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.blood_requests enable row level security;
alter table public.request_matches enable row level security;
alter table public.donation_records enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.abuse_reports enable row level security;
alter table public.rate_limits enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy donor_select on public.donor_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy donor_insert on public.donor_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy donor_update on public.donor_profiles for update to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid());

create policy centres_public_read on public.blood_centres for select to anon, authenticated
  using (verification_status = 'verified' or public.is_centre_staff(id) or public.is_admin());

create policy staff_select on public.centre_staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy inventory_read on public.blood_inventory for select to anon, authenticated
  using (
    exists (select 1 from public.blood_centres c where c.id = centre_id and c.verification_status = 'verified')
    or public.is_centre_staff(centre_id) or public.is_admin()
  );

create policy adjustments_read on public.inventory_adjustments for select to authenticated
  using (public.is_centre_staff(centre_id) or public.is_admin());

create policy requests_read on public.blood_requests for select to authenticated
  using (
    requester_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.request_matches m
      where m.request_id = blood_requests.id and m.centre_id is not null and public.is_centre_staff(m.centre_id)
    )
  );

create policy matches_read on public.request_matches for select to authenticated
  using (donor_id = auth.uid() or (centre_id is not null and public.is_centre_staff(centre_id)) or public.is_admin());

create policy donations_read on public.donation_records for select to authenticated
  using (donor_id = auth.uid() or public.is_centre_staff(centre_id) or public.is_admin());

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_admin_read on public.audit_logs for select to authenticated
  using (public.is_admin());

create policy reports_insert on public.abuse_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());
create policy reports_read on public.abuse_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.abuse_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select (id, name, kind, city, address, lat, lng, phone, verification_status, verified_at, is_synthetic, created_at)
  on public.blood_centres to anon, authenticated;
grant select on public.blood_inventory to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, phone, notify_in_app, notify_push) on public.profiles to authenticated;
grant select on public.donor_profiles to authenticated;
grant insert (user_id, blood_group, availability, opted_in, consent_at, city, lat, lng, last_donation_on)
  on public.donor_profiles to authenticated;
grant update (blood_group, availability, opted_in, consent_at, city, lat, lng, last_donation_on)
  on public.donor_profiles to authenticated;
grant select on public.centre_staff, public.inventory_adjustments, public.blood_requests,
  public.request_matches, public.donation_records, public.audit_logs to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select, insert on public.abuse_reports to authenticated;
grant update (status, resolved_by, resolved_at) on public.abuse_reports to authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.blood_requests,
      public.request_matches, public.blood_inventory;
  end if;
end $$;
