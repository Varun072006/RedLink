-- SYNTHETIC DEMONSTRATION DATA ONLY. Not real facilities, stock or confirmations.
-- Safe to omit in production. Records are flagged is_synthetic and labelled in the interface.

insert into public.blood_centres (id, name, kind, city, address, lat, lng, phone, verification_status, verified_at, is_synthetic) values
  ('00000000-0000-4000-8000-000000000001', 'SYNTHETIC Demo Blood Bank A', 'blood_bank', 'Bengaluru', 'Demo address 1 (not real)', 12.97160, 77.59460, '0000000001', 'verified', now(), true),
  ('00000000-0000-4000-8000-000000000002', 'SYNTHETIC Demo Hospital B', 'hospital', 'Bengaluru', 'Demo address 2 (not real)', 12.93520, 77.62450, '0000000002', 'verified', now(), true),
  ('00000000-0000-4000-8000-000000000003', 'SYNTHETIC Demo Blood Bank C', 'blood_bank', 'Bengaluru', 'Demo address 3 (not real)', 13.03590, 77.59700, '0000000003', 'verified', now(), true),
  ('00000000-0000-4000-8000-000000000004', 'SYNTHETIC Demo Hospital D', 'hospital', 'Mysuru', 'Demo address 4 (not real)', 12.29580, 76.63940, '0000000004', 'verified', now(), true),
  ('00000000-0000-4000-8000-000000000005', 'SYNTHETIC Demo Blood Bank E', 'blood_bank', 'Chennai', 'Demo address 5 (not real)', 13.08270, 80.27070, '0000000005', 'verified', now(), true),
  ('00000000-0000-4000-8000-000000000006', 'SYNTHETIC Demo Unverified Clinic F', 'hospital', 'Bengaluru', 'Demo address 6 (not real)', 12.99000, 77.55000, '0000000006', 'pending', null, true)
on conflict (id) do nothing;

insert into public.blood_inventory (centre_id, blood_group, component, units, last_confirmed_at)
select c.id, g.bg, comp.c, g.units, now() - c.age
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, interval '25 minutes'),
  ('00000000-0000-4000-8000-000000000002'::uuid, interval '9 hours'),
  ('00000000-0000-4000-8000-000000000003'::uuid, interval '40 hours'),
  ('00000000-0000-4000-8000-000000000004'::uuid, interval '2 hours'),
  ('00000000-0000-4000-8000-000000000005'::uuid, interval '120 hours')
) as c(id, age)
cross join (values ('O+', 8), ('O-', 2), ('A+', 6), ('B+', 4), ('AB+', 1)) as g(bg, units)
cross join (values ('red_cells'), ('plasma')) as comp(c)
on conflict (centre_id, blood_group, component) do nothing;
